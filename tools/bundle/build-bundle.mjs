#!/usr/bin/env node

/**
 * build-bundle.mjs
 *
 * Web portal bundle generator — makes EDWIN usable in browser-only AI interfaces.
 *
 * Flattens persona + context skills into paste-able bundles for:
 *   - Claude Projects (claude.ai)
 *   - Gemini Gems
 *   - Microsoft Copilot
 *
 * Responsibilities:
 *   - Compose persona + skill index + full skill bodies for chosen context
 *   - Apply degradation rewrites (strip script hooks, scheduling, harness-only features)
 *   - Generate portal-specific outputs under dist/bundles/<portal>/<context>/
 *   - Enforce portal character limits with priority-ordered truncation
 *   - Track bundle hashes for --diff staleness detection
 *   - Support personal data opt-ins (--include-memory, --include-brags)
 *
 * Usage:
 *   node tools/bundle/build-bundle.mjs --context <name|Global> --portal <claude|gemini|copilot|all>
 *
 * Options:
 *   --context <name|Global>        Context to export (required)
 *   --portal <name|all>            Target portal (required)
 *   --include-memory               Append user/memory/digest.md to instructions
 *   --include-brags                Append user/brag/ summaries to instructions
 *   --diff                         Report stale bundles and regenerate only those
 *   --dry-run                      Show what would be generated without writing
 *   --json                         Output JSON result only
 *   --quiet                        Minimal output
 *   --help                         Show this help
 *
 * Exit codes:
 *   0 - Success
 *   1 - Expected failure (unknown context, etc.)
 *   2 - Bad usage
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  rmSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

// Node version check
const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
if (nodeMajor < 18) {
  console.error(`Error: Node.js >= 18 required. You have ${process.version}.`);
  process.exit(2);
}

// Resolve paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..', '..');

// Repo paths
const CORE_DIR = join(REPO_ROOT, 'core');
const PERSONA_DIR = join(CORE_DIR, 'persona');
const SKILLS_DIR = join(CORE_DIR, 'skills');
const CONTEXTS_PATH = join(CORE_DIR, 'contexts', 'contexts.json');
const VERSION_PATH = join(CORE_DIR, 'VERSION');
const USER_DIR = join(REPO_ROOT, 'user');
const MEMORY_DIGEST_PATH = join(USER_DIR, 'memory', 'digest.md');
const BRAGS_PATH = join(USER_DIR, 'brags', 'brags.md');
const DIST_DIR = join(REPO_ROOT, 'dist');
const BUNDLES_DIR = join(DIST_DIR, 'bundles');
const MANIFEST_PATH = join(DIST_DIR, 'bundle-manifest.json');
const PORTAL_LIMITS_PATH = join(__dirname, 'portal-limits.json');

// Parse args
const args = process.argv.slice(2);
const opts = {
  context: null,
  portal: null,
  includeMemory: false,
  includeBrags: false,
  diff: false,
  dryRun: false,
  json: false,
  quiet: false,
  help: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const next = args[i + 1];

  switch (arg) {
    case '--help':
      opts.help = true;
      break;
    case '--context':
      opts.context = next;
      i++;
      break;
    case '--portal':
      opts.portal = next;
      i++;
      break;
    case '--include-memory':
      opts.includeMemory = true;
      break;
    case '--include-brags':
      opts.includeBrags = true;
      break;
    case '--diff':
      opts.diff = true;
      break;
    case '--dry-run':
      opts.dryRun = true;
      break;
    case '--json':
      opts.json = true;
      break;
    case '--quiet':
      opts.quiet = true;
      break;
    default:
      console.error(`Unknown option: ${arg}`);
      process.exit(2);
  }
}

// Help
if (opts.help) {
  const help = readFileSync(__filename, 'utf-8')
    .split('\n')
    .slice(3, 37)
    .map((line) => line.replace(/^ \* ?/, ''))
    .join('\n');
  console.log(help);
  process.exit(0);
}

// Validation
if (!opts.context) {
  error('--context is required', 2);
}
if (!opts.portal) {
  error('--portal is required', 2);
}

const validPortals = ['claude', 'gemini', 'copilot', 'all'];
if (!validPortals.includes(opts.portal)) {
  error(`--portal must be one of: ${validPortals.join(', ')}`, 2);
}

// Logging helpers
function log(...args) {
  if (!opts.json && !opts.quiet) console.log(...args);
}

function error(message, code) {
  if (opts.json) {
    console.error(JSON.stringify({ error: message }, null, 2));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(code);
}

// Hash helper
function hashContent(content) {
  return createHash('sha256').update(content).digest('hex');
}

// Load portal limits
function loadPortalLimits() {
  if (!existsSync(PORTAL_LIMITS_PATH)) {
    error(`Portal limits file not found: ${PORTAL_LIMITS_PATH}`, 1);
  }
  return JSON.parse(readFileSync(PORTAL_LIMITS_PATH, 'utf-8'));
}

// Load contexts
function loadContexts() {
  if (!existsSync(CONTEXTS_PATH)) {
    error(`Contexts file not found: ${CONTEXTS_PATH}`, 1);
  }
  const data = JSON.parse(readFileSync(CONTEXTS_PATH, 'utf-8'));
  return data.contexts;
}

// Validate context exists
function validateContext(contextName, contexts) {
  if (contextName === 'Global') return true;
  return contexts.some((c) => c.name === contextName);
}

// Import extractFrontmatter from mini-yaml
function extractFrontmatter(content) {
  const lines = content.split('\n');

  if (lines[0] !== '---') {
    return { frontmatter: null, body: content, error: null };
  }

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) {
    return { frontmatter: null, body: content, error: 'Unclosed frontmatter' };
  }

  const yamlLines = lines.slice(1, endIdx);
  const body = lines.slice(endIdx + 1).join('\n');

  // Parse YAML (minimal - scalars and lists only)
  const frontmatter = {};
  for (const line of yamlLines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    // Handle flow sequences [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }

    frontmatter[key] = value;
  }

  return { frontmatter, body, error: null };
}

// Read skill frontmatter and body
function readSkill(skillName) {
  const skillPath = join(SKILLS_DIR, skillName, 'SKILL.md');
  if (!existsSync(skillPath)) {
    return null;
  }

  const content = readFileSync(skillPath, 'utf-8');
  const { frontmatter, body, error } = extractFrontmatter(content);

  if (error) {
    return null;
  }

  return { frontmatter: frontmatter || {}, body, skillName };
}

// Get all skills for a context
function getSkillsForContext(contextName, contexts) {
  const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const skills = [];

  for (const skillName of skillDirs) {
    const skill = readSkill(skillName);
    if (!skill) continue;

    const { frontmatter } = skill;
    const skillContexts = frontmatter.contexts;

    // Skip persona skills
    if (frontmatter.type === 'persona') continue;

    // Check if skill belongs to this context
    if (contextName === 'Global') {
      // Global includes everything
      skills.push(skill);
    } else if (skillContexts === 'all') {
      skills.push(skill);
    } else if (Array.isArray(skillContexts) && skillContexts.includes(contextName)) {
      skills.push(skill);
    }
  }

  return skills;
}

// Read persona files
function readPersona(condensed = false) {
  if (condensed) {
    // Condensed variant: only identity and conciseness mandate
    const identity = readFileSync(join(PERSONA_DIR, 'identity.md'), 'utf-8').trim();

    // Extract just the conciseness mandate from operating-rules
    const operatingRules = readFileSync(join(PERSONA_DIR, 'operating-rules.md'), 'utf-8').trim();
    const concisenessSectionMatch = operatingRules.match(/## Communication mandate[\s\S]*?(?=\n## |$)/);
    const concisenessMandate = concisenessSectionMatch ? concisenessSectionMatch[0] : '';

    // Extract skill routing section (essential for how EDWIN works)
    const skillRoutingMatch = operatingRules.match(/## Skill routing[\s\S]*?(?=\n## |$)/);
    const skillRouting = skillRoutingMatch ? skillRoutingMatch[0] : '';

    return `${identity}\n\n---\n\n${concisenessMandate}\n\n${skillRouting}`.trim();
  }

  // Full variant
  const personaFiles = [
    join(PERSONA_DIR, 'identity.md'),
    join(PERSONA_DIR, 'operating-rules.md'),
    join(PERSONA_DIR, 'harness-detection.md'),
  ];

  // Add hooks
  const hooksDir = join(PERSONA_DIR, 'hooks');
  if (existsSync(hooksDir)) {
    const hookFiles = readdirSync(hooksDir)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => join(hooksDir, f));
    personaFiles.push(...hookFiles);
  }

  return personaFiles
    .filter((f) => existsSync(f))
    .map((f) => readFileSync(f, 'utf-8').trim())
    .join('\n\n---\n\n');
}

// Build skill index markdown
function buildSkillIndex(skills, condensed = false) {
  const lines = [];

  for (const skill of skills) {
    const name = skill.frontmatter.name || skill.skillName;
    const description = skill.frontmatter.description || '';

    if (condensed) {
      // Condensed: one line per skill, name only
      lines.push(`- ${name}`);
    } else {
      // Full: name + description
      lines.push(`**${name}** — ${description}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// Apply degradation rewrites to skill body
function applyDegradation(skillBody, portalName) {
  let rewritten = skillBody;

  // Remove script hooks section entirely
  rewritten = rewritten.replace(/## Optional script hooks[\s\S]*?(?=\n## |$)/g, '');

  // Rewrite shell invocations in Instructions section to file-tools fallback
  // Pattern: look for "Shell available:" / "File tools available" pairs and remove shell instructions
  const shellPattern = /\*\*Shell available:\*\* [^\n]+\n\n\*\*File tools available[^\n]*:\*\*/g;
  rewritten = rewritten.replace(shellPattern, '**File tools:**');

  // Remove standalone shell-only instructions
  const shellOnlyPattern = /\*\*Shell available:\*\* [^\n]+\n(?!\n\*\*File tools)/g;
  rewritten = rewritten.replace(shellOnlyPattern, '');

  // Rewrite scheduling references
  rewritten = rewritten.replace(/scheduled task|OS scheduler|launchd|schtasks|cron/gi, 'calendar reminder');

  // Add portal degradation notice at top of skill body
  const notice = `> **Portal mode:** This skill is running in ${portalName}. Shell scripts and OS scheduling are unavailable. File operations use browser-based prompts.\n\n`;

  return notice + rewritten.trim();
}

