#!/usr/bin/env node
/**
 * edwin-doctor.mjs
 *
 * Structure validator for the EDWIN framework.
 * Enforces conventions.md requirements across skills, contexts, persona, and templates.
 *
 * Usage:
 *   edwin-doctor.mjs              # Validate entire repo
 *   edwin-doctor.mjs --skill path # Validate single skill
 *   edwin-doctor.mjs --json       # JSON output
 *   edwin-doctor.mjs --quiet      # Errors only
 *   edwin-doctor.mjs --help       # Show help
 *
 * Exit codes:
 *   0 - Success (warnings allowed)
 *   1 - Validation failed
 *   2 - Bad usage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { extractFrontmatter, parseYAML } from './lib/mini-yaml.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCTOR_VERSION = '1.0.0';

// CLI args
const args = process.argv.slice(2);
const flags = {
  json: args.includes('--json'),
  quiet: args.includes('--quiet'),
  help: args.includes('--help'),
  skill: null,
  root: null,
};

// Parse arguments. Unrecognised flags and missing values are a usage error (exit 2,
// conventions §7) — silently ignoring them would let a typo pass as a clean run.
const BOOLEAN_FLAGS = ['--json', '--quiet', '--help'];
const VALUE_FLAGS = { '--skill': 'skill', '--root': 'root' };

function usageError(message) {
  console.error(`Usage error: ${message}`);
  console.error('Run with --help for the supported flags.');
  process.exit(2);
}

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (BOOLEAN_FLAGS.includes(arg)) continue;
  if (arg in VALUE_FLAGS) {
    const value = args[i + 1];
    if (!value || value.startsWith('--')) usageError(`${arg} requires a value.`);
    flags[VALUE_FLAGS[arg]] = value;
    i++;
    continue;
  }
  usageError(`unrecognised argument "${arg}".`);
}

// Determine repo root
const REPO_ROOT = flags.root || path.resolve(__dirname, '../..');

// Findings collector
const findings = [];

function addFinding(id, level, group, file, line, message) {
  findings.push({ id, level, group, file, line, message });
}

// ============================================================================
// CHECK REGISTRY
// ============================================================================

const checks = [
  // Contexts (must run first to populate ctx.contextsData for skill validation)
  {
    id: 'contexts-parse',
    title: 'Contexts file parsing',
    group: 'contexts',
    run: checkContextsParse,
  },
  {
    id: 'contexts-global',
    title: 'Global context exists',
    group: 'contexts',
    run: checkContextsGlobal,
  },
  {
    id: 'contexts-unique',
    title: 'Context names unique',
    group: 'contexts',
    run: checkContextsUnique,
  },
  {
    id: 'contexts-unused',
    title: 'Unused contexts',
    group: 'contexts',
    run: checkContextsUnused,
  },

  // Skills (run after contexts are loaded)
  {
    id: 'skill-frontmatter',
    title: 'Skill frontmatter',
    group: 'skills',
    run: checkSkillFrontmatter,
  },
  {
    id: 'skill-sections',
    title: 'Skill body sections',
    group: 'skills',
    run: checkSkillSections,
  },
  {
    id: 'skill-size',
    title: 'Skill size budget',
    group: 'skills',
    run: checkSkillSize,
  },

  // Persona
  {
    id: 'persona-files',
    title: 'Persona files exist',
    group: 'persona',
    run: checkPersonaFiles,
  },
  {
    id: 'persona-size',
    title: 'Persona line count budget',
    group: 'persona',
    run: checkPersonaSize,
  },
  {
    id: 'persona-hooks',
    title: 'Persona hooks format',
    group: 'persona',
    run: checkPersonaHooks,
  },

  // Templates
  {
    id: 'templates-readable',
    title: 'Template files readable',
    group: 'templates',
    run: checkTemplatesReadable,
  },

  // Leakage
  {
    id: 'leakage-personal',
    title: 'Personal data leakage',
    group: 'leakage',
    run: checkLeakage,
  },

  // User data (conditional)
  {
    id: 'user-config',
    title: 'User config schema',
    group: 'user',
    run: checkUserConfig,
  },
  {
    id: 'user-state',
    title: 'User state schema',
    group: 'user',
    run: checkUserState,
  },

  // Memory (WU-17)
  {
    id: 'memory-digest-size',
    title: 'Memory digest size',
    group: 'memory',
    run: checkMemoryDigestSize,
  },
  {
    id: 'memory-files-parse',
    title: 'Memory files parse',
    group: 'memory',
    run: checkMemoryFilesParse,
  },

  // Brags (WU-18)
  {
    id: 'brags-files-parse',
    title: 'Brags files parse',
    group: 'brags',
    run: checkBragsFilesParse,
  },
  {
    id: 'brags-categories-valid',
    title: 'Brags category references',
    group: 'brags',
    run: checkBragsCategoriesValid,
  },

  // Plugin build drift (WU-08)
  {
    id: 'plugin-skills-drift',
    title: 'Plugin skills directory drift',
    group: 'plugin',
    run: checkPluginSkillsDrift,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function listSkills() {
  const skillsDir = path.join(REPO_ROOT, 'core/skills');
  if (!fileExists(skillsDir)) return [];

  try {
    return fs.readdirSync(skillsDir)
      .filter(name => {
        const stat = fs.statSync(path.join(skillsDir, name));
        return stat.isDirectory();
      });
  } catch {
    return [];
  }
}

function countLines(content) {
  // A file ending in a newline — as every text file here does — yields a trailing
  // empty segment from split(). Counting it reports every file one line too long.
  const lines = content.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.length;
}

function isValidSemver(version) {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(version);
}

function isValidKebabCase(name) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
}

// ============================================================================
// SKILL CHECKS
// ============================================================================

function checkSkillFrontmatter(ctx) {
  const skills = ctx.skills || listSkills();

  for (const skillName of skills) {
    const skillPath = path.join(REPO_ROOT, 'core/skills', skillName, 'SKILL.md');
    const content = readFile(skillPath);

    if (!content) {
      addFinding('skill-frontmatter', 'error', 'skills', skillPath, null,
        `Skill file not found or not readable`);
      continue;
    }

    const { frontmatter, error } = extractFrontmatter(content);

    if (error) {
      addFinding('skill-frontmatter', 'error', 'skills', skillPath, null,
        `Frontmatter parse error: ${error}`);
      continue;
    }

    if (!frontmatter) {
      addFinding('skill-frontmatter', 'error', 'skills', skillPath, null,
        `Missing frontmatter`);
      continue;
    }

    // Check required keys
    const required = ['name', 'description', 'contexts', 'version', 'requires', 'author'];
    for (const key of required) {
      if (!(key in frontmatter)) {
        addFinding('skill-frontmatter', 'error', 'skills', skillPath, null,
          `Missing required frontmatter key: ${key}`);
      }
    }

    // Name validation
    if (frontmatter.name) {
      if (!isValidKebabCase(frontmatter.name)) {
        addFinding('skill-frontmatter', 'error', 'skills', skillPath, null,
          `Invalid name format: ${frontmatter.name} (must be kebab-case)`);
      }
      if (frontmatter.name !== skillName) {
        addFinding('skill-frontmatter', 'error', 'skills', skillPath, null,
          `Name mismatch: frontmatter says "${frontmatter.name}" but directory is "${skillName}"`);
      }
    }

    // Description validation
    if (frontmatter.description) {
      const desc = frontmatter.description;
      if (desc.length > 500) {
        addFinding('skill-frontmatter', 'error', 'skills', skillPath, null,
          `Description too long: ${desc.length} chars (max 500)`);
      }
      if (desc.length < 40) {
        addFinding('skill-frontmatter', 'warning', 'skills', skillPath, null,
          `Description very short: ${desc.length} chars (recommend 40+)`);
      }
      // Check for "when to use" signals
      const hasWhenSignal = /\b(when|use when|for|if|mentions)\b/i.test(desc);
      if (!hasWhenSignal) {
        addFinding('skill-frontmatter', 'warning', 'skills', skillPath, null,
          `Description lacks "when to use" signal — this is the routing contract`);
      }
    }

    // Contexts validation
    if (frontmatter.contexts) {
      const contexts = ctx.contextsData?.contexts || [];
      const contextNames = contexts.map(c => c.name);

      if (frontmatter.contexts === 'all') {
        // Valid
      } else if (Array.isArray(frontmatter.contexts)) {
        for (const ctxName of frontmatter.contexts) {
          if (ctxName !== 'all' && !contextNames.includes(ctxName)) {
            addFinding('skill-frontmatter', 'error', 'skills', skillPath, null,
              `Context "${ctxName}" not found in contexts.json`);
          }
        }
      } else {
        addFinding('skill-frontmatter', 'error', 'skills', skillPath, null,
          `contexts must be "all" or a list`);
      }
    }

    // Version validation
    if (frontmatter.version && !isValidSemver(frontmatter.version)) {
      addFinding('skill-frontmatter', 'error', 'skills', skillPath, null,
        `Invalid semver: ${frontmatter.version}`);
    }

    // Requires validation
    if (frontmatter.requires !== undefined && !Array.isArray(frontmatter.requires)) {
      addFinding('skill-frontmatter', 'error', 'skills', skillPath, null,
        `requires must be a list`);
    } else if (Array.isArray(frontmatter.requires)) {
      for (const req of frontmatter.requires) {
        // Check if it's a script path (not a capability keyword)
        if (!['shell', 'web-search', 'web-fetch'].includes(req)) {
          const scriptPath = path.join(REPO_ROOT, req);
          if (!fileExists(scriptPath)) {
            addFinding('skill-frontmatter', 'warning', 'skills', skillPath, null,
              `Required script not found: ${req}`);
          }
        }
      }
    }

    // Author validation
    if (!frontmatter.author || frontmatter.author.trim() === '') {
      addFinding('skill-frontmatter', 'error', 'skills', skillPath, null,
        `author is required and cannot be empty`);
    }

    // Type validation (optional)
    if (frontmatter.type && frontmatter.type !== 'persona') {
      addFinding('skill-frontmatter', 'warning', 'skills', skillPath, null,
        `Unknown type: ${frontmatter.type} (only "persona" is defined)`);
    }
  }
}

function checkSkillSections(ctx) {
  const skills = ctx.skills || listSkills();
  const requiredSections = [
    '## Purpose',
    '## When to use',
    '## Instructions',
    '## Degradation',
    '## Examples'
  ];

  for (const skillName of skills) {
    const skillPath = path.join(REPO_ROOT, 'core/skills', skillName, 'SKILL.md');
    const content = readFile(skillPath);

    if (!content) continue;

    // Check each required section
    for (const section of requiredSections) {
      if (!content.includes(section)) {
        addFinding('skill-sections', 'error', 'skills', skillPath, null,
          `Missing required section: ${section}`);
      }
    }

    // Warn if has requires but no script hooks section
    const { frontmatter } = extractFrontmatter(content);
    if (frontmatter?.requires?.length > 0) {
      if (!content.includes('## Optional script hooks')) {
        addFinding('skill-sections', 'warning', 'skills', skillPath, null,
          `Has requires but missing "## Optional script hooks" section`);
      }
    }
  }
}

function checkSkillSize(ctx) {
  const skills = ctx.skills || listSkills();

  for (const skillName of skills) {
    const skillPath = path.join(REPO_ROOT, 'core/skills', skillName, 'SKILL.md');
    const content = readFile(skillPath);

    if (!content) continue;

    const lines = countLines(content);
    if (lines > 250) {
      addFinding('skill-size', 'warning', 'skills', skillPath, null,
        `Skill is ${lines} lines (recommend < 250) — consider moving detail to reference/`);
    }
  }
}

// ============================================================================
// CONTEXTS CHECKS
// ============================================================================

function checkContextsParse(ctx) {
  const contextsPath = path.join(REPO_ROOT, 'core/contexts/contexts.json');
  const content = readFile(contextsPath);

  if (!content) {
    addFinding('contexts-parse', 'error', 'contexts', contextsPath, null,
      `contexts.json not found or not readable`);
    return;
  }

  try {
    const data = JSON.parse(content);
    ctx.contextsData = data;
  } catch (err) {
    addFinding('contexts-parse', 'error', 'contexts', contextsPath, null,
      `Failed to parse JSON: ${err.message}`);
  }
}

function checkContextsGlobal(ctx) {
  if (!ctx.contextsData) return;

  const contextsPath = path.join(REPO_ROOT, 'core/contexts/contexts.json');
  const contexts = ctx.contextsData.contexts || [];
  const hasGlobal = contexts.some(c => c.name === 'Global');

  if (!hasGlobal) {
    addFinding('contexts-global', 'error', 'contexts', contextsPath, null,
      `Global context is required but not found`);
  }
}

function checkContextsUnique(ctx) {
  if (!ctx.contextsData) return;

  const contextsPath = path.join(REPO_ROOT, 'core/contexts/contexts.json');
  const contexts = ctx.contextsData.contexts || [];
  const names = contexts.map(c => c.name);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);

  if (duplicates.length > 0) {
    addFinding('contexts-unique', 'error', 'contexts', contextsPath, null,
      `Duplicate context names: ${[...new Set(duplicates)].join(', ')}`);
  }

  // Check that every context has a description
  for (const context of contexts) {
    if (!context.description || context.description.trim() === '') {
      addFinding('contexts-unique', 'error', 'contexts', contextsPath, null,
        `Context "${context.name}" is missing a description`);
    }
  }
}

function checkContextsUnused(ctx) {
  if (!ctx.contextsData) return;

  const contextsPath = path.join(REPO_ROOT, 'core/contexts/contexts.json');
  const contexts = ctx.contextsData.contexts || [];
  const contextNames = contexts.map(c => c.name);

  // Collect all contexts referenced by skills
  const usedContexts = new Set();
  const skills = listSkills();

  for (const skillName of skills) {
    const skillPath = path.join(REPO_ROOT, 'core/skills', skillName, 'SKILL.md');
    const content = readFile(skillPath);
    if (!content) continue;

    const { frontmatter } = extractFrontmatter(content);
    if (!frontmatter?.contexts) continue;

    if (frontmatter.contexts === 'all') {
      // Mark all contexts as used
      contextNames.forEach(name => usedContexts.add(name));
    } else if (Array.isArray(frontmatter.contexts)) {
      frontmatter.contexts.forEach(name => usedContexts.add(name));
    }
  }

  // Warn on unused contexts (except Global)
  for (const name of contextNames) {
    if (name !== 'Global' && !usedContexts.has(name)) {
      addFinding('contexts-unused', 'warning', 'contexts', contextsPath, null,
        `Context "${name}" is defined but no skill references it`);
    }
  }
}

// ============================================================================
// PERSONA CHECKS
// ============================================================================

function checkPersonaFiles(ctx) {
  const personaDir = path.join(REPO_ROOT, 'core/persona');
  const requiredFiles = [
    'identity.md',
    'operating-rules.md',
    'harness-detection.md'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(personaDir, file);
    if (!fileExists(filePath)) {
      addFinding('persona-files', 'error', 'persona', filePath, null,
        `Required persona file missing`);
    }
  }
}

function checkPersonaSize(ctx) {
  const personaDir = path.join(REPO_ROOT, 'core/persona');
  let totalLines = 0;
  const files = [];

  // Collect all .md files recursively
  function collectFiles(dir) {
    if (!fileExists(dir)) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectFiles(fullPath);
        } else if (entry.name.endsWith('.md') && !entry.name.endsWith('.gitkeep')) {
          const content = readFile(fullPath);
          if (content) {
            const lines = countLines(content);
            totalLines += lines;
            files.push({ path: fullPath, lines });
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  collectFiles(personaDir);

  if (totalLines > 400) {
    addFinding('persona-size', 'error', 'persona', personaDir, null,
      `Persona total is ${totalLines} lines (hard limit 400)`);
  } else if (totalLines > 300) {
    addFinding('persona-size', 'warning', 'persona', personaDir, null,
      `Persona total is ${totalLines} lines (budget 300, limit 400)`);
  }
}

function checkPersonaHooks(ctx) {
  const hooksDir = path.join(REPO_ROOT, 'core/persona/hooks');
  if (!fileExists(hooksDir)) return;

  try {
    const hookFiles = fs.readdirSync(hooksDir)
      .filter(name => name.endsWith('.md') && !name.endsWith('.gitkeep'));

    for (const file of hookFiles) {
      const filePath = path.join(hooksDir, file);
      const content = readFile(filePath);
      if (!content) continue;

      const lines = countLines(content);

      // Check format
      if (!content.includes('### Hook:')) {
        addFinding('persona-hooks', 'error', 'persona', filePath, null,
          `Hook file missing "### Hook:" heading`);
      }
      if (!content.includes('**Owner skill:**')) {
        addFinding('persona-hooks', 'error', 'persona', filePath, null,
          `Hook file missing "**Owner skill:**" marker`);
      }
      if (!content.includes('**Fires when:**')) {
        addFinding('persona-hooks', 'error', 'persona', filePath, null,
          `Hook file missing "**Fires when:**" marker`);
      }

      // Check size
      if (lines > 15) {
        addFinding('persona-hooks', 'warning', 'persona', filePath, null,
          `Hook file is ${lines} lines (hard ceiling 15)`);
      }
    }
  } catch {
    // Ignore errors if hooks dir doesn't exist or isn't readable
  }
}

// ============================================================================
// TEMPLATES CHECKS
// ============================================================================

function checkTemplatesReadable(ctx) {
  const templatesDir = path.join(REPO_ROOT, 'core/templates');
  if (!fileExists(templatesDir)) return;

  try {
    const files = fs.readdirSync(templatesDir, { withFileTypes: true });

    for (const file of files) {
      if (file.isDirectory()) continue;

      const filePath = path.join(templatesDir, file.name);
      const content = readFile(filePath);

      if (!content) {
        addFinding('templates-readable', 'error', 'templates', filePath, null,
          `Template file not readable`);
        continue;
      }

      // If it has frontmatter, try to parse it
      if ((file.name.endsWith('.tmpl') || file.name.endsWith('.md')) && content.trim().startsWith('---')) {
        const { error } = extractFrontmatter(content);
        if (error) {
          addFinding('templates-readable', 'error', 'templates', filePath, null,
            `Template frontmatter parse error: ${error}`);
        }
      }
    }
  } catch (err) {
    // Ignore errors
  }
}

// ============================================================================
// LEAKAGE CHECKS
// ============================================================================

function checkLeakage(ctx) {
  const denylistPath = path.join(__dirname, 'denylist.txt');
  const denylistPatterns = [];

  // Load denylist
  const denylistContent = readFile(denylistPath);
  if (denylistContent) {
    const lines = denylistContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) continue;

      // Check if it's a regex (wrapped in /.../)
      if (trimmed.startsWith('/') && trimmed.endsWith('/')) {
        try {
          const pattern = trimmed.slice(1, -1);
          denylistPatterns.push({ type: 'regex', pattern: new RegExp(pattern, 'i') });
        } catch {
          // Invalid regex, skip
        }
      } else {
        denylistPatterns.push({ type: 'substring', pattern: trimmed.toLowerCase() });
      }
    }
  }

  // Built-in patterns for home paths
  const builtinPatterns = [
    { type: 'regex', pattern: /\/Users\/[a-zA-Z0-9_-]+/g },
    { type: 'regex', pattern: /\/home\/[a-zA-Z0-9_-]+/g },
    { type: 'regex', pattern: /C:\\Users\\[a-zA-Z0-9_-]+/gi },
    { type: 'regex', pattern: /[A-Z]:\\[a-zA-Z0-9_-]+\\[a-zA-Z0-9_-]+/g },
  ];

  const allPatterns = [...denylistPatterns, ...builtinPatterns];

  // Directories to scan
  const scanDirs = ['core', 'tools', 'docs'];
  const scanRoot = [path.join(REPO_ROOT, 'CLAUDE.md')];

  // Directories to exclude
  const excludeDirs = ['specs', path.join('docs', 'testing')];

  function shouldExclude(filePath) {
    const rel = path.relative(REPO_ROOT, filePath);
    for (const exclude of excludeDirs) {
      if (rel.startsWith(exclude)) return true;
    }
    return false;
  }

  function scanFile(filePath) {
    if (shouldExclude(filePath)) return;

    // Skip the denylist file itself (it contains example patterns in comments)
    if (filePath.endsWith('denylist.txt')) return;

    const content = readFile(filePath);
    if (!content) return;

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      for (const { type, pattern } of allPatterns) {
        if (type === 'substring') {
          if (line.toLowerCase().includes(pattern)) {
            addFinding('leakage-personal', 'error', 'leakage', filePath, lineNum,
              `Potential personal data leak: matched denylist pattern`);
            break;
          }
        } else if (type === 'regex') {
          if (pattern.test(line)) {
            addFinding('leakage-personal', 'error', 'leakage', filePath, lineNum,
              `Potential personal data leak: matched pattern ${pattern}`);
            break;
          }
        }
      }
    }
  }

  function scanDirectory(dir) {
    if (!fileExists(dir)) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else {
          scanFile(fullPath);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  // Scan
  for (const dir of scanDirs) {
    scanDirectory(path.join(REPO_ROOT, dir));
  }
  for (const file of scanRoot) {
    scanFile(file);
  }
}

// ============================================================================
// USER DATA CHECKS
// ============================================================================

function checkUserConfig(ctx) {
  const configPath = path.join(REPO_ROOT, 'user/config.json');
  if (!fileExists(configPath)) return; // Absence is not an error

  const content = readFile(configPath);
  if (!content) return;

  try {
    const config = JSON.parse(content);

    // Check required keys
    const required = ['schemaVersion', 'name', 'addressAs', 'os', 'harness', 'contextsOwned', 'preferences'];
    for (const key of required) {
      if (!(key in config)) {
        addFinding('user-config', 'warning', 'user', configPath, null,
          `Missing recommended key: ${key}`);
      }
    }

    // Validate enums
    if (config.os && !['windows', 'macos', 'linux'].includes(config.os)) {
      addFinding('user-config', 'warning', 'user', configPath, null,
        `Unknown os value: ${config.os}`);
    }
    if (config.harness && !['claude-code', 'claude-desktop', 'cowork', 'web'].includes(config.harness)) {
      addFinding('user-config', 'warning', 'user', configPath, null,
        `Unknown harness value: ${config.harness}`);
    }
    if (config.preferences?.verbosity && !['concise', 'detailed'].includes(config.preferences.verbosity)) {
      addFinding('user-config', 'warning', 'user', configPath, null,
        `Unknown verbosity value: ${config.preferences.verbosity}`);
    }
  } catch (err) {
    addFinding('user-config', 'warning', 'user', configPath, null,
      `Failed to parse JSON: ${err.message}`);
  }
}

function checkUserState(ctx) {
  const statePath = path.join(REPO_ROOT, 'user/state.json');
  if (!fileExists(statePath)) return; // Absence is not an error

  const content = readFile(statePath);
  if (!content) return;

  try {
    const state = JSON.parse(content);

    // Check required keys
    const required = ['schemaVersion', 'activeContext', 'offTheRecord', 'lastSync'];
    for (const key of required) {
      if (!(key in state)) {
        addFinding('user-state', 'warning', 'user', statePath, null,
          `Missing recommended key: ${key}`);
      }
    }
  } catch (err) {
    addFinding('user-state', 'warning', 'user', statePath, null,
      `Failed to parse JSON: ${err.message}`);
  }
}

// ============================================================================
// MEMORY CHECKS
// ============================================================================

function checkMemoryDigestSize(ctx) {
  const digestPath = path.join(REPO_ROOT, 'user/memory/digest.md');
  if (!fileExists(digestPath)) return; // Absence is OK for user/ files

  const content = readFile(digestPath);
  if (!content) return;

  const lines = countLines(content);
  if (lines > 60) {
    addFinding('memory-digest-size', 'error', 'memory', digestPath, null,
      `Digest is ${lines} lines (max 60)`);
  }
}

function checkMemoryFilesParse(ctx) {
  const memoryPath = path.join(REPO_ROOT, 'user/memory/memory.md');
  const pendingPath = path.join(REPO_ROOT, 'user/memory/pending.md');

  const files = [
    { path: memoryPath, name: 'memory.md' },
    { path: pendingPath, name: 'pending.md' },
  ];

  for (const { path: filePath, name } of files) {
    if (!fileExists(filePath)) continue; // Absence is OK

    const content = readFile(filePath);
    if (!content) {
      addFinding('memory-files-parse', 'error', 'memory', filePath, null,
        `File exists but not readable`);
      continue;
    }

    // Check for expected sections in memory.md
    if (name === 'memory.md') {
      const requiredSections = ['## Preferences', '## People', '## Work patterns', '## Facts', '## Dislikes', '## Tombstones'];
      const missingSections = requiredSections.filter(section => !content.includes(section));

      if (missingSections.length > 0) {
        addFinding('memory-files-parse', 'warning', 'memory', filePath, null,
          `Missing expected sections: ${missingSections.join(', ')}`);
      }
    }

    // Check comment format (basic validation)
    const commentPattern = /<!-- .+ \| .+ \| .+ -->/;
    const lines = content.split('\n');
    const comments = lines.filter(line => line.trim().startsWith('<!--') && line.trim().endsWith('-->'));

    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i].trim();
      // Skip tombstone comments (different format)
      if (comment.includes('tombstone:')) continue;

      if (!commentPattern.test(comment)) {
        const lineNum = lines.indexOf(comments[i]) + 1;
        addFinding('memory-files-parse', 'warning', 'memory', filePath, lineNum,
          `Comment metadata should be in format: <!-- date | context | source -->`);
      }
    }
  }
}

// ============================================================================
// BRAGS CHECKS (WU-18)
// ============================================================================

function checkBragsFilesParse(ctx) {
  const bragsPath = path.join(REPO_ROOT, 'user/brags/brags.md');
  const categoriesPath = path.join(REPO_ROOT, 'user/brags/categories.json');

  // Check brags.md
  if (fileExists(bragsPath)) {
    const content = readFile(bragsPath);
    if (!content) {
      addFinding('brags-files-parse', 'error', 'brags', bragsPath, null,
        `File exists but not readable`);
    } else {
      // Check comment format: <!-- date | category | size | context -->
      const commentPattern = /<!-- .+ \| .+ \| .+ \| .+ -->/;
      const lines = content.split('\n');
      const comments = lines.filter(line => line.trim().startsWith('<!--') && line.trim().endsWith('-->'));

      for (let i = 0; i < comments.length; i++) {
        const comment = comments[i].trim();
        if (!commentPattern.test(comment)) {
          const lineNum = lines.indexOf(comments[i]) + 1;
          addFinding('brags-files-parse', 'warning', 'brags', bragsPath, lineNum,
            `Comment metadata should be in format: <!-- date | category | size | context -->`);
        }
      }
    }
  }

  // Check categories.json
  if (fileExists(categoriesPath)) {
    const content = readFile(categoriesPath);
    if (!content) {
      addFinding('brags-files-parse', 'error', 'brags', categoriesPath, null,
        `File exists but not readable`);
    } else {
      try {
        const categories = JSON.parse(content);
        if (typeof categories !== 'object' || categories === null || Array.isArray(categories)) {
          addFinding('brags-files-parse', 'error', 'brags', categoriesPath, null,
            `categories.json must be an object mapping category names to descriptions`);
        } else {
          // Every value must be a description string. Without this, a wrong-shaped
          // file (e.g. {"categories": [...]}) parses fine and then every entry in
          // brags.md is reported as referencing a non-existent category — which
          // points at the wrong file.
          const badKeys = Object.entries(categories)
            .filter(([, v]) => typeof v !== 'string')
            .map(([k]) => k);
          if (badKeys.length > 0) {
            addFinding('brags-files-parse', 'error', 'brags', categoriesPath, null,
              `categories.json values must be description strings; not a string for: ${badKeys.join(', ')}`);
          } else {
            // Store in ctx for use by checkBragsCategoriesValid
            ctx.bragCategories = categories;
          }
        }
      } catch (err) {
        addFinding('brags-files-parse', 'error', 'brags', categoriesPath, null,
          `JSON parse error: ${err.message}`);
      }
    }
  }
}

function checkBragsCategoriesValid(ctx) {
  const bragsPath = path.join(REPO_ROOT, 'user/brags/brags.md');
  const categoriesPath = path.join(REPO_ROOT, 'user/brags/categories.json');

  // Only run if both files exist
  if (!fileExists(bragsPath) || !fileExists(categoriesPath)) {
    return; // Absence is OK for user/ files
  }

  const categories = ctx.bragCategories;
  if (!categories) {
    return; // categories.json didn't parse, already reported
  }

  const bragsContent = readFile(bragsPath);
  if (!bragsContent) return;

  // Parse entries and check that all referenced categories exist
  const lines = bragsContent.split('\n');
  const comments = lines.filter(line => line.trim().startsWith('<!--') && line.trim().endsWith('-->'));

  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i].trim();
    const parts = comment.slice(4, -3).split('|').map(s => s.trim());
    if (parts.length >= 2) {
      const category = parts[1];
      if (category && !categories[category]) {
        const lineNum = lines.indexOf(comments[i]) + 1;
        addFinding('brags-categories-valid', 'error', 'brags', bragsPath, lineNum,
          `Entry references non-existent category: "${category}"`);
      }
    }
  }
}

// ============================================================================
// PLUGIN BUILD DRIFT CHECKS
// ============================================================================

function hashDirectory(dirPath) {
  const hash = createHash('sha256');
  const entries = fs.readdirSync(dirPath, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    hash.update(entry.name);

    if (entry.isDirectory()) {
      hash.update(hashDirectory(fullPath));
    } else {
      const content = fs.readFileSync(fullPath);
      hash.update(createHash('sha256').update(content).digest('hex'));
    }
  }

  return hash.digest('hex');
}

function checkPluginSkillsDrift(ctx) {
  const repoSkillsDir = path.join(REPO_ROOT, 'skills');
  const coreSkillsDir = path.join(REPO_ROOT, 'core/skills');

  // If skills/ doesn't exist, that's a WARNING (fresh clone may not have built yet)
  if (!fileExists(repoSkillsDir)) {
    addFinding('plugin-skills-drift', 'warning', 'plugin', repoSkillsDir, null,
      `Plugin skills directory does not exist — run 'npm run build-plugin' to generate it`);
    return;
  }

  // Get all skills from both directories
  const coreSkills = fileExists(coreSkillsDir)
    ? fs.readdirSync(coreSkillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
    : [];

  const repoSkills = fs.readdirSync(repoSkillsDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);

  const drifted = [];
  const missing = [];
  const extra = [];

  // Check each core skill
  for (const skillName of coreSkills) {
    const corePath = path.join(coreSkillsDir, skillName);
    const repoPath = path.join(repoSkillsDir, skillName);

    if (!fileExists(repoPath)) {
      missing.push(skillName);
    } else {
      // Compare by hash
      const coreHash = hashDirectory(corePath);
      const repoHash = hashDirectory(repoPath);

      if (coreHash !== repoHash) {
        drifted.push(skillName);
      }
    }
  }

  // Check for extra skills in repo that aren't in core
  for (const skillName of repoSkills) {
    if (!coreSkills.includes(skillName)) {
      extra.push(skillName);
    }
  }

  // Report findings
  if (drifted.length > 0 || missing.length > 0 || extra.length > 0) {
    const problems = [];
    if (drifted.length > 0) {
      problems.push(`drifted: ${drifted.join(', ')}`);
    }
    if (missing.length > 0) {
      problems.push(`missing: ${missing.join(', ')}`);
    }
    if (extra.length > 0) {
      problems.push(`extra: ${extra.join(', ')}`);
    }

    addFinding('plugin-skills-drift', 'error', 'plugin', repoSkillsDir, null,
      `Plugin skills directory out of sync with core/skills/ (${problems.join('; ')}) — run 'npm run build-plugin'`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

function showHelp() {
  console.log(`edwin-doctor v${DOCTOR_VERSION}

Structure validator for the EDWIN framework.

Usage:
  edwin-doctor                 Validate entire repo
  edwin-doctor --skill <path>  Validate single skill (directory or SKILL.md)
  edwin-doctor --json          Output JSON to stdout
  edwin-doctor --quiet         Show errors only
  edwin-doctor --root <path>   Use alternate repo root (for testing)
  edwin-doctor --help          Show this help

Exit codes:
  0 - Success (warnings allowed)
  1 - Validation failed (errors present)
  2 - Bad usage
`);
}

async function main() {
  if (flags.help) {
    showHelp();
    process.exit(0);
  }

  // Check Node version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 18) {
    console.error(`Error: Node.js 18 or higher required (current: ${nodeVersion})`);
    process.exit(2);
  }

  // Shared context for checks
  const ctx = {
    skills: null,
    contextsData: null,
  };

  // If --skill, validate just that skill
  if (flags.skill) {
    let skillPath = flags.skill;

    // If it's a SKILL.md path, get the directory
    if (skillPath.endsWith('SKILL.md')) {
      skillPath = path.dirname(skillPath);
    }

    const skillName = path.basename(skillPath);
    ctx.skills = [skillName];

    // Run only skill-scoped checks
    const skillChecks = checks.filter(c => c.group === 'skills');

    // Also need contexts data for validation
    checks.find(c => c.id === 'contexts-parse')?.run(ctx);

    for (const check of skillChecks) {
      check.run(ctx);
    }
  } else {
    // Run all checks
    for (const check of checks) {
      check.run(ctx);
    }
  }

  // Output
  const errors = findings.filter(f => f.level === 'error');
  const warnings = findings.filter(f => f.level === 'warning');

  if (flags.json) {
    const output = {
      ok: errors.length === 0,
      version: DOCTOR_VERSION,
      counts: {
        errors: errors.length,
        warnings: warnings.length,
      },
      findings: findings,
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    // Human-readable output
    if (findings.length === 0) {
      if (!flags.quiet) {
        console.log('✓ All checks passed');
      }
    } else {
      // Group by category
      const groups = {};
      for (const finding of findings) {
        if (!groups[finding.group]) {
          groups[finding.group] = [];
        }
        groups[finding.group].push(finding);
      }

      for (const [group, items] of Object.entries(groups)) {
        if (flags.quiet && items.every(f => f.level === 'warning')) {
          continue;
        }

        console.log(`\n${group.toUpperCase()}`);
        for (const item of items) {
          const icon = item.level === 'error' ? '✗' : '⚠';
          const location = item.line ? `${item.file}:${item.line}` : item.file;
          console.log(`  ${icon} ${item.message}`);
          console.log(`    ${location}`);
        }
      }

      console.log(`\nSummary: ${errors.length} error(s), ${warnings.length} warning(s)`);
    }
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(2);
});
