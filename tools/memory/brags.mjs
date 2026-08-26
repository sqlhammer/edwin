#!/usr/bin/env node

/**
 * brags.mjs
 *
 * EDWIN brag (wins) tracker CLI.
 * Manages user/brags/ files: brags.md, categories.json, exports/.
 *
 * Usage:
 *   node tools/memory/brags.mjs append "<entry>" [--context <ctx>] [--size <size>] [--category <cat>]
 *   node tools/memory/brags.mjs edit <line> "<new-entry>"
 *   node tools/memory/brags.mjs set-size <line> <size>
 *   node tools/memory/brags.mjs delete <line>
 *   node tools/memory/brags.mjs list [--category <name>] [--size <size>] [--since <date>]
 *   node tools/memory/brags.mjs add-category "<name>" "<description>"
 *   node tools/memory/brags.mjs rename-category "<old>" "<new>"
 *   node tools/memory/brags.mjs merge-categories "<source>" "<target>"
 *   node tools/memory/brags.mjs generate-doc [--since <date>] [--until <date>] [--category <cat>] [--mode <mode>]
 *
 * Options:
 *   --context <name>    Context tag (default: Global)
 *   --size <size>       Win size: small, notable, major (default: notable)
 *   --category <name>   Category filter or assignment
 *   --since <date>      Filter by date >= YYYY-MM-DD
 *   --until <date>      Filter by date <= YYYY-MM-DD
 *   --mode <mode>       Brag doc mode: performance-review, personal-retrospective (default: performance-review)
 *   --dry-run           Show what would be done without writing
 *   --json              Output JSON result
 *   --root <path>       Operate on a tree other than this repo (expects <path>/user/brags/).
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
const BRAGS_DIR = join(USER_DIR, 'brags');
const BRAGS_PATH = join(BRAGS_DIR, 'brags.md');
const CATEGORIES_PATH = join(BRAGS_DIR, 'categories.json');
const EXPORTS_DIR = join(BRAGS_DIR, 'exports');

// Parse args
const args = process.argv.slice(2);
const opts = {
  command: null,
  args: [],
  context: 'Global',
  size: 'notable',
  category: null,
  since: null,
  until: null,
  mode: 'performance-review',
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
    case '--size':
      opts.size = next;
      i++;
      break;
    case '--category':
      opts.category = next;
      i++;
      break;
    case '--since':
      opts.since = next;
      i++;
      break;
    case '--until':
      opts.until = next;
      i++;
      break;
    case '--mode':
      opts.mode = next;
      i++;
      break;
    case '--dry-run':
      opts.dryRun = true;
      break;
    case '--json':
      opts.json = true;
      break;
    case '--root':
      // Already consumed during path resolution above.
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
    .slice(3, 36)
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

function ensureBragsDir() {
  if (!existsSync(BRAGS_DIR)) {
    mkdirSync(BRAGS_DIR, { recursive: true });
  }
  if (!existsSync(EXPORTS_DIR)) {
    mkdirSync(EXPORTS_DIR, { recursive: true });
  }
}

function initializeBragsFile() {
  ensureBragsDir();
  if (!existsSync(BRAGS_PATH)) {
    const template = `# EDWIN Brags\n\nWins and accomplishments tracked over time.\n\n`;
    writeFileSync(BRAGS_PATH, template, 'utf-8');
  }
}

function initializeCategoriesFile() {
  ensureBragsDir();
  if (!existsSync(CATEGORIES_PATH)) {
    const defaultCategories = {
      Work: 'Professional accomplishments and work wins',
      Personal: 'Personal achievements and life wins',
      Health: 'Health and fitness milestones',
      Learning: 'Educational achievements and skills acquired',
    };
    writeFileSync(CATEGORIES_PATH, JSON.stringify(defaultCategories, null, 2), 'utf-8');
  }
}

function readBrags() {
  if (!existsSync(BRAGS_PATH)) {
    return null;
  }
  return readFileSync(BRAGS_PATH, 'utf-8');
}

function writeBrags(content) {
  if (opts.dryRun) {
    log('Dry run — would write to', BRAGS_PATH);
    log(content);
    return;
  }
  ensureBragsDir();
  writeFileSync(BRAGS_PATH, content, 'utf-8');
}

function readCategories() {
  if (!existsSync(CATEGORIES_PATH)) {
    return null;
  }
  try {
    const content = readFileSync(CATEGORIES_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    error('categories.json is malformed', 1);
  }
}

function writeCategories(categories) {
  if (opts.dryRun) {
    log('Dry run — would write to', CATEGORIES_PATH);
    log(JSON.stringify(categories, null, 2));
    return;
  }
  ensureBragsDir();
  writeFileSync(CATEGORIES_PATH, JSON.stringify(categories, null, 2), 'utf-8');
}

// Parse brags.md into structured entries
function parseBrags(content) {
  const lines = content.split('\n');
  const entries = [];
  let pendingComment = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Metadata comment
    if (line.trim().startsWith('<!--') && line.trim().endsWith('-->')) {
      const comment = line.trim().slice(4, -3).trim();
      pendingComment = comment;
      continue;
    }

    // Entry line (non-empty, has a pending comment)
    if (line.trim() && !line.trim().startsWith('#') && !line.trim().startsWith('---') && pendingComment) {
      const parts = pendingComment.split('|').map(s => s.trim());
      const [date, category, size, context] = parts;
      entries.push({
        text: line.trim(),
        date: date || new Date().toISOString().split('T')[0],
        category: category || 'Work',
        size: size || 'notable',
        context: context || 'Global',
        lineNumber: i + 1,
      });
      pendingComment = null;
    }
  }

  return entries;
}

// Format entry with metadata comment
function formatEntry(entry) {
  return `<!-- ${entry.date} | ${entry.category} | ${entry.size} | ${entry.context} -->\n${entry.text}`;
}

// Rebuild brags.md from structured entries
function rebuildBrags(entries) {
  const lines = ['# EDWIN Brags', '', 'Wins and accomplishments tracked over time.', ''];

  for (const entry of entries) {
    lines.push(formatEntry(entry), '');
  }

  return lines.join('\n');
}

// Auto-categorize an entry based on content and context
function autoCategorize(text, context, categories) {
  const lowerText = text.toLowerCase();

  // Context-based hints
  if (context === 'Work') return 'Work';
  if (context === 'Home' || context === 'Personal') return 'Personal';

  // Content-based hints
  if (lowerText.match(/shipped|deployed|launched|released|merged|pr|feature|bug|incident|client|project/)) {
    return 'Work';
  }
  if (lowerText.match(/learned|course|certification|read|studied|practiced|skill/)) {
    return 'Learning';
  }
  if (lowerText.match(/ran|marathon|workout|gym|weight|health|fitness/)) {
    return 'Health';
  }

  // Check if any category name appears in text
  for (const cat of Object.keys(categories)) {
    if (lowerText.includes(cat.toLowerCase())) {
      return cat;
    }
  }

  // Default to Work if no match
  return 'Work';
}

// Command: append
function cmdAppend() {
  if (opts.args.length < 1) {
    error('Usage: append "<entry>"', 2);
  }

  const entryText = opts.args[0];
  const validSizes = ['small', 'notable', 'major'];

  if (!validSizes.includes(opts.size)) {
    error(`Invalid size. Must be one of: ${validSizes.join(', ')}`, 1);
  }

  initializeBragsFile();
  initializeCategoriesFile();

  const content = readBrags();
  const entries = parseBrags(content);
  const categories = readCategories();

  // Auto-categorize if not provided
  const category = opts.category || autoCategorize(entryText, opts.context, categories);

  // Validate category exists
  if (!categories[category]) {
    error(`Category "${category}" does not exist. Use add-category to create it.`, 1);
  }

  const newEntry = {
    text: entryText,
    date: new Date().toISOString().split('T')[0],
    category,
    size: opts.size,
    context: opts.context,
  };

  entries.push(newEntry);
  const updated = rebuildBrags(entries);
  writeBrags(updated);

  log(`Win logged: ${entryText}`);
  log(`Category: ${category} | Size: ${opts.size}`);
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

  const content = readBrags();
  if (!content) {
    error('Brags file not found', 1);
  }

  const entries = parseBrags(content);
  const entry = entries.find(e => e.lineNumber === lineNum);

  if (!entry) {
    error(`No entry found at line ${lineNum}`, 1);
  }

  entry.text = newText;
  entry.date = new Date().toISOString().split('T')[0]; // Update date on edit

  const updated = rebuildBrags(entries);
  writeBrags(updated);

  log(`Updated line ${lineNum}: ${newText}`);
  if (opts.json) {
    console.log(JSON.stringify({ success: true, entry }, null, 2));
  }
}

// Command: set-size
function cmdSetSize() {
  if (opts.args.length < 2) {
    error('Usage: set-size <line-number> <size>', 2);
  }

  const lineNum = parseInt(opts.args[0], 10);
  const newSize = opts.args[1];
  const validSizes = ['small', 'notable', 'major'];

  if (isNaN(lineNum) || lineNum < 1) {
    error('Line number must be a positive integer', 1);
  }

  if (!validSizes.includes(newSize)) {
    error(`Invalid size. Must be one of: ${validSizes.join(', ')}`, 1);
  }

  const content = readBrags();
  if (!content) {
    error('Brags file not found', 1);
  }

  const entries = parseBrags(content);
  const entry = entries.find(e => e.lineNumber === lineNum);

  if (!entry) {
    error(`No entry found at line ${lineNum}`, 1);
  }

  entry.size = newSize;

  const updated = rebuildBrags(entries);
  writeBrags(updated);

  log(`Updated size to ${newSize}: ${entry.text}`);
  if (opts.json) {
    console.log(JSON.stringify({ success: true, entry }, null, 2));
  }
}

// Command: delete
function cmdDelete() {
  if (opts.args.length < 1) {
    error('Usage: delete <line-number>', 2);
  }

  const lineNum = parseInt(opts.args[0], 10);

  if (isNaN(lineNum) || lineNum < 1) {
    error('Line number must be a positive integer', 1);
  }

  const content = readBrags();
  if (!content) {
    error('Brags file not found', 1);
  }

  const entries = parseBrags(content);
  const entryIndex = entries.findIndex(e => e.lineNumber === lineNum);

  if (entryIndex === -1) {
    error(`No entry found at line ${lineNum}`, 1);
  }

  const deleted = entries.splice(entryIndex, 1)[0];
  const updated = rebuildBrags(entries);
  writeBrags(updated);

  log(`Deleted: ${deleted.text}`);
  if (opts.json) {
    console.log(JSON.stringify({ success: true, deleted }, null, 2));
  }
}

// Command: list
function cmdList() {
  const content = readBrags();
  if (!content) {
    error('Brags file not found', 1);
  }

  let entries = parseBrags(content);

  // Apply filters
  if (opts.category) {
    entries = entries.filter(e => e.category === opts.category);
  }
  if (opts.size) {
    entries = entries.filter(e => e.size === opts.size);
  }
  if (opts.since) {
    entries = entries.filter(e => e.date >= opts.since);
  }
  if (opts.until) {
    entries = entries.filter(e => e.date <= opts.until);
  }

  if (opts.json) {
    console.log(JSON.stringify({ entries }, null, 2));
  } else {
    if (entries.length === 0) {
      log('No wins match the filters.');
      return;
    }

    for (const entry of entries) {
      log(`[${entry.date}] ${entry.text} (${entry.size})`);
      log(`  Category: ${entry.category} | Context: ${entry.context}`);
    }
    log(`\nTotal: ${entries.length} wins`);
  }
}

// Command: add-category
function cmdAddCategory() {
  if (opts.args.length < 2) {
    error('Usage: add-category "<name>" "<description>"', 2);
  }

  const [name, description] = opts.args;
  initializeCategoriesFile();

  const categories = readCategories();

  if (categories[name]) {
    error(`Category "${name}" already exists`, 1);
  }

  categories[name] = description;
  writeCategories(categories);

  log(`Category created: ${name}`);
  if (opts.json) {
    console.log(JSON.stringify({ success: true, category: name }, null, 2));
  }
}

// Command: rename-category
function cmdRenameCategory() {
  if (opts.args.length < 2) {
    error('Usage: rename-category "<old-name>" "<new-name>"', 2);
  }

  const [oldName, newName] = opts.args;
  initializeCategoriesFile();

  const categories = readCategories();

  if (!categories[oldName]) {
    error(`Category "${oldName}" does not exist`, 1);
  }
  if (categories[newName]) {
    error(`Category "${newName}" already exists`, 1);
  }

  // Rename in categories.json
  categories[newName] = categories[oldName];
  delete categories[oldName];
  writeCategories(categories);

  // Update all entries in brags.md
  const content = readBrags();
  if (content) {
    const entries = parseBrags(content);
    entries.forEach(e => {
      if (e.category === oldName) {
        e.category = newName;
      }
    });
    const updated = rebuildBrags(entries);
    writeBrags(updated);
  }

  log(`Category renamed: ${oldName} → ${newName}`);
  if (opts.json) {
    console.log(JSON.stringify({ success: true, oldName, newName }, null, 2));
  }
}

// Command: merge-categories
function cmdMergeCategories() {
  if (opts.args.length < 2) {
    error('Usage: merge-categories "<source>" "<target>"', 2);
  }

  const [source, target] = opts.args;
  initializeCategoriesFile();

  const categories = readCategories();

  if (!categories[source]) {
    error(`Source category "${source}" does not exist`, 1);
  }
  if (!categories[target]) {
    error(`Target category "${target}" does not exist`, 1);
  }

  // Remove source category
  delete categories[source];
  writeCategories(categories);

  // Move all entries from source to target
  const content = readBrags();
  if (content) {
    const entries = parseBrags(content);
    let movedCount = 0;
    entries.forEach(e => {
      if (e.category === source) {
        e.category = target;
        movedCount++;
      }
    });
    const updated = rebuildBrags(entries);
    writeBrags(updated);

    log(`Merged ${movedCount} wins from ${source} into ${target}`);
  } else {
    log(`Merged categories (no entries affected)`);
  }

  if (opts.json) {
    console.log(JSON.stringify({ success: true, source, target }, null, 2));
  }
}

// Command: generate-doc
function cmdGenerateDoc() {
  const content = readBrags();
  if (!content) {
    error('Brags file not found', 1);
  }

  let entries = parseBrags(content);

  // Apply filters
  if (opts.category) {
    entries = entries.filter(e => e.category === opts.category);
  }
  if (opts.since) {
    entries = entries.filter(e => e.date >= opts.since);
  }
  if (opts.until) {
    entries = entries.filter(e => e.date <= opts.until);
  }

  if (entries.length === 0) {
    error('No wins match the filters', 1);
  }

  // Sort by date descending
  entries.sort((a, b) => b.date.localeCompare(a.date));

  let doc = '';
  const today = new Date().toISOString().split('T')[0];

  if (opts.mode === 'performance-review') {
    doc = generatePerformanceReview(entries);
  } else if (opts.mode === 'personal-retrospective') {
    doc = generatePersonalRetrospective(entries);
  } else {
    error(`Invalid mode. Must be: performance-review or personal-retrospective`, 1);
  }

  const filename = `brag-doc-${today}.md`;
  const outputPath = join(EXPORTS_DIR, filename);

  if (opts.dryRun) {
    log('Dry run — would write to', outputPath);
    log(doc);
  } else {
    ensureBragsDir();
    writeFileSync(outputPath, doc, 'utf-8');
    log(`Brag doc generated: ${outputPath}`);
    log(`${entries.length} entries, ${opts.mode} mode`);
  }

  if (opts.json) {
    console.log(JSON.stringify({
      success: true,
      path: outputPath,
      entries: entries.length,
      mode: opts.mode,
    }, null, 2));
  }
}

function generatePerformanceReview(entries) {
  const lines = ['# Accomplishments', ''];

  // Group by category
  const byCategory = {};
  for (const entry of entries) {
    if (!byCategory[entry.category]) {
      byCategory[entry.category] = [];
    }
    byCategory[entry.category].push(entry);
  }

  // Output by category, major wins first
  for (const [category, catEntries] of Object.entries(byCategory)) {
    const sorted = catEntries.sort((a, b) => {
      const sizeOrder = { major: 0, notable: 1, small: 2 };
      return sizeOrder[a.size] - sizeOrder[b.size];
    });

    lines.push(`## ${category}`, '');

    for (const entry of sorted) {
      const sizeLabel = entry.size === 'major' ? ' **[Major]**' : entry.size === 'notable' ? ' [Notable]' : '';
      lines.push(`- ${entry.text}${sizeLabel}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generatePersonalRetrospective(entries) {
  const lines = ['# Wins & Accomplishments', ''];

  // Chronological order
  const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));

  // Group by month
  const byMonth = {};
  for (const entry of sorted) {
    const month = entry.date.slice(0, 7); // YYYY-MM
    if (!byMonth[month]) {
      byMonth[month] = [];
    }
    byMonth[month].push(entry);
  }

  for (const [month, monthEntries] of Object.entries(byMonth)) {
    // Parse YYYY-MM directly to avoid timezone issues
    const [year, monthNum] = month.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = `${monthNames[parseInt(monthNum, 10) - 1]} ${year}`;
    lines.push(`## ${monthName}`, '');

    for (const entry of monthEntries) {
      lines.push(`- **[${entry.date}]** ${entry.text}`);
    }
    lines.push('');
  }

  return lines.join('\n');
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
    case 'set-size':
      cmdSetSize();
      break;
    case 'delete':
      cmdDelete();
      break;
    case 'list':
      cmdList();
      break;
    case 'add-category':
      cmdAddCategory();
      break;
    case 'rename-category':
      cmdRenameCategory();
      break;
    case 'merge-categories':
      cmdMergeCategories();
      break;
    case 'generate-doc':
      cmdGenerateDoc();
      break;
    default:
      error(`Unknown command: ${opts.command}`, 2);
  }
}

main();