// Read memory digest
function readMemoryDigest() {
  if (!existsSync(MEMORY_DIGEST_PATH)) {
    return { content: null, found: false };
  }
  return { content: readFileSync(MEMORY_DIGEST_PATH, 'utf-8').trim(), found: true };
}

// Read brags
function readBrags() {
  if (!existsSync(BRAGS_PATH)) {
    return { content: null, found: false };
  }

  const content = readFileSync(BRAGS_PATH, 'utf-8').trim();
  return { content, found: true };
}

// Compose instructions for a portal
function composeInstructions(contextName, portalName, skills, includePersonalData, condensed = false, supportsKnowledgeFiles = false) {
  const version = readFileSync(VERSION_PATH, 'utf-8').trim();
  const persona = readPersona(condensed);
  const skillIndex = buildSkillIndex(skills, condensed);
  const variantLabel = condensed ? ' (condensed)' : '';
  const messages = [];

  let instructions = `# EDWIN\n\nEDWIN v${version} · exported for ${portalName} · context: **${contextName}**${variantLabel}\n\n`;

  // Personal data watermark and messages
  let hasPersonalData = false;

  if (includePersonalData.memory) {
    const { content, found } = readMemoryDigest();
    if (found) {
      hasPersonalData = true;
    } else {
      messages.push('--include-memory specified but no memory digest found at user/memory/digest.md — memory not included');
    }
  }

  if (includePersonalData.brags) {
    const { content, found } = readBrags();
    if (found) {
      hasPersonalData = true;
    } else {
      messages.push('--include-brags specified but no brags found at user/brags/brags.md — brags not included');
    }
  }

  if (hasPersonalData) {
    instructions += `> ⚠️ **PERSONAL DATA INCLUDED** — This bundle contains personal information. Paste only into your own account.\n\n`;
  }

  instructions += `${persona}\n\n---\n\n## Installed skills\n\n${skillIndex}\n\n---\n\n`;

  // Skill bodies: inline only if knowledge files are NOT supported and NOT condensed
  // When knowledge files ARE supported, bodies go to knowledge/ only
  if (!condensed && !supportsKnowledgeFiles) {
    for (const skill of skills) {
      const name = skill.frontmatter.name || skill.skillName;
      const degraded = applyDegradation(skill.body, portalName);
      instructions += `## Skill: ${name}\n\n${degraded}\n\n---\n\n`;
    }
  } else if (!condensed && supportsKnowledgeFiles) {
    // Add note that full skill instructions are in knowledge files
    instructions += `## Skill instructions\n\n`;
    instructions += `Full instructions for each skill are provided in the uploaded knowledge files. `;
    instructions += `When the user's request matches a skill's description in the index above, `;
    instructions += `consult that skill's knowledge file for complete methodology and examples.\n\n---\n\n`;
  }

  // Append memory if requested and found
  if (includePersonalData.memory) {
    const { content, found } = readMemoryDigest();
    if (found) {
      instructions += `## Memory\n\n${content}\n\n---\n\n`;
    }
  }

  // Append brags if requested and found
  if (includePersonalData.brags) {
    const { content, found } = readBrags();
    if (found) {
      instructions += `## Achievements\n\n${content}\n\n---\n\n`;
    }
  }

  return { instructions: instructions.trim(), messages };
}

