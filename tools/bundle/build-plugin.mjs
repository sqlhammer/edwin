#!/usr/bin/env node

/**
 * build-plugin.mjs
 *
 * Generates Claude Code plugin package from core/ sources.
 *
 * Deliverable for WU-08. Single source of truth: no hand-maintained duplicates.
 * Skills are discovered generically from core/skills/; persona is delivered via
 * the edwin-activate skill (since no plugin-level CLAUDE.md mechanism exists).
 *
 * Usage:
 *   node tools/bundle/build-plugin.mjs [options]
 *
 * Options:
 *   --output-dir <path>    Output directory (default: .claude-plugin)
 *   --dry-run              Show what would be generated without writing
 *   --json                 Output JSON result only
 *   --quiet                Minimal output
 *   --help                 Show this help
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
  copyFileSync,
  rmSync,
  statSync,
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

// Resolve repo root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..', '..');

// Plugin format specification - ISOLATED HERE for easy updates
const PLUGIN_SPEC = {
  // Verified plugin.json shape from specs/environment-findings.md §3
  pluginJson: {
    required: ['name', 'description'],
    optional: ['author', 'version', 'license', 'keywords'],
    schemaUrl: null, // No $schema field observed in verified plugins
  },
  // Verified marketplace.json shape
  marketplace: {
    schemaUrl: 'https://anthropic.com/claude-code/marketplace.schema.json',
    pluginCategories: [
      'productivity',
      'development',
      'research',
      'education',
      'other',
    ],
  },
  // Plugin package layout
  // CRITICAL: Plugin root is REPO ROOT (marketplace.json uses "source": ".")
  // Skills must be at <repo-root>/skills/, NOT .claude-plugin/skills/
  layout: {
    manifestPath: '.claude-plugin/plugin.json',
    marketplacePath: '.claude-plugin/marketplace.json',
    skillsDir: 'skills', // Repo-root directory, committed
    // Note: No plugin-level CLAUDE.md mechanism verified per environment-findings.md §3
  },
};

// Parse args
const args = process.argv.slice(2);
const opts = {
  outputDir: '.claude-plugin',
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
    case '--output-dir':
      opts.outputDir = next;
      i++;
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

// Help
if (opts.help) {
  const help = readFileSync(__filename, 'utf-8')
    .split('\n')
    .slice(3, 23)
    .map((line) => line.replace(/^ \* ?/, ''))
    .join('\n');
  console.log(help);
  process.exit(0);
}

// Repo paths
const CORE_DIR = join(REPO_ROOT, 'core');
const SKILLS_DIR = join(CORE_DIR, 'skills');
const VERSION_PATH = join(CORE_DIR, 'VERSION');
const PACKAGE_JSON_PATH = join(REPO_ROOT, 'package.json');
const PLUGIN_DIR = join(REPO_ROOT, opts.outputDir);
const REPO_SKILLS_DIR = join(REPO_ROOT, PLUGIN_SPEC.layout.skillsDir);

// Extract repository owner and name from package.json
function extractRepoInfo() {
  if (!existsSync(PACKAGE_JSON_PATH)) {
    error('package.json not found', 1);
  }

  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
  const repoUrl = packageJson.repository?.url;

  if (!repoUrl) {
    error('package.json missing repository.url', 1);
  }

  const cleanUrl = repoUrl.replace(/^git\+/, '');
  const match = cleanUrl.match(/github\.com[/:](.+?)\/(.+?)(\.git)?$/);

  if (!match) {
    error(`Could not parse GitHub owner/repo from "${repoUrl}"`, 1);
  }

  return {
    packageJson,
    owner: match[1],
    repo: match[2],
    version: packageJson.version,
    description: packageJson.description,
    license: packageJson.license,
  };
}

// Discover skills generically from core/skills/
function discoverSkills() {
  if (!existsSync(SKILLS_DIR)) {
    error('core/skills/ directory not found', 1);
  }

  const entries = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(); // Deterministic ordering

  const skills = [];

  for (const skillName of entries) {
    const skillPath = join(SKILLS_DIR, skillName, 'SKILL.md');
    if (!existsSync(skillPath)) {
      log(`Warning: ${skillName} has no SKILL.md, skipping`);
      continue;
    }

    skills.push({
      name: skillName,
      sourcePath: join(SKILLS_DIR, skillName),
    });
  }

  return skills;
}

// Generate plugin.json
function generatePluginJson(repoInfo, skills) {
  const pluginJson = {
    name: 'edwin',
    description: repoInfo.description,
    author: {
      name: 'EDWIN Core Team',
      // Email omitted - not universally present per PLUGIN_SPEC
    },
    version: repoInfo.version,
    license: repoInfo.license,
    keywords: [
      'personal-assistant',
      'productivity',
      'skills',
      'workflow',
      'automation',
    ],
  };

  return pluginJson;
}

// Generate marketplace.json
function generateMarketplaceJson(repoInfo) {
  const marketplaceJson = {
    $schema: PLUGIN_SPEC.marketplace.schemaUrl,
    name: 'edwin',
    description: 'EDWIN — Electronic Digital Workforce Intelligence Network. A portable personal AI assistant framework.',
    owner: {
      name: repoInfo.owner,
    },
    plugins: [
      {
        name: 'edwin',
        description: repoInfo.description,
        author: {
          name: 'EDWIN Core Team',
        },
        category: 'productivity',
        source: '.', // In-repo plugin at repository root
      },
    ],
  };

  return marketplaceJson;
}

// Hash computation for idempotency
function hashFile(filePath) {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function hashDirectory(dirPath) {
  const hash = createHash('sha256');
  const entries = readdirSync(dirPath, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    hash.update(entry.name);

    if (entry.isDirectory()) {
      hash.update(hashDirectory(fullPath));
    } else {
      hash.update(hashFile(fullPath));
    }
  }

  return hash.digest('hex');
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

// Check if two files have identical content
function filesIdentical(file1, file2) {
  if (!existsSync(file1) || !existsSync(file2)) return false;
  const stat1 = statSync(file1);
  const stat2 = statSync(file2);
  if (stat1.size !== stat2.size) return false;
  return readFileSync(file1, 'utf-8') === readFileSync(file2, 'utf-8');
}

// Build the plugin
function buildPlugin() {
  const result = {
    skillsDir: REPO_SKILLS_DIR,
    pluginDir: PLUGIN_DIR,
    skills: [],
    added: [],
    updated: [],
    removed: [],
    unchanged: [],
    manifestsChanged: false,
  };

  // Extract repo info
  const repoInfo = extractRepoInfo();
  result.owner = repoInfo.owner;
  result.repo = repoInfo.repo;
  result.version = repoInfo.version;

  // Discover skills from core/skills/
  const skills = discoverSkills();
  result.skills = skills.map((s) => s.name);

  log(`Building plugin: ${repoInfo.owner}/${repoInfo.repo} v${repoInfo.version}`);
  log(`Discovered ${skills.length} skill(s): ${result.skills.join(', ')}`);

  if (opts.dryRun) {
    log('\nDry run — no files written.\n');
    return result;
  }

  // 1. Generate skills at repo root
  if (!existsSync(REPO_SKILLS_DIR)) {
    mkdirSync(REPO_SKILLS_DIR, { recursive: true });
  }

  // Track existing skills for pruning
  const existingSkills = existsSync(REPO_SKILLS_DIR)
    ? readdirSync(REPO_SKILLS_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : [];

  const coreSkillNames = new Set(skills.map((s) => s.name));

  // Copy/update skills
  for (const skill of skills) {
    const destSkillDir = join(REPO_SKILLS_DIR, skill.name);
    const existed = existsSync(destSkillDir);

    if (existed) {
      // Check if changed
      const srcHash = hashDirectory(skill.sourcePath);
      const destHash = hashDirectory(destSkillDir);

      if (srcHash === destHash) {
        result.unchanged.push(skill.name);
      } else {
        // Update
        rmSync(destSkillDir, { recursive: true, force: true });
        copyDirRecursive(skill.sourcePath, destSkillDir);
        result.updated.push(skill.name);
      }
    } else {
      // Add new
      copyDirRecursive(skill.sourcePath, destSkillDir);
      result.added.push(skill.name);
    }
  }

  // Prune skills that no longer exist in core/skills/
  for (const existingSkill of existingSkills) {
    if (!coreSkillNames.has(existingSkill)) {
      const skillPath = join(REPO_SKILLS_DIR, existingSkill);
      rmSync(skillPath, { recursive: true, force: true });
      result.removed.push(existingSkill);
    }
  }

  // 2. Generate .claude-plugin/ with ONLY the two JSON files
  if (!existsSync(PLUGIN_DIR)) {
    mkdirSync(PLUGIN_DIR, { recursive: true });
  }

  // Clean .claude-plugin/ of everything except the two manifests (temporary for this fix)
  const pluginEntries = existsSync(PLUGIN_DIR)
    ? readdirSync(PLUGIN_DIR, { withFileTypes: true })
    : [];

  for (const entry of pluginEntries) {
    const name = entry.name;
    if (name !== 'plugin.json' && name !== 'marketplace.json') {
      const fullPath = join(PLUGIN_DIR, name);
      rmSync(fullPath, { recursive: true, force: true });
      log(`  Cleaned: ${name}`);
    }
  }

  // Generate plugin.json
  const pluginJson = generatePluginJson(repoInfo, skills);
  const pluginJsonPath = join(PLUGIN_DIR, 'plugin.json');
  const pluginJsonContent = JSON.stringify(pluginJson, null, 2) + '\n';

  if (
    !existsSync(pluginJsonPath) ||
    readFileSync(pluginJsonPath, 'utf-8') !== pluginJsonContent
  ) {
    writeFileSync(pluginJsonPath, pluginJsonContent, 'utf-8');
    result.manifestsChanged = true;
  }

  // Generate marketplace.json
  const marketplaceJson = generateMarketplaceJson(repoInfo);
  const marketplaceJsonPath = join(PLUGIN_DIR, 'marketplace.json');
  const marketplaceJsonContent = JSON.stringify(marketplaceJson, null, 2) + '\n';

  if (
    !existsSync(marketplaceJsonPath) ||
    readFileSync(marketplaceJsonPath, 'utf-8') !== marketplaceJsonContent
  ) {
    writeFileSync(marketplaceJsonPath, marketplaceJsonContent, 'utf-8');
    result.manifestsChanged = true;
  }

  // Report
  const changes =
    result.added.length + result.updated.length + result.removed.length;
  if (changes === 0 && !result.manifestsChanged) {
    log(`\n✓ No changes — plugin is up to date`);
  } else {
    log(`\n✓ Plugin built`);
    if (result.added.length > 0) {
      log(`  Added: ${result.added.join(', ')}`);
    }
    if (result.updated.length > 0) {
      log(`  Updated: ${result.updated.join(', ')}`);
    }
    if (result.removed.length > 0) {
      log(`  Removed: ${result.removed.join(', ')}`);
    }
    if (result.manifestsChanged) {
      log(`  Manifests: updated`);
    }
    log(`  Skills directory: ${REPO_SKILLS_DIR}`);
    log(`  Plugin directory: ${PLUGIN_DIR}`);
  }

  return result;
}

// Main
function main() {
  try {
    const result = buildPlugin();

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!opts.dryRun) {
      const changes =
        result.added.length +
        result.updated.length +
        result.removed.length +
        (result.manifestsChanged ? 1 : 0);
      if (changes > 0) {
        log(
          `\nTo install: /plugin marketplace add ${result.owner}/${result.repo}`
        );
      }
    }

    process.exit(0);
  } catch (err) {
    error(err.message, 1);
  }
}

main();
