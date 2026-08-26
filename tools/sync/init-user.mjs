#!/usr/bin/env node

/**
 * init-user.mjs
 *
 * Initializes user/ folder with config.json and state.json.
 * Called by the edwin-setup skill during first-run onboarding.
 *
 * Usage:
 *   node tools/sync/init-user.mjs [options]
 *
 * Options:
 *   --name <name>              User's name (required)
 *   --address-as <name>        How to address the user (defaults to --name)
 *   --os <os>                  Operating system: windows, macos, linux (required)
 *   --harness <harness>        Harness: claude-code, claude-desktop, cowork, web (required)
 *   --contexts <ctx,ctx>       Comma-separated context list (defaults to "Global")
 *   --verbosity <level>        Verbosity: concise, detailed (defaults to concise)
 *   --force                    Overwrite existing config files
 *   --dry-run                  Print what would be written without writing
 *   --json                     Output JSON result to stdout (suppresses other output)
 *   --help                     Show this help
 *
 * Exit codes:
 *   0 - Success
 *   1 - Expected failure (files exist, validation failed)
 *   2 - Bad usage
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Node version check
const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
if (nodeMajor < 18) {
  console.error(`Error: Node.js >= 18 required. You have ${process.version}.`);
  process.exit(2);
}

// Resolve repo root (script is in tools/sync/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..', '..');
const USER_DIR = join(REPO_ROOT, 'user');
const CONFIG_PATH = join(USER_DIR, 'config.json');
const STATE_PATH = join(USER_DIR, 'state.json');

// Parse args
const args = process.argv.slice(2);
const opts = {
  name: null,
  addressAs: null,
  os: null,
  harness: null,
  contexts: ['Global'],
  verbosity: 'concise',
  force: false,
  dryRun: false,
  json: false,
  help: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const next = args[i + 1];

  switch (arg) {
    case '--help':
      opts.help = true;
      break;
    case '--name':
      opts.name = next;
      i++;
      break;
    case '--address-as':
      opts.addressAs = next;
      i++;
      break;
    case '--os':
      opts.os = next;
      i++;
      break;
    case '--harness':
      opts.harness = next;
      i++;
      break;
    case '--contexts':
      opts.contexts = next ? next.split(',').map(c => c.trim()) : ['Global'];
      i++;
      break;
    case '--verbosity':
      opts.verbosity = next || 'concise';
      i++;
      break;
    case '--force':
      opts.force = true;
      break;
    case '--dry-run':
      opts.dryRun = true;
      break;
    case '--json':
      opts.json = true;
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
    .slice(3, 30)
    .map(line => line.replace(/^ \* ?/, ''))
    .join('\n');
  console.log(help);
  process.exit(0);
}

// Validation
const validOs = ['windows', 'macos', 'linux'];
const validHarness = ['claude-code', 'claude-desktop', 'cowork', 'web'];
const validVerbosity = ['concise', 'detailed'];

if (!opts.name) {
  error('--name is required', 2);
}
if (!opts.os || !validOs.includes(opts.os)) {
  error(`--os must be one of: ${validOs.join(', ')}`, 2);
}
if (!opts.harness || !validHarness.includes(opts.harness)) {
  error(`--harness must be one of: ${validHarness.join(', ')}`, 2);
}
if (!validVerbosity.includes(opts.verbosity)) {
  error(`--verbosity must be one of: ${validVerbosity.join(', ')}`, 2);
}

// Default addressAs to name if not provided
if (!opts.addressAs) {
  opts.addressAs = opts.name;
}

// Check for existing files
const configExists = existsSync(CONFIG_PATH);
const stateExists = existsSync(STATE_PATH);

if ((configExists || stateExists) && !opts.force && !opts.dryRun) {
  const existing = [
    configExists ? 'config.json' : null,
    stateExists ? 'state.json' : null,
  ].filter(Boolean).join(' and ');

  error(`${existing} already exist. Use --force to overwrite.`, 1);
}

// Build config and state objects
const config = {
  schemaVersion: 1,
  name: opts.name,
  addressAs: opts.addressAs,
  os: opts.os,
  harness: opts.harness,
  contextsOwned: opts.contexts,
  preferences: {
    verbosity: opts.verbosity,
    memoryCapture: true,
    bragDetection: true,
    workflowObservation: true,
  },
  publish: { remote: '', branch: 'main' },
  positioning: '',
};

const state = {
  schemaVersion: 1,
  activeContext: 'Global',
  offTheRecord: false,
  lastSync: new Date().toISOString(),
};

// JSON output mode
if (opts.json) {
  console.log(JSON.stringify({ config, state }, null, 2));
  process.exit(0);
}

// Dry-run mode
if (opts.dryRun) {
  log('Dry run — no files written.\n');
  log('Would write to:', CONFIG_PATH);
  log(JSON.stringify(config, null, 2));
  log('\nWould write to:', STATE_PATH);
  log(JSON.stringify(state, null, 2));
  process.exit(0);
}

// Ensure user/ exists
if (!existsSync(USER_DIR)) {
  mkdirSync(USER_DIR, { recursive: true });
}

// Write files
try {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');
  log(`Initialized ${opts.name}'s configuration.`);
  log(`  ${CONFIG_PATH}`);
  log(`  ${STATE_PATH}`);
  process.exit(0);
} catch (err) {
  error(`Failed to write files: ${err.message}`, 1);
}

// Helpers
function log(...args) {
  if (!opts.json) console.log(...args);
}

function error(message, code) {
  if (opts.json) {
    console.error(JSON.stringify({ error: message }, null, 2));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(code);
}
