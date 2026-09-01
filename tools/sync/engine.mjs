#!/usr/bin/env node

/**
 * engine.mjs
 *
 * EDWIN sync engine — installs/updates EDWIN into Claude harness(es).
 *
 * Responsibilities:
 *   - Compose CLAUDE.md from persona + template + skill index
 *   - Copy skills into target skills directories
 *   - Track installed skills via manifest (~/.edwin/installed.json)
 *   - Prune skills that were removed from core/skills/
 *   - Clean up legacy v0.1 uppercase SKILLS/ directory
 *   - Respect managed markers — never overwrite user content
 *
 * Usage:
 *   node tools/sync/engine.mjs [options]
 *
 * Options:
 *   --target <code|desktop|all>    Target harness (default: all)
 *   --create-target                Create ~/.claude if absent instead of failing
 *   --dry-run                      Show what would be done without changing anything
 *   --uninstall                    Remove EDWIN-managed content
 *   --force                        Overwrite files without checking
 *   --home <dir>                   Override home directory (for testing)
 *   --json                         Output JSON result only
 *   --quiet                        Minimal output
 *   --help                         Show this help
 *
 * Exit codes:
 *   0 - Success
 *   1 - Expected failure
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
  copyFileSync,
} from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { homedir } from 'os';
import {
  getTargets,
  getLegacySkillsDir,
  getEdwinStateDir,
  getManifestPath,
} from './targets.mjs';
import { extractFrontmatter } from '../validate/lib/mini-yaml.mjs';

// Node version check
const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
if (nodeMajor < 18) {
  console.error(`Error: Node.js >= 18 required. You have ${process.version}.`);
  process.exit(2);
}

// Resolve repo root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..', '..');

// Parse args
const args = process.argv.slice(2);
const opts = {
  target: 'all',
  createTarget: false,
  dryRun: false,
  uninstall: false,
  force: false,
  homeOverride: null,
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
    case '--target':
      opts.target = next;
      i++;
      break;
    case '--create-target':
      opts.createTarget = true;
      break;
    case '--dry-run':
      opts.dryRun = true;
      break;
    case '--uninstall':
      opts.uninstall = true;
      break;
    case '--force':
      opts.force = true;
      break;
    case '--home':
      opts.homeOverride = next;
      i++;
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
    .slice(3, 33)
    .map((line) => line.replace(/^ \* ?/, ''))
    .join('\n');
  console.log(help);
  process.exit(0);
}

// Validation
const validTargets = ['code', 'desktop', 'all'];
if (!validTargets.includes(opts.target)) {
  error(`--target must be one of: ${validTargets.join(', ')}`, 2);
}

// Home directory (for testing override)
const HOME_DIR = opts.homeOverride || homedir();

// Repo paths
const CORE_DIR = join(REPO_ROOT, 'core');
const PERSONA_DIR = join(CORE_DIR, 'persona');
const SKILLS_DIR = join(CORE_DIR, 'skills');
const TEMPLATES_DIR = join(CORE_DIR, 'templates');
const TEMPLATE_PATH = join(TEMPLATES_DIR, 'CLAUDE.md.tmpl');
const VERSION_PATH = join(CORE_DIR, 'VERSION');
const CONTEXTS_PATH = join(CORE_DIR, 'contexts', 'contexts.json');
const USER_DIR = join(REPO_ROOT, 'user');
const CONFIG_PATH = join(USER_DIR, 'config.json');
const STATE_PATH = join(USER_DIR, 'state.json');

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

// Hash helper for content comparison
function hashContent(content) {
  return createHash('sha256').update(content).digest('hex');
}

// Recursive directory copy
function copyDirRecursive(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// Read YAML frontmatter from a skill file
function readSkillFrontmatter(skillPath) {
  try {
    const content = readFileSync(skillPath, 'utf-8');
    const { frontmatter, error } = extractFrontmatter(content);

    if (error) {
      // Parser rejected it - this is malformed YAML
      return null;
    }

    return frontmatter;
  } catch {
    return null;
  }
}

// Build skill index grouped by context
function buildSkillIndex() {
  const skills = [];
  const needsMigration = [];

  const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter(
    (e) => e.isDirectory()
  );

  for (const skillDir of skillDirs) {
    const skillPath = join(SKILLS_DIR, skillDir.name, 'SKILL.md');
    if (!existsSync(skillPath)) continue;

    const frontmatter = readSkillFrontmatter(skillPath);

    if (!frontmatter) {
      // No frontmatter — treat as contexts: all, name = folder name
      needsMigration.push(skillDir.name);
      skills.push({
        name: skillDir.name,
        description: `[Migration needed: ${skillDir.name}]`,
        contexts: 'all',
        type: null,
      });
      continue;
    }

    skills.push({
      name: frontmatter.name || skillDir.name,
      description: frontmatter.description || '',
      contexts: frontmatter.contexts || 'all',
      type: frontmatter.type || null,
    });
  }

  return { skills, needsMigration };
}

// Group skills by context
function groupSkills(skills, activeContext) {
  const contextsData = existsSync(CONTEXTS_PATH)
    ? JSON.parse(readFileSync(CONTEXTS_PATH, 'utf-8'))
    : { contexts: [] };

  const contextNames = contextsData.contexts.map((c) => c.name);
  const groups = {};

  // Initialize groups
  for (const ctx of contextNames) {
    groups[ctx] = [];
  }
  groups['Always available'] = [];
  groups['Personas'] = [];

  // Sort skills into groups
  for (const skill of skills) {
    if (skill.type === 'persona') {
      groups['Personas'].push(skill);
      continue;
    }

    if (skill.contexts === 'all') {
      groups['Always available'].push(skill);
      continue;
    }

    const skillContexts = Array.isArray(skill.contexts)
      ? skill.contexts
      : [skill.contexts];

    for (const ctx of skillContexts) {
      if (groups[ctx]) {
        groups[ctx].push(skill);
      }
    }
  }

  // Order: active context first, then others, then "Always available", then "Personas"
  const orderedGroups = [];

  if (activeContext && groups[activeContext] && groups[activeContext].length > 0) {
    orderedGroups.push({ name: activeContext, skills: groups[activeContext] });
  }

  for (const ctx of contextNames) {
    if (ctx !== activeContext && groups[ctx].length > 0) {
      orderedGroups.push({ name: ctx, skills: groups[ctx] });
    }
  }

  if (groups['Always available'].length > 0) {
    orderedGroups.push({
      name: 'Always available',
      skills: groups['Always available'],
    });
  }

  if (groups['Personas'].length > 0) {
    orderedGroups.push({ name: 'Personas', skills: groups['Personas'] });
  }

  return orderedGroups;
}

// Format skill index as markdown
function formatSkillIndex(groups) {
  const lines = [];

  for (const group of groups) {
    lines.push(`### ${group.name}`);
    lines.push('');

    for (const skill of group.skills) {
      lines.push(`**${skill.name}** — ${skill.description}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// Compose CLAUDE.md from template
function composeCLAUDEMd() {
  // Read template
  const template = readFileSync(TEMPLATE_PATH, 'utf-8');

  // Strip header comment (everything between {{!-- and --}} on its own line)
  // Use a more specific pattern to avoid matching --}} in explanatory text
  const templateBody = template.replace(/\{\{!--[\s\S]*?^--\}\}\s*$/gm, '').trim();

  // Read persona files in order
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

  const personaBody = personaFiles
    .map((f) => readFileSync(f, 'utf-8').trim())
    .join('\n\n---\n\n');

  // Build skill index
  const { skills, needsMigration } = buildSkillIndex();

  // Read active context from state
  let activeContext = 'Global';
  let addressAs = '';

  if (existsSync(STATE_PATH)) {
    const state = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    activeContext = state.activeContext || 'Global';
  }

  if (existsSync(CONFIG_PATH)) {
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    addressAs = config.addressAs || '';
  }

  const groups = groupSkills(skills, activeContext);
  const skillIndex = formatSkillIndex(groups);

  // Read version
  const version = readFileSync(VERSION_PATH, 'utf-8').trim();

  // Timestamp
  const lastSync = new Date().toISOString();

  // Read memory digest if available
  const digestPath = join(USER_DIR, 'memory', 'digest.md');
  let memoryDigest = '';
  if (existsSync(digestPath)) {
    memoryDigest = readFileSync(digestPath, 'utf-8').trim();
  }

  // Substitute tokens
  let composed = templateBody
    .replace(/\{\{PERSONA_BODY\}\}/g, personaBody)
    .replace(/\{\{SKILL_INDEX\}\}/g, skillIndex)
    .replace(/\{\{ACTIVE_CONTEXT\}\}/g, activeContext)
    .replace(/\{\{FRAMEWORK_VERSION\}\}/g, version)
    .replace(/\{\{LAST_SYNC\}\}/g, lastSync)
    .replace(/\{\{MEMORY_DIGEST\}\}/g, memoryDigest);

  // Handle ADDRESS_AS: if empty, remove the sentence containing it
  if (!addressAs) {
    composed = composed
      .split('\n')
      .filter((line) => !line.includes('{{ADDRESS_AS}}'))
      .join('\n');
  } else {
    composed = composed.replace(/\{\{ADDRESS_AS\}\}/g, addressAs);
  }

  return { composed, needsMigration };
}

// Extract content between markers
function extractBetweenMarkers(content, beginMarker, endMarker) {
  const beginIdx = content.indexOf(beginMarker);
  const endIdx = content.indexOf(endMarker);

  if (beginIdx === -1 || endIdx === -1) {
    return null;
  }

  return content.slice(beginIdx + beginMarker.length, endIdx).trim();
}

// Inject composed CLAUDE.md into target with managed markers
function injectCLAUDEMd(targetPath, composedContent) {
  const beginMarker = '<!-- EDWIN:BEGIN -->';
  const endMarker = '<!-- EDWIN:END -->';
  const memoryBegin = '<!-- EDWIN:MEMORY:BEGIN -->';
  const memoryEnd = '<!-- EDWIN:MEMORY:END -->';
  const contextBegin = '<!-- EDWIN:CONTEXT:BEGIN -->';
  const contextEnd = '<!-- EDWIN:CONTEXT:END -->';

  let existing = '';
  let existingMemory = '';
  let existingContext = '';

  if (existsSync(targetPath)) {
    existing = readFileSync(targetPath, 'utf-8');

    // Preserve MEMORY and CONTEXT sections
    existingMemory =
      extractBetweenMarkers(existing, memoryBegin, memoryEnd) || '';
    existingContext =
      extractBetweenMarkers(existing, contextBegin, contextEnd) || '';

    // Check if markers exist
    const hasMarkers =
      existing.includes(beginMarker) && existing.includes(endMarker);

    if (hasMarkers) {
      // Replace only between markers
      const beforeMarker = existing.slice(0, existing.indexOf(beginMarker));
      const afterMarker =
        existing.slice(existing.indexOf(endMarker) + endMarker.length);

      // Restore preserved sections
      let finalComposed = composedContent;
      if (existingMemory) {
        finalComposed = finalComposed.replace(
          new RegExp(`${memoryBegin}\\s*${memoryEnd}`),
          `${memoryBegin}\n${existingMemory}\n${memoryEnd}`
        );
      }
      if (existingContext) {
        finalComposed = finalComposed.replace(
          new RegExp(`${contextBegin}\\s*${contextEnd}`),
          `${contextBegin}\n${existingContext}\n${contextEnd}`
        );
      }

      return (
        beforeMarker + beginMarker + '\n' + finalComposed + '\n' + endMarker + afterMarker
      );
    } else {
      // Append markers at end
      return (
        existing +
        '\n\n' +
        beginMarker +
        '\n' +
        composedContent +
        '\n' +
        endMarker +
        '\n'
      );
    }
  } else {
    // New file or --force
    return beginMarker + '\n' + composedContent + '\n' + endMarker + '\n';
  }
}

// Update just the MEMORY section (for WU-17)
export function updateMemorySection(targetPath, memoryContent) {
  if (!existsSync(targetPath)) {
    throw new Error(`CLAUDE.md does not exist at ${targetPath}`);
  }

  const memoryBegin = '<!-- EDWIN:MEMORY:BEGIN -->';
  const memoryEnd = '<!-- EDWIN:MEMORY:END -->';

  let content = readFileSync(targetPath, 'utf-8');

  const beginIdx = content.indexOf(memoryBegin);
  const endIdx = content.indexOf(memoryEnd);

  if (beginIdx === -1 || endIdx === -1) {
    throw new Error('MEMORY markers not found in CLAUDE.md');
  }

  const before = content.slice(0, beginIdx + memoryBegin.length);
  const after = content.slice(endIdx);

  const updated = before + '\n' + memoryContent + '\n' + after;
  writeFileSync(targetPath, updated, 'utf-8');
}

// Copy tools directory to target
function syncTools(target, manifest) {
  const results = {
    changed: false,
    skipped: false,
  };

  const TOOLS_DIR = join(REPO_ROOT, 'tools');
  const targetToolsDir = join(dirname(target.skillsDir), 'tools');

  // Hash the source tools directory
  const srcHash = hashDirectory(TOOLS_DIR);

  // Check if already installed with same hash
  const existingHash = manifest.tools?.hash;

  if (existingHash === srcHash && existsSync(targetToolsDir)) {
    results.skipped = true;
    return results;
  }

  // Ensure parent directory exists and copy tools
  if (!opts.dryRun) {
    mkdirSync(dirname(targetToolsDir), { recursive: true });
    copyDirRecursive(TOOLS_DIR, targetToolsDir);
  }

  manifest.tools = { hash: srcHash };
  results.changed = true;

  return results;
}

// Copy skills to target
function syncSkills(target, manifest) {
  const results = {
    copied: [],
    updated: [],
    skipped: [],
    pruned: [],
  };

  const targetSkillsDir = target.skillsDir;

  // Ensure target directory exists
  if (!opts.dryRun) {
    mkdirSync(targetSkillsDir, { recursive: true });
  }

  // Get current skills
  const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  // Copy/update each skill
  for (const skillName of skillDirs) {
    const srcDir = join(SKILLS_DIR, skillName);
    const destDir = join(targetSkillsDir, skillName);

    // Hash the source directory content
    const srcHash = hashDirectory(srcDir);

    // Check if already installed with same hash
    const existingHash = manifest.skills[skillName]?.hash;

    if (existingHash === srcHash && existsSync(destDir)) {
      results.skipped.push(skillName);
      continue;
    }

    if (!opts.dryRun) {
      copyDirRecursive(srcDir, destDir);
    }

    if (existingHash) {
      results.updated.push(skillName);
    } else {
      results.copied.push(skillName);
    }

    manifest.skills[skillName] = { hash: srcHash };
  }

  // Prune removed skills
  const manifestSkills = Object.keys(manifest.skills);
  for (const skillName of manifestSkills) {
    if (!skillDirs.includes(skillName)) {
      const destDir = join(targetSkillsDir, skillName);
      if (existsSync(destDir) && !opts.dryRun) {
        rmSync(destDir, { recursive: true, force: true });
      }
      results.pruned.push(skillName);
      delete manifest.skills[skillName];
    }
  }

  return results;
}

// Hash a directory recursively
function hashDirectory(dir) {
  const hash = createHash('sha256');

  function hashDir(d) {
    const entries = readdirSync(d, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    for (const entry of entries) {
      const fullPath = join(d, entry.name);
      const relPath = relative(dir, fullPath);

      if (entry.isDirectory()) {
        hash.update(`dir:${relPath}\n`);
        hashDir(fullPath);
      } else {
        hash.update(`file:${relPath}\n`);
        const content = readFileSync(fullPath);
        hash.update(content);
      }
    }
  }

  hashDir(dir);
  return hash.digest('hex');
}

// Load or initialize manifest
function loadManifest() {
  const manifestPath = getManifestPath(HOME_DIR);
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    // Ensure tools field exists for backwards compatibility
    if (!manifest.tools) {
      manifest.tools = null;
    }
    return manifest;
  }

  return {
    schemaVersion: 1,
    version: null,
    lastSync: null,
    targets: [],
    skills: {},
    tools: null,
  };
}

// Save manifest
function saveManifest(manifest) {
  if (opts.dryRun) return;

  const edwinStateDir = getEdwinStateDir(HOME_DIR);
  const manifestPath = getManifestPath(HOME_DIR);
  mkdirSync(edwinStateDir, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

// Clean up legacy SKILLS/ directory
function cleanupLegacy() {
  const legacySkillsDir = getLegacySkillsDir(HOME_DIR);

  if (!existsSync(legacySkillsDir)) {
    return { found: false };
  }

  // Check if it's the same as skills/ (case-insensitive filesystem)
  const skillsDir = join(HOME_DIR, '.claude', 'skills');
  try {
    const legacyStat = statSync(legacySkillsDir);
    const currentStat = existsSync(skillsDir) ? statSync(skillsDir) : null;

    if (
      currentStat &&
      legacyStat.ino === currentStat.ino &&
      legacyStat.dev === currentStat.dev
    ) {
      // Same directory (case-insensitive FS) - SKILLS doesn't really exist as distinct
      return { found: false };
    }
  } catch {
    // Ignore stat errors
  }

  // Check if it contains EDWIN skills
  const manifest = loadManifest();
  const edwinSkills = Object.keys(manifest.skills);

  if (edwinSkills.length === 0) {
    return { found: true, noManifest: true };
  }

  const legacyDirs = readdirSync(legacySkillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const hasEdwinSkills = edwinSkills.some((s) => legacyDirs.includes(s));

  if (!hasEdwinSkills) {
    return { found: true, noEdwinSkills: true };
  }

  // Automatically clean EDWIN skills from legacy directory
  if (!opts.dryRun) {
    for (const skill of edwinSkills) {
      const legacyPath = join(legacySkillsDir, skill);
      if (existsSync(legacyPath)) {
        rmSync(legacyPath, { recursive: true, force: true });
      }
    }
    return { found: true, cleaned: true, skills: edwinSkills };
  }

  // Dry-run: report what would be cleaned (EDWIN skills that exist in legacy)
  const skillsToClean = edwinSkills.filter(s => legacyDirs.includes(s));
  return { found: true, canClean: true, skills: skillsToClean };
}

// Uninstall
function uninstall(target) {
  const results = {
    skillsRemoved: [],
    toolsRemoved: false,
    markerRemoved: false,
    manifestCleared: false,
  };

  const manifest = loadManifest();

  // Remove tools directory
  const targetToolsDir = join(dirname(target.skillsDir), 'tools');
  if (existsSync(targetToolsDir) && !opts.dryRun) {
    rmSync(targetToolsDir, { recursive: true, force: true });
    results.toolsRemoved = true;
  }

  // Remove skills
  const skillsToRemove = Object.keys(manifest.skills);
  for (const skillName of skillsToRemove) {
    const destDir = join(target.skillsDir, skillName);
    if (existsSync(destDir) && !opts.dryRun) {
      rmSync(destDir, { recursive: true, force: true });
      results.skillsRemoved.push(skillName);
    }
  }

  // Remove EDWIN marker block from CLAUDE.md
  if (existsSync(target.claudeMdPath)) {
    const content = readFileSync(target.claudeMdPath, 'utf-8');
    const beginMarker = '<!-- EDWIN:BEGIN -->';
    const endMarker = '<!-- EDWIN:END -->';

    if (content.includes(beginMarker) && content.includes(endMarker)) {
      const beforeMarker = content.slice(0, content.indexOf(beginMarker));
      const afterMarker =
        content.slice(content.indexOf(endMarker) + endMarker.length);

      if (!opts.dryRun) {
        writeFileSync(target.claudeMdPath, beforeMarker + afterMarker, 'utf-8');
      }
      results.markerRemoved = true;
    }
  }

  // Clear manifest
  if (!opts.dryRun) {
    manifest.skills = {};
    manifest.tools = null;
    manifest.targets = [];
    saveManifest(manifest);
  }
  results.manifestCleared = true;

  return results;
}

// Main sync operation
function sync(target) {
  const results = {
    target: target.label,
    detected: target.detected,
    targetCreated: null,
    coworkDetected: target.coworkDetected,
    claudeMd: {},
    tools: {},
    skills: {},
    legacy: {},
    needsMigration: [],
  };

  // A missing ~/.claude normally means the harness isn't installed, and installing into a
  // directory nothing reads is worse than saying so. The double-click installers are the
  // exception: they run on machines where Claude may not have been started yet, and dying
  // here after cloning the repository leaves the user with nothing. They pass
  // --create-target. It stays opt-in so a mistyped --home cannot silently populate a
  // directory the user never meant to create.
  if (!target.detected) {
    const claudeRoot = join(HOME_DIR, '.claude');
    if (!opts.createTarget) {
      results.error = `${target.label} directory not found at ${claudeRoot}`;
      return results;
    }
    if (!opts.dryRun) {
      mkdirSync(claudeRoot, { recursive: true });
    }
    results.targetCreated = claudeRoot;
  }

  // Load manifest
  const manifest = loadManifest();

  // Uninstall mode
  if (opts.uninstall) {
    const uninstallResults = uninstall(target);
    results.uninstall = uninstallResults;
    return results;
  }

  // Compose CLAUDE.md
  const { composed, needsMigration } = composeCLAUDEMd();
  results.needsMigration = needsMigration;

  // Inject into target
  const injected = injectCLAUDEMd(target.claudeMdPath, composed);

  // Check if changed
  const existing = existsSync(target.claudeMdPath)
    ? readFileSync(target.claudeMdPath, 'utf-8')
    : '';
  const changed = existing !== injected;

  if (changed && !opts.dryRun) {
    writeFileSync(target.claudeMdPath, injected, 'utf-8');
  }

  results.claudeMd = {
    path: target.claudeMdPath,
    changed,
    size: injected.length,
  };

  // Sync tools
  results.tools = syncTools(target, manifest);

  // Sync skills
  results.skills = syncSkills(target, manifest);

  // Update manifest
  const version = readFileSync(VERSION_PATH, 'utf-8').trim();
  manifest.version = version;
  manifest.lastSync = new Date().toISOString();
  if (!manifest.targets.includes(target.id)) {
    manifest.targets.push(target.id);
  }
  saveManifest(manifest);

  // Clean up legacy
  results.legacy = cleanupLegacy();

  return results;
}

// Format results for output
function formatResults(results) {
  const lines = [];

  if (opts.dryRun) {
    lines.push('Dry run — no changes made.\n');
  }

  for (const result of results) {
    if (result.error) {
      lines.push(`❌ ${result.target}: ${result.error}`);
      continue;
    }

    lines.push(`✓ ${result.target}`);

    if (result.targetCreated) {
      lines.push(`  Created ${result.targetCreated} (Claude had not been run on this machine)`);
    }

    if (result.coworkDetected) {
      lines.push('  Cowork detected — will pick up these skills');
    }

    if (result.uninstall) {
      const u = result.uninstall;
      if (u.toolsRemoved) {
        lines.push('  Removed tools directory');
      }
      lines.push(`  Removed ${u.skillsRemoved.length} skill(s)`);
      if (u.markerRemoved) {
        lines.push('  Removed EDWIN marker block from CLAUDE.md');
      }
      if (u.manifestCleared) {
        lines.push('  Cleared manifest');
      }
      continue;
    }

    if (result.claudeMd.changed) {
      lines.push(`  CLAUDE.md updated (${result.claudeMd.size} bytes)`);
    } else {
      lines.push('  CLAUDE.md unchanged');
    }

    const t = result.tools;
    if (t.changed) {
      lines.push('  Tools directory updated');
    } else if (t.skipped) {
      lines.push('  Tools directory unchanged');
    }

    const s = result.skills;
    if (s.copied.length > 0) {
      lines.push(`  Copied ${s.copied.length} new skill(s): ${s.copied.join(', ')}`);
    }
    if (s.updated.length > 0) {
      lines.push(`  Updated ${s.updated.length} skill(s): ${s.updated.join(', ')}`);
    }
    if (s.skipped.length > 0) {
      lines.push(`  ${s.skipped.length} skill(s) unchanged`);
    }
    if (s.pruned.length > 0) {
      lines.push(`  Pruned ${s.pruned.length} removed skill(s): ${s.pruned.join(', ')}`);
    }

    if (result.needsMigration.length > 0) {
      lines.push(
        `  ⚠️  ${result.needsMigration.length} skill(s) need frontmatter migration`
      );
    }

    if (result.legacy.found) {
      const l = result.legacy;
      if (l.cleaned) {
        lines.push(`  Cleaned ${l.skills.length} legacy skill(s) from uppercase SKILLS/`);
      } else if (l.canClean) {
        lines.push(
          `  Would clean ${l.skills.length} legacy skill(s) from uppercase SKILLS/`
        );
      }
    }
  }

  // Only show success banner if at least one target succeeded
  const anySucceeded = results.some((r) => !r.error);
  if (!opts.uninstall && !opts.dryRun && anySucceeded) {
    lines.push('\n✓ Done. Restart Claude to load the changes.');
  }

  return lines.join('\n');
}

// Main
function main() {
  const targets = getTargets(HOME_DIR);
  const results = [];

  if (opts.target === 'all') {
    // Install to code (which covers desktop due to shared paths)
    results.push(sync(targets.code));
  } else {
    const target = targets[opts.target];
    if (!target) {
      error(`Unknown target: ${opts.target}`, 2);
    }
    results.push(sync(target));
  }

  // Check if all targets failed
  const allFailed = results.every((r) => r.error);

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(formatResults(results));
  }

  process.exit(allFailed ? 1 : 0);
}

main();
