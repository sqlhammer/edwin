#!/usr/bin/env node
/**
 * context.mjs
 *
 * Context manager script for EDWIN v0.2
 *
 * Manages:
 * - Active context (user/state.json)
 * - Context definitions (core/contexts/contexts.json)
 * - Skill→context assignments (skill frontmatter)
 * - Context rename propagation
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

// Version check
const nodeVersion = process.versions.node.split('.').map(Number);
if (nodeVersion[0] < 18) {
  console.error(`Error: Node.js >= 18 is required (found ${process.version})`);
  process.exit(2);
}

// Resolve repo root. --root is scanned before path resolution because every path
// below is derived from it; it lets the tool be exercised against a scratch tree
// instead of the real repository.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootFlagIndex = process.argv.indexOf('--root');
const rootOverride = rootFlagIndex !== -1 ? process.argv[rootFlagIndex + 1] : null;
if (rootFlagIndex !== -1 && (!rootOverride || rootOverride.startsWith('--'))) {
  console.error('Error: --root requires a path');
  process.exit(2);
}
const REPO_ROOT = rootOverride || resolve(__dirname, '..', '..');
const CORE_DIR = join(REPO_ROOT, 'core');
const USER_DIR = join(REPO_ROOT, 'user');
const CONTEXTS_JSON = join(CORE_DIR, 'contexts', 'contexts.json');
const SKILLS_DIR = join(CORE_DIR, 'skills');
const CONFIG_PATH = join(USER_DIR, 'config.json');
const STATE_PATH = join(USER_DIR, 'state.json');

// Import mini-yaml parser
const miniYamlPath = join(REPO_ROOT, 'tools', 'validate', 'lib', 'mini-yaml.mjs');
let extractFrontmatter;
try {
  const miniYaml = await import(miniYamlPath);
  extractFrontmatter = miniYaml.extractFrontmatter;
} catch (err) {
  // Fallback: minimal parser if mini-yaml is unavailable
  extractFrontmatter = (content) => {
    const lines = content.split('\n');
    if (lines[0].trim() !== '---') return { frontmatter: null, content, error: null };

    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) return { frontmatter: null, content, error: 'No closing fence' };

    const yamlLines = lines.slice(1, endIndex);
    const remainingContent = lines.slice(endIndex + 1).join('\n');

    // Minimal parsing: key: value
    const frontmatter = {};
    yamlLines.forEach(line => {
      const match = line.match(/^([a-z-]+):\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        if (value === 'all') {
          frontmatter[key] = 'all';
        } else if (value.startsWith('[') && value.endsWith(']')) {
          frontmatter[key] = value.slice(1, -1).split(',').map(s => s.trim());
        } else {
          frontmatter[key] = value;
        }
      }
    });

    return { frontmatter, content: remainingContent, error: null };
  };
}

// Global options
let DRY_RUN = false;
let JSON_OUTPUT = false;

// ============================================================================
// Helper Functions
// ============================================================================

function ensureUserDir() {
  if (!existsSync(USER_DIR)) {
    if (DRY_RUN) {
      return { created: true, path: USER_DIR };
    }
    mkdirSync(USER_DIR, { recursive: true });
  }
  return { created: false, path: USER_DIR };
}

function readJSON(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse ${path}: ${err.message}`);
  }
}

function writeJSON(path, data, opts = {}) {
  if (DRY_RUN && !opts.force) {
    return { written: false, dryRun: true, path };
  }
  ensureUserDir();
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return { written: true, path };
}

function readContextsJSON() {
  const data = readJSON(CONTEXTS_JSON);
  if (!data) throw new Error(`Cannot read ${CONTEXTS_JSON}`);
  return data;
}

function writeContextsJSON(data) {
  if (DRY_RUN) {
    return { written: false, dryRun: true };
  }
  writeFileSync(CONTEXTS_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return { written: true };
}

function readState() {
  const state = readJSON(STATE_PATH);
  if (!state) {
    // Default state
    return {
      schemaVersion: 1,
      activeContext: 'Global',
      offTheRecord: false,
      lastSync: new Date().toISOString()
    };
  }
  return state;
}

function writeState(state) {
  return writeJSON(STATE_PATH, state);
}

function validateContextExists(name, contexts) {
  return contexts.contexts.some(c => c.name === name);
}

function listAllSkills() {
  const skills = [];
  const entries = readdirSync(SKILLS_DIR);

  for (const entry of entries) {
    const skillPath = join(SKILLS_DIR, entry);
    if (!statSync(skillPath).isDirectory()) continue;

    const skillFile = join(skillPath, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    skills.push({ name: entry, path: skillFile });
  }

  return skills;
}

function readSkillFrontmatter(skillPath) {
  const content = readFileSync(skillPath, 'utf8');
  const { frontmatter, error } = extractFrontmatter(content);

  if (error) {
    return { frontmatter: null, error, content };
  }

  return { frontmatter, error: null, content };
}

function writeSkillFrontmatter(skillPath, newContexts) {
  const content = readFileSync(skillPath, 'utf8');
  const lines = content.split('\n');

  // Find frontmatter boundaries
  if (lines[0].trim() !== '---') {
    throw new Error(`No frontmatter in ${skillPath}`);
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    throw new Error(`No closing frontmatter fence in ${skillPath}`);
  }

  // Find and replace contexts: line
  let contextsLineIndex = -1;
  for (let i = 1; i < endIndex; i++) {
    if (lines[i].match(/^contexts:/)) {
      contextsLineIndex = i;
      break;
    }
  }

  if (contextsLineIndex === -1) {
    // No contexts key — insert it after name/description
    let insertIndex = 1;
    for (let i = 1; i < endIndex; i++) {
      if (lines[i].match(/^description:/)) {
        insertIndex = i + 1;
        break;
      }
    }
    lines.splice(insertIndex, 0, formatContextsLine(newContexts));
  } else {
    // Replace existing line
    lines[contextsLineIndex] = formatContextsLine(newContexts);
  }

  if (DRY_RUN) {
    return { written: false, dryRun: true, path: skillPath };
  }

  writeFileSync(skillPath, lines.join('\n'), 'utf8');
  return { written: true, path: skillPath };
}

function formatContextsLine(contexts) {
  if (contexts === 'all' || (Array.isArray(contexts) && contexts.length === 0)) {
    return 'contexts: all';
  }
  if (Array.isArray(contexts)) {
    return `contexts: [${contexts.join(', ')}]`;
  }
  return 'contexts: all';
}

function parseContextsValue(value) {
  if (value === 'all') return 'all';
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    if (value === 'all') return 'all';
    // Handle flow form: [A, B, C]
    const match = value.match(/^\[(.*)\]$/);
    if (match) {
      return match[1].split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function groupSkillsByContext(skills, contextsData) {
  const groups = {};
  const contextNames = contextsData.contexts.map(c => c.name);
  const personaSkills = [];

  // Initialize groups
  contextNames.forEach(name => {
    groups[name] = [];
  });
  groups['all'] = [];
  groups['none'] = [];

  for (const skill of skills) {
    const { frontmatter } = readSkillFrontmatter(skill.path);

    if (!frontmatter) {
      groups['none'].push({ name: skill.name, type: null });
      continue;
    }

    // Check if persona type
    if (frontmatter.type === 'persona') {
      personaSkills.push({ name: skill.name, type: 'persona', contexts: parseContextsValue(frontmatter.contexts || 'all') });
      continue;
    }

    const contexts = parseContextsValue(frontmatter.contexts || 'all');

    if (contexts === 'all') {
      groups['all'].push({ name: skill.name, type: null, contexts: 'all' });
    } else if (Array.isArray(contexts) && contexts.length === 0) {
      groups['none'].push({ name: skill.name, type: null });
    } else if (Array.isArray(contexts)) {
      contexts.forEach(ctx => {
        if (groups[ctx]) {
          groups[ctx].push({ name: skill.name, type: null, contexts });
        }
      });
    }
  }

  return { groups, personaSkills };
}

// ============================================================================
// Commands
// ============================================================================

function getActive() {
  const state = readState();

  if (JSON_OUTPUT) {
    return { activeContext: state.activeContext };
  }

  console.log(state.activeContext);
  return { activeContext: state.activeContext };
}

function setActive(contextName) {
  const contextsData = readContextsJSON();

  if (!validateContextExists(contextName, contextsData)) {
    if (JSON_OUTPUT) {
      return { success: false, error: `Context "${contextName}" does not exist`, exists: false };
    }
    console.error(`Error: Context "${contextName}" does not exist. Create it first with: add-context "${contextName}" "<description>"`);
    process.exit(1);
  }

  const state = readState();
  state.activeContext = contextName;
  state.lastSync = new Date().toISOString();

  const result = writeState(state);

  if (JSON_OUTPUT) {
    return { success: true, activeContext: contextName, ...result };
  }

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would set active context to: ${contextName}`);
  } else {
    console.log(`Active context set to: ${contextName}`);
  }

  return { success: true, activeContext: contextName };
}

function listContexts() {
  const data = readContextsJSON();

  if (JSON_OUTPUT) {
    return { contexts: data.contexts };
  }

  console.log('Contexts:');
  data.contexts.forEach(ctx => {
    const builtin = ctx.builtin ? ' [builtin]' : '';
    console.log(`  ${ctx.name}${builtin} — ${ctx.description}`);
  });

  return { contexts: data.contexts };
}

function addContext(name, description) {
  const data = readContextsJSON();

  if (validateContextExists(name, data)) {
    if (JSON_OUTPUT) {
      return { success: false, error: `Context "${name}" already exists` };
    }
    console.error(`Error: Context "${name}" already exists`);
    process.exit(1);
  }

  data.contexts.push({ name, description });
  const result = writeContextsJSON(data);

  if (JSON_OUTPUT) {
    return { success: true, created: name, ...result };
  }

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would create context: ${name}`);
  } else {
    console.log(`Context created: ${name}`);
  }

  return { success: true, created: name };
}

function renameContext(oldName, newName) {
  const data = readContextsJSON();

  const ctx = data.contexts.find(c => c.name === oldName);
  if (!ctx) {
    if (JSON_OUTPUT) {
      return { success: false, error: `Context "${oldName}" does not exist` };
    }
    console.error(`Error: Context "${oldName}" does not exist`);
    process.exit(1);
  }

  if (ctx.builtin) {
    if (JSON_OUTPUT) {
      return { success: false, error: 'Cannot rename the Global context' };
    }
    console.error('Error: Cannot rename the Global context');
    process.exit(1);
  }

  if (validateContextExists(newName, data)) {
    if (JSON_OUTPUT) {
      return { success: false, error: `Context "${newName}" already exists` };
    }
    console.error(`Error: Context "${newName}" already exists`);
    process.exit(1);
  }

  // Rename in contexts.json
  ctx.name = newName;
  writeContextsJSON(data);

  // Propagate to all skills
  const skills = listAllSkills();
  const updated = [];

  for (const skill of skills) {
    const { frontmatter, error } = readSkillFrontmatter(skill.path);
    if (error || !frontmatter || !frontmatter.contexts) continue;

    const contexts = parseContextsValue(frontmatter.contexts);
    if (contexts === 'all') continue;

    if (Array.isArray(contexts) && contexts.includes(oldName)) {
      const newContexts = contexts.map(c => c === oldName ? newName : c);
      try {
        writeSkillFrontmatter(skill.path, newContexts);
        updated.push(skill.name);
      } catch (err) {
        console.error(`Warning: Could not update ${skill.name}: ${err.message}`);
      }
    }
  }

  // Update activeContext in state if it matches
  const state = readState();
  if (state.activeContext === oldName) {
    state.activeContext = newName;
    writeState(state);
  }

  if (JSON_OUTPUT) {
    return { success: true, renamed: { from: oldName, to: newName }, skillsUpdated: updated };
  }

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would rename context "${oldName}" to "${newName}"`);
    console.log(`[DRY RUN] Would update ${updated.length} skill(s): ${updated.join(', ')}`);
  } else {
    console.log(`Context renamed: "${oldName}" → "${newName}"`);
    if (updated.length > 0) {
      console.log(`Updated ${updated.length} skill(s): ${updated.join(', ')}`);
    }
  }

  return { success: true, renamed: { from: oldName, to: newName }, skillsUpdated: updated };
}

function removeContext(name) {
  const data = readContextsJSON();

  const ctx = data.contexts.find(c => c.name === name);
  if (!ctx) {
    if (JSON_OUTPUT) {
      return { success: false, error: `Context "${name}" does not exist` };
    }
    console.error(`Error: Context "${name}" does not exist`);
    process.exit(1);
  }

  if (ctx.builtin) {
    if (JSON_OUTPUT) {
      return { success: false, error: 'Cannot remove the Global context' };
    }
    console.error('Error: Cannot remove the Global context');
    process.exit(1);
  }

  // Find skills that reference this context
  const skills = listAllSkills();
  const affected = [];

  for (const skill of skills) {
    const { frontmatter, error } = readSkillFrontmatter(skill.path);
    if (error || !frontmatter || !frontmatter.contexts) continue;

    const contexts = parseContextsValue(frontmatter.contexts);
    if (contexts !== 'all' && Array.isArray(contexts) && contexts.includes(name)) {
      affected.push(skill.name);
    }
  }

  // Remove from contexts.json
  data.contexts = data.contexts.filter(c => c.name !== name);
  writeContextsJSON(data);

  // Remove from all skill frontmatter
  for (const skill of skills) {
    const { frontmatter, error } = readSkillFrontmatter(skill.path);
    if (error || !frontmatter || !frontmatter.contexts) continue;

    const contexts = parseContextsValue(frontmatter.contexts);
    if (contexts === 'all') continue;

    if (Array.isArray(contexts) && contexts.includes(name)) {
      const newContexts = contexts.filter(c => c !== name);
      try {
        writeSkillFrontmatter(skill.path, newContexts.length === 0 ? 'all' : newContexts);
      } catch (err) {
        console.error(`Warning: Could not update ${skill.name}: ${err.message}`);
      }
    }
  }

  // Reset activeContext if it was this context
  const state = readState();
  if (state.activeContext === name) {
    state.activeContext = 'Global';
    writeState(state);
  }

  if (JSON_OUTPUT) {
    return { success: true, removed: name, skillsAffected: affected };
  }

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would remove context: ${name}`);
    if (affected.length > 0) {
      console.log(`[DRY RUN] Would affect ${affected.length} skill(s): ${affected.join(', ')}`);
      console.log(`[DRY RUN] These skills would become context: all`);
    }
  } else {
    console.log(`Context removed: ${name}`);
    if (affected.length > 0) {
      console.log(`Affected ${affected.length} skill(s): ${affected.join(', ')}`);
    }
  }

  return { success: true, removed: name, skillsAffected: affected };
}

function listSkills(contextFilter) {
  const contextsData = readContextsJSON();
  const skills = listAllSkills();
  const { groups, personaSkills } = groupSkillsByContext(skills, contextsData);

  if (JSON_OUTPUT) {
    return { groups, personaSkills };
  }

  if (contextFilter) {
    // List only the specified context
    if (!validateContextExists(contextFilter, contextsData) && contextFilter !== 'all') {
      console.error(`Error: Context "${contextFilter}" does not exist`);
      process.exit(1);
    }

    const contextSkills = groups[contextFilter] || [];
    console.log(`Skills in context "${contextFilter}":`);
    if (contextSkills.length === 0) {
      console.log('  (none)');
    } else {
      contextSkills.forEach(s => console.log(`  ${s.name}`));
    }

    return { context: contextFilter, skills: contextSkills };
  }

  // List all, grouped by context
  const state = readState();
  const activeContext = state.activeContext;

  // Show active context first
  if (groups[activeContext] && groups[activeContext].length > 0) {
    console.log(`${activeContext} (active):`);
    groups[activeContext].forEach(s => console.log(`  ${s.name}`));
    console.log('');
  }

  // Then other contexts
  contextsData.contexts.forEach(ctx => {
    if (ctx.name === activeContext) return;
    if (groups[ctx.name] && groups[ctx.name].length > 0) {
      console.log(`${ctx.name}:`);
      groups[ctx.name].forEach(s => console.log(`  ${s.name}`));
      console.log('');
    }
  });

  // Then 'all' context skills
  if (groups['all'] && groups['all'].length > 0) {
    console.log('All contexts:');
    groups['all'].forEach(s => console.log(`  ${s.name}`));
    console.log('');
  }

  // Then persona skills
  if (personaSkills.length > 0) {
    console.log('Persona skills:');
    personaSkills.forEach(s => console.log(`  ${s.name}`));
    console.log('');
  }

  // Then skills with no context
  if (groups['none'] && groups['none'].length > 0) {
    console.log('No context (needs frontmatter):');
    groups['none'].forEach(s => console.log(`  ${s.name}`));
  }

  return { groups, personaSkills };
}

function assignSkill(skillName, contextName) {
  const contextsData = readContextsJSON();

  if (!validateContextExists(contextName, contextsData)) {
    if (JSON_OUTPUT) {
      return { success: false, error: `Context "${contextName}" does not exist` };
    }
    console.error(`Error: Context "${contextName}" does not exist`);
    process.exit(1);
  }

  const skills = listAllSkills();
  const skill = skills.find(s => s.name === skillName);

  if (!skill) {
    if (JSON_OUTPUT) {
      return { success: false, error: `Skill "${skillName}" not found` };
    }
    console.error(`Error: Skill "${skillName}" not found`);
    process.exit(1);
  }

  const { frontmatter, error } = readSkillFrontmatter(skill.path);

  if (error || !frontmatter) {
    if (JSON_OUTPUT) {
      return { success: false, error: `Cannot read frontmatter from ${skillName}: ${error || 'no frontmatter'}` };
    }
    console.error(`Error: Cannot read frontmatter from ${skillName}: ${error || 'no frontmatter'}`);
    process.exit(1);
  }

  let contexts = parseContextsValue(frontmatter.contexts || 'all');

  if (contexts === 'all') {
    contexts = [contextName];
  } else if (Array.isArray(contexts)) {
    if (contexts.includes(contextName)) {
      if (JSON_OUTPUT) {
        return { success: true, alreadyAssigned: true, skill: skillName, context: contextName };
      }
      console.log(`Skill "${skillName}" is already in context "${contextName}"`);
      return { success: true, alreadyAssigned: true };
    }
    contexts.push(contextName);
  }

  writeSkillFrontmatter(skill.path, contexts);

  if (JSON_OUTPUT) {
    return { success: true, assigned: { skill: skillName, context: contextName } };
  }

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would assign "${skillName}" to context "${contextName}"`);
  } else {
    console.log(`Assigned "${skillName}" to context "${contextName}"`);
  }

  return { success: true, assigned: { skill: skillName, context: contextName } };
}

function unassignSkill(skillName, contextName) {
  const contextsData = readContextsJSON();

  if (!validateContextExists(contextName, contextsData)) {
    if (JSON_OUTPUT) {
      return { success: false, error: `Context "${contextName}" does not exist` };
    }
    console.error(`Error: Context "${contextName}" does not exist`);
    process.exit(1);
  }

  const skills = listAllSkills();
  const skill = skills.find(s => s.name === skillName);

  if (!skill) {
    if (JSON_OUTPUT) {
      return { success: false, error: `Skill "${skillName}" not found` };
    }
    console.error(`Error: Skill "${skillName}" not found`);
    process.exit(1);
  }

  const { frontmatter, error } = readSkillFrontmatter(skill.path);

  if (error || !frontmatter) {
    if (JSON_OUTPUT) {
      return { success: false, error: `Cannot read frontmatter from ${skillName}: ${error || 'no frontmatter'}` };
    }
    console.error(`Error: Cannot read frontmatter from ${skillName}: ${error || 'no frontmatter'}`);
    process.exit(1);
  }

  let contexts = parseContextsValue(frontmatter.contexts || 'all');

  if (contexts === 'all') {
    if (JSON_OUTPUT) {
      return { success: false, error: `Skill "${skillName}" is in all contexts; cannot unassign from a specific one` };
    }
    console.error(`Error: Skill "${skillName}" is in all contexts; cannot unassign from a specific one`);
    process.exit(1);
  }

  if (Array.isArray(contexts)) {
    if (!contexts.includes(contextName)) {
      if (JSON_OUTPUT) {
        return { success: true, notAssigned: true, skill: skillName, context: contextName };
      }
      console.log(`Skill "${skillName}" is not in context "${contextName}"`);
      return { success: true, notAssigned: true };
    }

    const newContexts = contexts.filter(c => c !== contextName);
    writeSkillFrontmatter(skill.path, newContexts.length === 0 ? 'all' : newContexts);
  }

  if (JSON_OUTPUT) {
    return { success: true, unassigned: { skill: skillName, context: contextName } };
  }

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would unassign "${skillName}" from context "${contextName}"`);
  } else {
    console.log(`Unassigned "${skillName}" from context "${contextName}"`);
  }

  return { success: true, unassigned: { skill: skillName, context: contextName } };
}

// ============================================================================
// CLI
// ============================================================================

const USAGE = `
context.mjs - EDWIN context manager

USAGE:
  node context.mjs <command> [args] [options]

COMMANDS:
  get-active                           Get the current active context
  set-active <context>                 Set the active context

  list-contexts                        List all contexts
  add-context <name> <description>     Add a new context
  rename-context <old> <new>           Rename a context (propagates to all skills)
  remove-context <name>                Remove a context (drops tag from all skills)

  list-skills [--context <name>]       List skills, grouped by context
  assign-skill <skill> <context>       Assign a skill to a context
  unassign-skill <skill> <context>     Remove a skill from a context

OPTIONS:
  --help          Show this help
  --dry-run       Show what would be done without doing it
  --json          Output results as JSON
  --root <path>   Operate on a tree other than this repo (expects <path>/core/ and <path>/user/).
                  Use this to test the tool without touching real repository data.

EXIT CODES:
  0   Success
  1   Expected failure (e.g., context doesn't exist)
  2   Bad usage (e.g., wrong arguments)

EXAMPLES:
  node context.mjs get-active
  node context.mjs set-active Work
  node context.mjs add-context Travel "Travel planning and bookings"
  node context.mjs rename-context Home Personal
  node context.mjs assign-skill researcher Work
  node context.mjs list-skills --context Work
  node context.mjs list-skills --json
`;

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
  }

  // Parse global flags
  DRY_RUN = args.includes('--dry-run');
  JSON_OUTPUT = args.includes('--json');

  // Filter out flags and their values (like --root <path>)
  const cleanArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      // Skip flag and its value if it's a value-taking flag
      if (args[i] === '--root' || args[i] === '--context') {
        i++; // Skip the next argument (the value)
      }
    } else {
      cleanArgs.push(args[i]);
    }
  }
  const command = cleanArgs[0];

  try {
    let result;

    switch (command) {
      case 'get-active':
        result = getActive();
        break;

      case 'set-active':
        if (cleanArgs.length < 2) {
          console.error('Error: set-active requires a context name');
          console.error('Usage: node context.mjs set-active <context>');
          process.exit(2);
        }
        result = setActive(cleanArgs[1]);
        break;

      case 'list-contexts':
        result = listContexts();
        break;

      case 'add-context':
        if (cleanArgs.length < 3) {
          console.error('Error: add-context requires a name and description');
          console.error('Usage: node context.mjs add-context <name> "<description>"');
          process.exit(2);
        }
        result = addContext(cleanArgs[1], cleanArgs.slice(2).join(' '));
        break;

      case 'rename-context':
        if (cleanArgs.length < 3) {
          console.error('Error: rename-context requires old and new names');
          console.error('Usage: node context.mjs rename-context <old> <new>');
          process.exit(2);
        }
        result = renameContext(cleanArgs[1], cleanArgs[2]);
        break;

      case 'remove-context':
        if (cleanArgs.length < 2) {
          console.error('Error: remove-context requires a context name');
          console.error('Usage: node context.mjs remove-context <name>');
          process.exit(2);
        }
        result = removeContext(cleanArgs[1]);
        break;

      case 'list-skills': {
        const contextFlagIndex = args.indexOf('--context');
        const contextFilter = contextFlagIndex !== -1 ? args[contextFlagIndex + 1] : null;
        result = listSkills(contextFilter);
        break;
      }

      case 'assign-skill':
        if (cleanArgs.length < 3) {
          console.error('Error: assign-skill requires skill name and context');
          console.error('Usage: node context.mjs assign-skill <skill> <context>');
          process.exit(2);
        }
        result = assignSkill(cleanArgs[1], cleanArgs[2]);
        break;

      case 'unassign-skill':
        if (cleanArgs.length < 3) {
          console.error('Error: unassign-skill requires skill name and context');
          console.error('Usage: node context.mjs unassign-skill <skill> <context>');
          process.exit(2);
        }
        result = unassignSkill(cleanArgs[1], cleanArgs[2]);
        break;

      default:
        console.error(`Error: Unknown command "${command}"`);
        console.log(USAGE);
        process.exit(2);
    }

    if (JSON_OUTPUT && result) {
      console.log(JSON.stringify(result, null, 2));
    }

    process.exit(0);
  } catch (err) {
    if (JSON_OUTPUT) {
      console.error(JSON.stringify({ success: false, error: err.message }));
    } else {
      console.error(`Error: ${err.message}`);
    }
    process.exit(1);
  }
}

main();