// Generate bundle for a portal
function generateBundle(contextName, portalName, portalConfig, skills) {
  const includePersonalData = {
    memory: opts.includeMemory,
    brags: opts.includeBrags,
  };

  const limit = portalConfig.instructionLimit;
  const hasLimit = limit !== null && limit !== undefined;
  const supportsKnowledgeFiles = portalConfig.supportsKnowledgeFiles;

  // Try standard variant first
  let composed = composeInstructions(contextName, portalConfig.name, skills, includePersonalData, false, supportsKnowledgeFiles);
  let finalInstructions = composed.instructions;
  let variant = 'standard';
  let success = true;
  let messages = composed.messages || [];

  // If limit is known and exceeded, try condensed variant
  if (hasLimit && finalInstructions.length > limit) {
    const condensedComposed = composeInstructions(contextName, portalConfig.name, skills, includePersonalData, true, supportsKnowledgeFiles);
    finalInstructions = condensedComposed.instructions;
    variant = 'condensed';
    messages = condensedComposed.messages || [];

    // If still oversized, fail this portal
    if (finalInstructions.length > limit) {
      success = false;
    }
  }

  const result = {
    portal: portalName,
    context: contextName,
    instructionsSize: finalInstructions.length,
    instructionsLimit: limit,
    limitKnown: hasLimit,
    variant,
    withinLimit: !hasLimit || finalInstructions.length <= limit,
    success,
    messages,
    hash: hashContent(finalInstructions),
  };

  // Write files
  const bundleDir = join(BUNDLES_DIR, portalName, contextName);
  if (!opts.dryRun) {
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(join(bundleDir, 'instructions.txt'), finalInstructions, 'utf-8');

    // Write failure manifest if oversized
    if (!success) {
      const manifest = `# Bundle Generation Failed\n\n` +
        `This bundle FAILED to fit within ${portalConfig.name}'s ${limit}-character limit.\n\n` +
        `**Attempted variants:**\n` +
        `- Standard: would be ${composed.instructions.length} chars\n` +
        `- Condensed: ${finalInstructions.length} chars\n` +
        `- Limit: ${limit} chars\n` +
        `- Overage: ${finalInstructions.length - limit} chars\n\n` +
        `**This portal cannot accommodate EDWIN for the "${contextName}" context.**\n\n` +
        `**Options:**\n` +
        `- Use a portal with an unknown or larger limit (Claude Projects, Gemini Gems)\n` +
        `- Export a narrower context with fewer skills\n` +
        `- Reduce persona text manually\n`;
      writeFileSync(join(bundleDir, 'FAILURE_MANIFEST.md'), manifest, 'utf-8');
    } else if (variant === 'condensed') {
      // Write note about condensed variant
      const note = `# Condensed Variant\n\n` +
        `This bundle uses the **condensed variant** to fit within ${portalConfig.name}'s ${limit}-character limit.\n\n` +
        `**Condensed changes:**\n` +
        `- Persona compressed to identity + conciseness mandate + skill routing only\n` +
        `- Skill index shows names only (no descriptions)\n` +
        `- Skill bodies omitted\n` +
        `- Size: ${finalInstructions.length} chars (limit: ${limit})\n\n` +
        `For full skill bodies, use a portal with a larger limit (Claude Projects, Gemini Gems).`;
      writeFileSync(join(bundleDir, 'CONDENSED_VARIANT.md'), note, 'utf-8');
    }

    // Generate knowledge files if portal supports them (only for standard variant)
    if (portalConfig.supportsKnowledgeFiles && variant === 'standard') {
      const knowledgeDir = join(bundleDir, 'knowledge');
      mkdirSync(knowledgeDir, { recursive: true });

      for (const skill of skills) {
        const skillName = skill.frontmatter.name || skill.skillName;
        const degraded = applyDegradation(skill.body, portalConfig.name);
        const skillFile = `${skillName}.md`;
        writeFileSync(join(knowledgeDir, skillFile), degraded, 'utf-8');
      }

      result.knowledgeFilesGenerated = skills.length;
    }
  }

  result.outputPath = bundleDir;
  return result;
}

