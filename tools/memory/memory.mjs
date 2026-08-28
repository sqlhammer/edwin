#!/usr/bin/env node

/**
 * memory.mjs
 *
 * EDWIN memory management CLI.
 * Manages user/memory/ files: memory.md, digest.md, pending.md.
 *
 * Usage:
 *   node tools/memory/memory.mjs append <section> "<entry>" [--context <ctx>]
 *   node tools/memory/memory.mjs edit <line> "<new-entry>"
 *   node tools/memory/memory.mjs tombstone "<entry>"
 *   node tools/memory/memory.mjs regenerate-digest
 *   node tools/memory/memory.mjs confirm-pending <index>
 *   node tools/memory/memory.mjs list [--section <name>]
 *
 * Options:
 *   --context <name>    Context tag for new entries (default: Global)
 *   --section <name>    Filter by section for list command
 *   --dry-run           Show what would be done without writing
 *   --json              Output JSON result
 *   --root <path>       Operate on a tree other than this repo (expects <path>/user/memory/).
 *                       Use this to test the tool without touching real personal data.
 *   --help              Show this help
 *
 * Exit codes:
 *   0 - Success
 *   1 - Expected failure
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

// Resolve repo root. --root is scanned before the main arg loop because every path
// below is derived from it; it lets the tool be exercised against a scratch tree
// instead of the user's real personal data.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootFlagIndex = process.argv.indexOf('--root');
const rootOverride = rootFlagIndex !== -1 ? process.argv[rootFlagIndex + 1] : null;
if (rootFlagIndex !== -1 && (!rootOverride || rootOverride.startsWith('--'))) {
  console.error('Error: --root requires a path');
  process.exit(2);
}
const REPO_ROOT = rootOverride || join(__dirname, '..', '..');
const USER_DIR = join(REPO_ROOT, 'user');
const MEMORY_DIR = join(USER_DIR, 'memory');
const MEMORY_PATH = join(MEMORY_DIR, 'memory.md');
const DIGEST_PATH = join(MEMORY_DIR, 'digest.md');
const PENDING_PATH = join(MEMORY_DIR, 'pending.md');
const TEMPLATE_PATH = join(REPO_ROOT, 'core', 'templates', 'memory.md.tmpl');

// Parse args
const args = process.argv.slice(2);
const opts = {
  command: null,
  args: [],
  context: 'Global',
  section: null,
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
    case '--context':
      opts.context = next;
      i++;
      break;
    case '--section':
      opts.section = next;
      i++;
      break;
    case '--dry-run':
      opts.dryRun = true;
      break;
    case '--json':
      opts.json = true;
      break;
    case '--root':
      // Already handled above, skip the value
      i++;
      break;
    default:
      if (!opts.command && !arg.startsWith('--')) {
        opts.command = arg;
      } else if (!arg.startsWith('--')) {
        opts.args.push(arg);
      } else {
        error(`Unknown option: ${arg}`, 2);
      }
  }
}

// Help
if (opts.help || !opts.command) {
  const help = readFileSync(__filename, 'utf-8')
    .split('\n')
    .slice(3, 25)
    .map(line => line.replace(/^ \* ?/, ''))
    .join('\n');
  console.log(help);
  process.exit(0);
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

function ensureMemoryDir() {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function initializeMemoryFile() {
  ensureMemoryDir();
  if (!existsSync(MEMORY_PATH)) {
    const template = existsSync(TEMPLATE_PATH)
      ? readFileSync(TEMPLATE_PATH, 'utf-8')
      : `# EDWIN Memory\n\n## Preferences\n\n## People\n\n## Work patterns\n\n## Facts\n\n## Dislikes\n\n---\n\n## Tombstones\n`;
    writeFileSync(MEMORY_PATH, template, 'utf-8');
  }
}

function readMemory() {
  if (!existsSync(MEMORY_PATH)) {
    return null;
  }
  return readFileSync(MEMORY_PATH, 'utf-8');
}

function writeMemory(content) {
  if (opts.dryRun) {
    log('Dry run — would write to', MEMORY_PATH);
    log(content);
    return;
  }
  ensureMemoryDir();
  writeFileSync(MEMORY_PATH, content, 'utf-8');
}

function readPending() {
  if (!existsSync(PENDING_PATH)) {
    return '';
  }
  return readFileSync(PENDING_PATH, 'utf-8');
}

function writePending(content) {
  if (opts.dryRun) {
    log('Dry run — would write to', PENDING_PATH);
    return;
  }
  ensureMemoryDir();
  writeFileSync(PENDING_PATH, content, 'utf-8');
}

function writeDigest(content) {
  if (opts.dryRun) {
    log('Dry run — would write to', DIGEST_PATH);
    log(content);
    return;
  }
  ensureMemoryDir();
  writeFileSync(DIGEST_PATH, content, 'utf-8');
}

// Parse memory file into structured entries
function parseMemory(content) {
  const lines = content.split('\n');
  const entries = [];
  let currentSection = null;
  let pendingComment = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Section header
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim();
      continue;
    }

    // Metadata comment
    if (line.trim().startsWith('<!--') && line.trim().endsWith('-->')) {
      const comment = line.trim().slice(4, -3).trim();
      pendingComment = comment;
      continue;
    }

    // Entry line (non-empty, not a divider, has a pending comment)
    if (line.trim() && !line.trim().startsWith('---') && pendingComment && currentSection) {
      const [date, context, source] = pendingComment.split('|').map(s => s.trim());
      entries.push({
        section: currentSection,
        text: line.trim(),
        date: date || new Date().toISOString().split('T')[0],
        context: context || 'Global',
        source: source || 'confirmed',
        lineNumber: i + 1,
      });
      pendingComment = null;
    } else if (line.trim() && !line.trim().startsWith('---') && !pendingComment && currentSection) {
      // Entry without metadata - treat as legacy
      entries.push({
        section: currentSection,
        text: line.trim(),
        date: new Date().toISOString().split('T')[0],
        context: 'Global',
        source: 'legacy',
        lineNumber: i + 1,
      });
    }
  }

  return entries;
}

// Format entry with metadata comment
function formatEntry(entry) {
  return `<!-- ${entry.date} | ${entry.context} | ${entry.source} -->\n${entry.text}`;
}

// Rebuild memory.md from structured entries
function rebuildMemory(entries) {
  const sections = {
    'Preferences': [],
    'People': [],
    'Work patterns': [],
    'Facts': [],
    'Dislikes': [],
    'Tombstones': [],
  };

  for (const entry of entries) {
    if (sections[entry.section]) {
      sections[entry.section].push(formatEntry(entry));
    }
  }

  const lines = ['# EDWIN Memory', ''];

  for (const [section, items] of Object.entries(sections)) {
    if (section === 'Tombstones') {
      lines.push('---', '');
    }
    lines.push(`## ${section}`, '');
    if (items.length > 0) {
      lines.push(...items, '');
    }
  }

  return lines.join('\n');
}

// Command: append
function cmdAppend() {
  if (opts.args.length < 2) {
    error('Usage: append <section> "<entry>"', 2);
  }

  const [section, entryText] = opts.args;
  const validSections = ['Preferences', 'People', 'Work patterns', 'Facts', 'Dislikes'];

  if (!validSections.includes(section)) {
    error(`Invalid section. Must be one of: ${validSections.join(', ')}`, 1);
  }

  initializeMemoryFile();
  const content = readMemory();
  const entries = parseMemory(content);

  const newEntry = {
    section,
    text: entryText,
    date: new Date().toISOString().split('T')[0],
    context: opts.context,
    source: 'confirmed',
  };

  entries.push(newEntry);
  const updated = rebuildMemory(entries);
  writeMemory(updated);

  log(`Added to ${section}: ${entryText}`);
  if (opts.json) {
    console.log(JSON.stringify({ success: true, entry: newEntry }, null, 2));
  }
}

// Command: edit
function cmdEdit() {
  if (opts.args.length < 2) {
    error('Usage: edit <line-number> "<new-entry>"', 2);
  }

  const lineNum = parseInt(opts.args[0], 10);
  const newText = opts.args[1];

  if (isNaN(lineNum) || lineNum < 1) {
    error('Line number must be a positive integer', 1);
  }

  const content = readMemory();
  if (!content) {
    error('Memory file not found', 1);
  }

  const entries = parseMemory(content);
  const entry = entries.find(e => e.lineNumber === lineNum);

  if (!entry) {
    error(`No entry found at line ${lineNum}`, 1);
  }

  entry.text = newText;
  entry.date = new Date().toISOString().split('T')[0]; // Update date on edit

  const updated = rebuildMemory(entries);
  writeMemory(updated);

  log(`Updated line ${lineNum}: ${newText}`);
  if (opts.json) {
    console.log(JSON.stringify({ success: true, entry }, null, 2));
  }
}

// Command: tombstone
function cmdTombstone() {
  if (opts.args.length < 1) {
    error('Usage: tombstone "<entry-text>"', 2);
  }

  const searchText = opts.args[0].toLowerCase();
  const content = readMemory();
  if (!content) {
    error('Memory file not found', 1);
  }

  const entries = parseMemory(content);
  const matchIndex = entries.findIndex(e =>
    e.text.toLowerCase().includes(searchText) && e.section !== 'Tombstones'
  );

  if (matchIndex === -1) {
    // No matching entry — add new tombstone
    entries.push({
      section: 'Tombstones',
      text: opts.args[0],
      date: new Date().toISOString().split('T')[0],
      context: 'Global',
      source: 'tombstone',
    });
    log(`Added tombstone: ${opts.args[0]}`);
  } else {
    // Move existing entry to tombstones
    const entry = entries[matchIndex];
    entries.splice(matchIndex, 1);
    entries.push({
      section: 'Tombstones',
      text: entry.text,
      date: new Date().toISOString().split('T')[0],
      context: entry.context,
      source: 'tombstone',
    });
    log(`Moved to tombstones: ${entry.text}`);
  }

  const updated = rebuildMemory(entries);
  writeMemory(updated);

  if (opts.json) {
    console.log(JSON.stringify({ success: true }, null, 2));
  }
}

// Command: regenerate-digest
function cmdRegenerateDigest() {
  const content = readMemory();
  if (!content) {
    error('Memory file not found', 1);
  }

  const entries = parseMemory(content).filter(e => e.section !== 'Tombstones');

  // Rank by: confirmed first, then by date descending
  const ranked = entries.sort((a, b) => {
    if (a.source === 'confirmed' && b.source !== 'confirmed') return -1;
    if (a.source !== 'confirmed' && b.source === 'confirmed') return 1;
    return b.date.localeCompare(a.date);
  });

  // Build digest with line budget
  const lines = ['# EDWIN Memory Digest', ''];
  let lineCount = 2;
  const maxLines = 58; // Leave room for header

  const sectionGroups = {};
  for (const entry of ranked) {
    if (!sectionGroups[entry.section]) {
      sectionGroups[entry.section] = [];
    }
    sectionGroups[entry.section].push(entry);
  }

  let includedCount = 0;
  for (const [section, sectionEntries] of Object.entries(sectionGroups)) {
    // Check if we have room for section header + at least one entry
    if (lineCount + 2 + 2 > maxLines) {
      break; // Would exceed budget
    }

    const sectionStart = lines.length;
    lines.push(`## ${section}`, '');
    lineCount += 2;

    let sectionHasEntries = false;
    for (const entry of sectionEntries) {
      if (lineCount + 2 > maxLines) {
        break;
      }
      lines.push(`<!-- ${entry.date} | ${entry.context} -->`);
      lines.push(entry.text);
      lineCount += 2; // Comment + entry (no blank line to save space)
      includedCount++;
      sectionHasEntries = true;
    }

    // Add blank line after section if it has entries
    if (sectionHasEntries) {
      lines.push('');
      lineCount += 1;
    }

    // If no entries were added, remove the section header
    if (!sectionHasEntries) {
      lines.splice(sectionStart, 2);
      lineCount -= 2;
    }
  }

  const digest = lines.join('\n');
  writeDigest(digest);

  const actualLines = digest.split('\n').length;
  log(`Generated digest: ${actualLines} lines (${entries.length} total entries, ${includedCount} included)`);

  if (opts.json) {
    console.log(JSON.stringify({
      success: true,
      lines: actualLines,
      entries: entries.length,
      included: includedCount
    }, null, 2));
  }
}

// Command: confirm-pending
function cmdConfirmPending() {
  if (opts.args.length < 1) {
    error('Usage: confirm-pending <index|all>', 2);
  }

  const pending = readPending();
  if (!pending.trim()) {
    error('No pending entries', 1);
  }

  const lines = pending.split('\n').filter(l => l.trim() && !l.startsWith('#'));

  if (opts.args[0] === 'all') {
    // Move all pending to memory
    initializeMemoryFile();
    const memory = readMemory();
    const entries = parseMemory(memory);

    for (const line of lines) {
      entries.push({
        section: 'Facts', // Default section
        text: line,
        date: new Date().toISOString().split('T')[0],
        context: opts.context,
        source: 'confirmed',
      });
    }

    const updated = rebuildMemory(entries);
    writeMemory(updated);
    writePending(''); // Clear pending

    log(`Confirmed ${lines.length} pending entries`);
  } else {
    const index = parseInt(opts.args[0], 10);
    if (isNaN(index) || index < 0 || index >= lines.length) {
      error(`Invalid index. Must be 0-${lines.length - 1}`, 1);
    }

    initializeMemoryFile();
    const memory = readMemory();
    const entries = parseMemory(memory);

    entries.push({
      section: 'Facts',
      text: lines[index],
      date: new Date().toISOString().split('T')[0],
      context: opts.context,
      source: 'confirmed',
    });

    const updated = rebuildMemory(entries);
    writeMemory(updated);

    // Remove from pending
    lines.splice(index, 1);
    writePending(lines.join('\n') + '\n');

    log(`Confirmed: ${lines[index]}`);
  }

  if (opts.json) {
    console.log(JSON.stringify({ success: true }, null, 2));
  }
}

// Command: list
function cmdList() {
  const content = readMemory();
  if (!content) {
    error('Memory file not found', 1);
  }

  const entries = parseMemory(content);
  const filtered = opts.section
    ? entries.filter(e => e.section === opts.section)
    : entries;

  if (opts.json) {
    console.log(JSON.stringify({ entries: filtered }, null, 2));
  } else {
    let currentSection = null;
    for (const entry of filtered) {
      if (entry.section !== currentSection) {
        if (currentSection !== null) console.log();
        console.log(`## ${entry.section}`);
        currentSection = entry.section;
      }
      console.log(`  ${entry.text}`);
      console.log(`    (${entry.date} | ${entry.context} | ${entry.source})`);
    }
  }
}

// Main command dispatcher
function main() {
  switch (opts.command) {
    case 'append':
      cmdAppend();
      break;
    case 'edit':
      cmdEdit();
      break;
    case 'tombstone':
      cmdTombstone();
      break;
    case 'regenerate-digest':
      cmdRegenerateDigest();
      break;
    case 'confirm-pending':
      cmdConfirmPending();
      break;
    case 'list':
      cmdList();
      break;
    default:
      error(`Unknown command: ${opts.command}`, 2);
  }
}

main();