// Load manifest
function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    return { bundles: {} };
  }
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
}

// Save manifest
function saveManifest(manifest) {
  if (opts.dryRun) return;
  mkdirSync(DIST_DIR, { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

// Check if bundle is stale
function isBundleStale(portalName, contextName, currentHash, manifest) {
  const key = `${portalName}:${contextName}`;
  const recorded = manifest.bundles[key];
  return !recorded || recorded.hash !== currentHash;
}

// Main generation
function main() {
  const contexts = loadContexts();
  const portalLimits = loadPortalLimits();

  // Validate context
  if (!validateContext(opts.context, contexts)) {
    error(`Unknown context: ${opts.context}`, 1);
  }

  // Get skills for context
  const skills = getSkillsForContext(opts.context, contexts);

  if (skills.length === 0) {
    error(`No skills found for context: ${opts.context}`, 1);
  }

  // Determine portals to generate
  const portalsToGenerate = opts.portal === 'all'
    ? ['claude', 'gemini', 'copilot']
    : [opts.portal];

  const results = [];
  const manifest = loadManifest();

  for (const portalName of portalsToGenerate) {
    const portalConfig = portalLimits.portals[portalName];
    if (!portalConfig) {
      error(`Unknown portal: ${portalName}`, 1);
    }

    // Generate bundle
    const result = generateBundle(opts.context, portalName, portalConfig, skills);

    // Check staleness in --diff mode
    if (opts.diff) {
      result.stale = isBundleStale(portalName, opts.context, result.hash, manifest);
    }

    // Update manifest
    const key = `${portalName}:${opts.context}`;
    manifest.bundles[key] = {
      hash: result.hash,
      generatedAt: new Date().toISOString(),
      skillCount: skills.length,
      variant: result.variant,
      success: result.success,
    };

    results.push(result);
  }

  saveManifest(manifest);

  // Output
  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    formatOutput(results);
  }

  // Report staleness in --diff mode
  if (opts.diff) {
    const stale = results.filter((r) => r.stale);
    if (stale.length > 0) {
      log('\n## Stale bundles regenerated:');
      for (const r of stale) {
        log(`- ${r.portal}:${r.context}`);
      }
      log('\n## Re-paste steps:');
      for (const r of stale) {
        log(`\n### ${r.portal}:${r.context}`);
        log(`1. Open ${r.portal} and navigate to your EDWIN ${r.context} configuration`);
        log(`2. Paste contents of: ${r.outputPath}/instructions.txt`);
        if (r.knowledgeFilesGenerated) {
          log(`3. Upload files from: ${r.outputPath}/knowledge/`);
        }
      }
    } else {
      log('All bundles up to date.');
    }
  }

  // Exit 1 if any bundle failed
  const anyFailed = results.some((r) => !r.success);
  process.exit(anyFailed ? 1 : 0);
}

// Format output
function formatOutput(results) {
  if (opts.dryRun) {
    log('Dry run — no files written.\n');
  }

  const anyFailed = results.some((r) => !r.success);

  for (const result of results) {
    const mark = result.success ? '✓' : '✗';
    const limitDisplay = result.limitKnown ? result.instructionsLimit : 'unknown';

    log(`${mark} ${result.portal}:${result.context}`);
    log(`  Instructions: ${result.instructionsSize} / ${limitDisplay} chars`);

    if (!result.limitKnown) {
      log(`  ⚠️  Portal limit UNKNOWN — check it fits before relying on this bundle`);
    }

    if (!result.success) {
      const overage = result.instructionsSize - result.instructionsLimit;
      log(`  ✗ FAILED: exceeds limit by ${overage} chars — see ${result.outputPath}/FAILURE_MANIFEST.md`);
    } else if (result.variant === 'condensed') {
      log(`  ⚠️  CONDENSED VARIANT — see ${result.outputPath}/CONDENSED_VARIANT.md`);
    }

    if (result.knowledgeFilesGenerated) {
      log(`  Knowledge files: ${result.knowledgeFilesGenerated}`);
    }

    // Print messages (e.g., missing personal data)
    if (result.messages && result.messages.length > 0) {
      for (const msg of result.messages) {
        log(`  ℹ️  ${msg}`);
      }
    }

    log(`  Output: ${result.outputPath}`);
    log('');
  }

  if (!opts.dryRun) {
    if (anyFailed) {
      log('✗ Some bundles FAILED to fit within their portal limits.');
    } else {
      log('✓ Done. All bundles generated successfully.');
    }
  }
}

main();
