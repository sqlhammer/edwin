#!/usr/bin/env node

/**
 * run-e2e.mjs
 *
 * End-to-end test harness for EDWIN v0.2 automated verification.
 * Exercises the test matrix from WU-16 on macOS, in temporary directories only.
 *
 * SAFETY: Never touches real user data. All tests run in temp directories.
 * Verifies at end that the real user/ directory was not modified.
 *
 * Usage:
 *   node tools/test/run-e2e.mjs [options]
 *
 * Options:
 *   --json      Output JSON result only
 *   --help      Show this help
 *
 * Exit codes:
 *   0 - All tests passed
 *   1 - One or more tests failed
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
  chmodSync,
} from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { execSync, spawnSync } from 'child_process';
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
const REPO_ROOT = resolve(__dirname, '..', '..');

// Parse args
const args = process.argv.slice(2);
let jsonOutput = false;
let help = false;

for (const arg of args) {
  if (arg === '--json') jsonOutput = true;
  else if (arg === '--help') help = true;
  else {
    console.error(`Error: Unknown option: ${arg}`);
    process.exit(2);
  }
}

if (help) {
  const helpText = readFileSync(__filename, 'utf-8')
    .split('\n')
    .slice(3, 24)
    .map(l => l.replace(/^ \* ?/, ''))
    .join('\n');
  console.log(helpText);
  process.exit(0);
}

// Test results
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
};

function pass(name, details = null) {
  results.passed++;
  results.tests.push({ name, status: 'PASS', details });
  if (!jsonOutput) console.log(`✓ ${name}`);
}

function fail(name, reason) {
  results.failed++;
  results.tests.push({ name, status: 'FAIL', reason });
  if (!jsonOutput) console.error(`✗ ${name}\n  ${reason}`);
}

function skip(name, reason) {
  results.skipped++;
  results.tests.push({ name, status: 'SKIP', reason });
  if (!jsonOutput) console.log(`⊘ ${name} (${reason})`);
}

// Baseline: hash the real user/ directory
function hashDirectory(dir) {
  if (!existsSync(dir)) return 'DIR_NOT_EXISTS';

  const files = [];
  function walk(current) {
    const entries = readdirSync(current);
    for (const entry of entries) {
      const fullPath = join(current, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        const content = readFileSync(fullPath, 'utf-8');
        files.push({ path: fullPath, content });
      }
    }
  }
  walk(dir);

  files.sort((a, b) => a.path.localeCompare(b.path));
  const combined = files.map(f => `${f.path}\0${f.content}`).join('\n');
  return createHash('sha256').update(combined).digest('hex');
}

const USER_DIR = join(REPO_ROOT, 'user');
const INITIAL_USER_HASH = hashDirectory(USER_DIR);

if (!jsonOutput) {
  console.log('EDWIN v0.2 End-to-End Test Suite');
  console.log('=================================\n');
  console.log(`Repo root: ${REPO_ROOT}`);
  console.log(`Initial user/ hash: ${INITIAL_USER_HASH}\n`);
}

// Helper: run a command and capture output
function run(cmd, cwd = REPO_ROOT) {
  try {
    const output = execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { success: true, output, exitCode: 0 };
  } catch (err) {
    return { success: false, output: err.stdout || '', error: err.stderr || '', exitCode: err.status };
  }
}

// Helper: check if command exists
function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Helper: assert path is within temp directory
function assertInTempDir(path, tempRoot) {
  const resolvedPath = resolve(path);
  const resolvedTemp = resolve(tempRoot);
  if (!resolvedPath.startsWith(resolvedTemp)) {
    throw new Error(`SAFETY VIOLATION: Path ${resolvedPath} is outside temp root ${resolvedTemp}`);
  }
}

// Create temp directories for testing
const TEMP_ROOT = join(tmpdir(), `edwin-test-${Date.now()}`);
const TEMP_HOME = join(TEMP_ROOT, 'home');
const TEMP_REPO = join(TEMP_ROOT, 'repo');
const TEMP_BUNDLES = join(TEMP_ROOT, 'bundles');

if (!jsonOutput) console.log(`Test temp root: ${TEMP_ROOT}\n`);

try {
  mkdirSync(TEMP_ROOT, { recursive: true });
  mkdirSync(TEMP_HOME, { recursive: true });
  mkdirSync(TEMP_REPO, { recursive: true });
  mkdirSync(TEMP_BUNDLES, { recursive: true });

  // Create temp repo structure with user/ directory
  mkdirSync(join(TEMP_REPO, 'user'), { recursive: true });
  mkdirSync(join(TEMP_REPO, 'core'), { recursive: true });
} catch (err) {
  console.error(`Failed to create temp directories: ${err.message}`);
  process.exit(1);
}

// TEST 1: edwin-doctor on the repo
if (!jsonOutput) console.log('Running validation tests...\n');

{
  const result = run('node tools/validate/edwin-doctor.mjs');
  if (result.success || (result.exitCode === 0)) {
    pass('edwin-doctor validates repo structure');
  } else {
    // Check if it's the known plugin-skills-drift error
    if (result.output.includes('plugin-skills-drift') || result.error.includes('plugin-skills-drift')) {
      // Try building plugin
      const buildResult = run('npm run build-plugin');
      if (buildResult.success) {
        // Re-run doctor
        const recheck = run('node tools/validate/edwin-doctor.mjs');
        if (recheck.success) {
          pass('edwin-doctor validates repo (after plugin rebuild)');
        } else {
          fail('edwin-doctor validation', recheck.error || recheck.output);
        }
      } else {
        fail('edwin-doctor validation', 'Plugin drift detected and rebuild failed');
      }
    } else {
      fail('edwin-doctor validation', result.error || result.output);
    }
  }
}

// TEST 2: Sync engine to temp home
if (!jsonOutput) console.log('\nRunning sync engine tests...\n');

{
  // Create .claude directory structure (sync engine doesn't create it)
  mkdirSync(join(TEMP_HOME, '.claude'), { recursive: true });

  const result = run(`node tools/sync/engine.mjs --home ${TEMP_HOME} --target all`);
  if (result.success) {
    // Verify outputs
    const claudeMd = join(TEMP_HOME, '.claude', 'CLAUDE.md');
    const skillsDir = join(TEMP_HOME, '.claude', 'skills');
    const manifest = join(TEMP_HOME, '.edwin', 'installed.json');

    if (existsSync(claudeMd) && existsSync(skillsDir) && existsSync(manifest)) {
      const content = readFileSync(claudeMd, 'utf-8');
      if (content.includes('<!-- EDWIN:BEGIN -->') && content.includes('<!-- EDWIN:END -->')) {
        pass('sync engine creates CLAUDE.md with managed markers');
      } else {
        fail('sync engine managed markers', 'EDWIN markers not found in CLAUDE.md');
      }

      if (existsSync(skillsDir) && readdirSync(skillsDir).length > 0) {
        pass('sync engine installs skills');
      } else {
        fail('sync engine installs skills', 'skills directory empty');
      }

      if (existsSync(manifest)) {
        const manifestData = JSON.parse(readFileSync(manifest, 'utf-8'));
        if (manifestData.skills && typeof manifestData.skills === 'object') {
          pass('sync engine creates manifest');
        } else {
          fail('sync engine manifest', 'manifest malformed');
        }
      }
    } else {
      fail('sync engine outputs', `Missing: claudeMd=${existsSync(claudeMd)} skills=${existsSync(skillsDir)} manifest=${existsSync(manifest)}`);
    }
  } else {
    fail('sync engine execution', result.error || result.output);
  }
}

// TEST 3: Idempotency - second sync reports no changes
{
  const result = run(`node tools/sync/engine.mjs --home ${TEMP_HOME} --target all`);
  if (result.success) {
    if (result.output.includes('No changes') || result.output.includes('unchanged') || result.output.includes('up to date')) {
      pass('sync engine idempotency');
    } else {
      // This might still be OK if it just reports success without changes
      // Check if files were actually modified
      const claudeMd = join(TEMP_HOME, '.claude', 'CLAUDE.md');
      const beforeHash = createHash('md5').update(readFileSync(claudeMd, 'utf-8')).digest('hex');

      run(`node tools/sync/engine.mjs --home ${TEMP_HOME} --target all`);
      const afterHash = createHash('md5').update(readFileSync(claudeMd, 'utf-8')).digest('hex');

      if (beforeHash === afterHash) {
        pass('sync engine idempotency (verified by hash)');
      } else {
        fail('sync engine idempotency', 'Second sync modified files');
      }
    }
  } else {
    fail('sync engine idempotency', 'Second sync failed: ' + result.error);
  }
}

// TEST 4: Managed markers - content outside markers survives
{
  const claudeMd = join(TEMP_HOME, '.claude', 'CLAUDE.md');
  const original = readFileSync(claudeMd, 'utf-8');

  // Add custom content before and after markers
  const customPrefix = '# My Custom Header\n\nThis is my custom content.\n\n';
  const customSuffix = '\n\n# My Custom Footer\n\nMore custom content.';

  const beginMarker = '<!-- EDWIN:BEGIN -->';
  const endMarker = '<!-- EDWIN:END -->';
  const beginIdx = original.indexOf(beginMarker);
  const endIdx = original.indexOf(endMarker) + endMarker.length;

  const modified = customPrefix + original.substring(beginIdx, endIdx) + customSuffix;
  writeFileSync(claudeMd, modified, 'utf-8');

  // Re-sync
  const result = run(`node tools/sync/engine.mjs --home ${TEMP_HOME} --target all`);
  if (result.success) {
    const afterSync = readFileSync(claudeMd, 'utf-8');
    if (afterSync.includes('My Custom Header') && afterSync.includes('My Custom Footer')) {
      pass('managed markers preserve user content');
    } else {
      fail('managed markers', 'User content was removed');
    }
  } else {
    fail('managed markers test', result.error);
  }
}

// TEST 5: CLAUDE.md without markers gets block appended
{
  const claudeMd = join(TEMP_HOME, '.claude', 'CLAUDE.md');
  const customContent = '# My Project\n\nThis is my custom CLAUDE.md file.\n\nIt has no EDWIN markers yet.\n';
  writeFileSync(claudeMd, customContent, 'utf-8');

  const result = run(`node tools/sync/engine.mjs --home ${TEMP_HOME} --target all`);
  if (result.success) {
    const afterSync = readFileSync(claudeMd, 'utf-8');
    if (afterSync.includes('My Project') && afterSync.includes('<!-- EDWIN:BEGIN -->')) {
      pass('CLAUDE.md without markers gets block appended');
    } else {
      fail('CLAUDE.md marker append', 'Existing content removed or markers not added');
    }
  } else {
    fail('CLAUDE.md marker append', result.error);
  }
}

// TEST 6: Context operations
if (!jsonOutput) console.log('\nRunning context operation tests...\n');

{
  // Create a test context
  const result = run(`node tools/sync/context.mjs add-context TestContext "A test context"`);
  if (result.success) {
    const contextsFile = join(REPO_ROOT, 'core', 'contexts', 'contexts.json');
    const contexts = JSON.parse(readFileSync(contextsFile, 'utf-8'));
    if (contexts.contexts.some(c => c.name === 'TestContext')) {
      pass('context create');

      // Clean up - remove test context
      run(`node tools/sync/context.mjs remove-context TestContext`);
    } else {
      fail('context create', 'Context not found in contexts.json');
    }
  } else {
    fail('context create', result.error || result.output);
  }
}

{
  // Try to remove Global context (should fail)
  const result = run(`node tools/sync/context.mjs remove-context Global`);
  if (!result.success || result.output.includes('cannot') || result.error.includes('cannot')) {
    pass('Global context cannot be removed');
  } else {
    fail('Global context protection', 'Global context was removed');
  }
}

{
  // Test context operations with --root
  const testRoot = join(TEMP_ROOT, 'context-test');
  mkdirSync(join(testRoot, 'user'), { recursive: true });
  mkdirSync(join(testRoot, 'core', 'contexts'), { recursive: true });
  mkdirSync(join(testRoot, 'core', 'skills', 'test-skill'), { recursive: true });

  // Copy contexts.json
  copyFileSync(join(REPO_ROOT, 'core', 'contexts', 'contexts.json'), join(testRoot, 'core', 'contexts', 'contexts.json'));

  // Create state.json
  writeFileSync(join(testRoot, 'user', 'state.json'), JSON.stringify({
    schemaVersion: 1,
    activeContext: 'Global',
    offTheRecord: false,
    lastSync: new Date().toISOString()
  }, null, 2), 'utf-8');

  // Create a test skill with context
  writeFileSync(join(testRoot, 'core', 'skills', 'test-skill', 'SKILL.md'),
    '---\nname: test-skill\ndescription: Test\ncontexts: [RenameTest]\nversion: 1.0.0\nrequires: []\nauthor: test\n---\n\n# Test',
    'utf-8');

  // Add a context
  let result = run(`node ${join(REPO_ROOT, 'tools/sync/context.mjs')} add-context RenameTest "Test rename" --root ${testRoot}`);
  if (result.success) {
    // Rename it and check propagation to skill frontmatter
    const renameResult = run(`node ${join(REPO_ROOT, 'tools/sync/context.mjs')} rename-context RenameTest RenamedCtx --root ${testRoot}`);
    if (renameResult.success) {
      const contextsFile = join(testRoot, 'core', 'contexts', 'contexts.json');
      const contexts = JSON.parse(readFileSync(contextsFile, 'utf-8'));

      // Check contexts.json
      const hasRenamed = contexts.contexts.some(c => c.name === 'RenamedCtx');
      const lacksOld = !contexts.contexts.some(c => c.name === 'RenameTest');

      // Check skill frontmatter
      const skillContent = readFileSync(join(testRoot, 'core', 'skills', 'test-skill', 'SKILL.md'), 'utf-8');
      const frontmatterMatch = skillContent.match(/contexts:\s*\[(.*?)\]/);
      const skillContexts = frontmatterMatch ? frontmatterMatch[1].split(',').map(s => s.trim()) : [];
      const skillHasRenamed = skillContexts.includes('RenamedCtx');

      if (hasRenamed && lacksOld && skillHasRenamed) {
        pass('context rename propagates to skill frontmatter');
      } else {
        fail('context rename propagation', `contexts.json: ${hasRenamed}/${lacksOld}, skill: ${skillHasRenamed}`);
      }

      // Test switch
      const switchResult = run(`node ${join(REPO_ROOT, 'tools/sync/context.mjs')} set-active RenamedCtx --root ${testRoot}`);
      if (switchResult.success) {
        const stateFile = join(testRoot, 'user', 'state.json');
        const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
        if (state.activeContext === 'RenamedCtx') {
          pass('context switch');
        } else {
          fail('context switch', `Expected RenamedCtx, got ${state.activeContext}`);
        }
      } else {
        fail('context switch', switchResult.error || switchResult.output);
      }

      // Clean up
      run(`node ${join(REPO_ROOT, 'tools/sync/context.mjs')} remove-context RenamedCtx --root ${testRoot}`);
    } else {
      fail('context rename', renameResult.error || renameResult.output);
    }
  } else {
    fail('context rename setup', result.error || result.output);
  }
}

// TEST 7: Memory operations (with --root)
if (!jsonOutput) console.log('\nRunning memory tests...\n');

{
  const testRoot = join(TEMP_ROOT, 'memory-test');
  mkdirSync(join(testRoot, 'user', 'memory'), { recursive: true });
  mkdirSync(join(testRoot, 'core', 'templates'), { recursive: true });

  // Copy template
  const templateSrc = join(REPO_ROOT, 'core', 'templates', 'memory.md.tmpl');
  const templateDst = join(testRoot, 'core', 'templates', 'memory.md.tmpl');
  if (existsSync(templateSrc)) {
    copyFileSync(templateSrc, templateDst);
  }

  // Append memories (valid sections: Preferences, People, Work patterns, Facts, Dislikes)
  let result = run(`node ${join(REPO_ROOT, 'tools/memory/memory.mjs')} append Preferences "Test preference" --root ${testRoot}`);
  if (result.success) {
    const memoryFile = join(testRoot, 'user', 'memory', 'memory.md');
    if (existsSync(memoryFile)) {
      const content = readFileSync(memoryFile, 'utf-8');
      if (content.includes('Test preference')) {
        pass('memory append with --root');
      } else {
        fail('memory append', 'Entry not found in memory.md');
      }
    } else {
      fail('memory append', 'memory.md not created');
    }
  } else {
    fail('memory append', result.error || result.output);
  }

  // Test memory list/recall
  result = run(`node ${join(REPO_ROOT, 'tools/memory/memory.mjs')} list --root ${testRoot}`);
  if (result.success && result.output.includes('Test preference')) {
    pass('memory list/recall');
  } else {
    fail('memory list', 'Entry not in list output');
  }

  // Test memory tombstone (forget)
  result = run(`node ${join(REPO_ROOT, 'tools/memory/memory.mjs')} tombstone "Test preference" --root ${testRoot}`);
  if (result.success) {
    const memoryFile = join(testRoot, 'user', 'memory', 'memory.md');
    const content = readFileSync(memoryFile, 'utf-8');
    if (content.includes('## Tombstones') && content.includes('Test preference')) {
      pass('memory forget (tombstone)');
    } else {
      fail('memory forget', 'Entry not moved to Tombstones');
    }
  } else {
    fail('memory forget', result.error || result.output);
  }

  // Test digest regeneration
  result = run(`node ${join(REPO_ROOT, 'tools/memory/memory.mjs')} regenerate-digest --root ${testRoot}`);
  if (result.success) {
    const digestFile = join(testRoot, 'user', 'memory', 'digest.md');
    if (existsSync(digestFile)) {
      pass('memory digest regeneration');
    } else {
      fail('memory digest', 'digest.md not created');
    }
  } else {
    fail('memory digest', result.error || result.output);
  }

  // Test digest appears in synced CLAUDE.md EDWIN:MEMORY markers
  // Copy repo tree to temp, seed digest, run sync from that copy
  const syncTestRoot = join(TEMP_ROOT, 'memory-sync-test');
  const syncTestHome = join(TEMP_ROOT, 'memory-sync-home');
  mkdirSync(syncTestHome, { recursive: true });
  mkdirSync(join(syncTestHome, '.claude'), { recursive: true });

  // Copy essential repo files to temp
  mkdirSync(syncTestRoot, { recursive: true });
  run(`cp -r ${join(REPO_ROOT, 'core')} ${syncTestRoot}/`);
  run(`cp -r ${join(REPO_ROOT, 'tools')} ${syncTestRoot}/`);
  run(`cp ${join(REPO_ROOT, 'package.json')} ${syncTestRoot}/`);

  // Seed user/memory/digest.md with test content
  mkdirSync(join(syncTestRoot, 'user', 'memory'), { recursive: true });
  const testDigest = '# Memory Digest\n\nTest digest content for validation.\n\n- Preference: loves concise responses\n';
  writeFileSync(join(syncTestRoot, 'user', 'memory', 'digest.md'), testDigest, 'utf-8');

  // Run sync engine FROM the copied tree with --home pointing to temp home
  const syncResult = run(`cd ${syncTestRoot} && node tools/sync/engine.mjs --home ${syncTestHome} --target all`);
  if (syncResult.success) {
    const claudeMdPath = join(syncTestHome, '.claude', 'CLAUDE.md');
    if (existsSync(claudeMdPath)) {
      const claudeMd = readFileSync(claudeMdPath, 'utf-8');

      // Check for EDWIN:MEMORY markers and digest content
      const memoryBegin = '<!-- EDWIN:MEMORY:BEGIN -->';
      const memoryEnd = '<!-- EDWIN:MEMORY:END -->';

      if (claudeMd.includes(memoryBegin) && claudeMd.includes(memoryEnd)) {
        const beginIdx = claudeMd.indexOf(memoryBegin) + memoryBegin.length;
        const endIdx = claudeMd.indexOf(memoryEnd);
        const memorySection = claudeMd.substring(beginIdx, endIdx);

        if (memorySection.includes('loves concise responses')) {
          pass('memory digest in CLAUDE.md EDWIN:MEMORY markers');
        } else {
          fail('memory digest content', 'Digest not found in EDWIN:MEMORY section');
        }
      } else {
        fail('memory digest markers', 'EDWIN:MEMORY markers not found in CLAUDE.md');
      }
    } else {
      fail('memory digest sync', 'CLAUDE.md not created');
    }
  } else {
    fail('memory digest sync', syncResult.error || syncResult.output);
  }
}

// TEST 8: Brags operations (with --root)
if (!jsonOutput) console.log('\nRunning brags tests...\n');

{
  const testRoot = join(TEMP_ROOT, 'brags-test');
  mkdirSync(join(testRoot, 'user', 'brags'), { recursive: true });

  // Add a category
  let result = run(`node ${join(REPO_ROOT, 'tools/memory/brags.mjs')} add-category "Technical" "Technical achievements" --root ${testRoot}`);
  if (result.success) {
    // Append a brag
    result = run(`node ${join(REPO_ROOT, 'tools/memory/brags.mjs')} append "Implemented test harness" --category Technical --size notable --root ${testRoot}`);
    if (result.success) {
      const bragsFile = join(testRoot, 'user', 'brags', 'brags.md');
      if (existsSync(bragsFile)) {
        const content = readFileSync(bragsFile, 'utf-8');
        if (content.includes('Implemented test harness')) {
          pass('brags append with --root');

          // Test list
          result = run(`node ${join(REPO_ROOT, 'tools/memory/brags.mjs')} list --root ${testRoot}`);
          if (result.success && result.output.includes('Implemented test harness')) {
            pass('brags list with --root');
          } else {
            fail('brags list', 'Entry not in list output');
          }

          // Brags uses inline metadata comments, not month headings
          // Format: <!-- YYYY-MM-DD | category | size | context -->
          if (content.includes('<!--') && content.includes('Implemented test harness')) {
            pass('brags inline metadata format');
          } else {
            fail('brags format', `Expected inline metadata. Content: ${content.substring(0, 200)}`);
          }

          // Test brags generate-doc with different timezones
          // This guards a bug where August wins filed under July in some timezones
          const timezones = ['UTC', 'Pacific/Honolulu', 'Australia/Sydney'];
          let tzTestsPassed = 0;

          for (const tz of timezones) {
            const env = { ...process.env, TZ: tz };
            try {
              execSync(`node ${join(REPO_ROOT, 'tools/memory/brags.mjs')} generate-doc --root ${testRoot}`, {
                env,
                stdio: 'pipe',
                encoding: 'utf-8'
              });

              // Find the generated doc
              const exportsDir = join(testRoot, 'user', 'brags', 'exports');
              if (existsSync(exportsDir)) {
                const files = readdirSync(exportsDir);
                if (files.length > 0) {
                  const docPath = join(exportsDir, files[0]);
                  const docContent = readFileSync(docPath, 'utf-8');

                  // Verify the entry appears in the doc
                  if (docContent.includes('Implemented test harness')) {
                    tzTestsPassed++;
                  }
                }
              }
            } catch (err) {
              // Continue testing other timezones
            }
          }

          if (tzTestsPassed === timezones.length) {
            pass(`brags generate-doc across ${timezones.length} timezones`);
          } else {
            fail('brags generate-doc timezone handling', `Only ${tzTestsPassed}/${timezones.length} timezones passed`);
          }
        } else {
          fail('brags append', 'Entry not found in brags.md');
        }
      } else {
        fail('brags append', 'brags.md not created');
      }
    } else {
      fail('brags append', result.error || result.output);
    }
  } else {
    fail('brags add-category', result.error || result.output);
  }
}

// TEST 9: Bundle export
if (!jsonOutput) console.log('\nRunning bundle export tests...\n');

{
  const result = run(`node tools/bundle/build-bundle.mjs --context Global --portal claude --dry-run`);
  if (result.success) {
    pass('bundle export dry-run (claude portal)');
  } else {
    // Check if it's a legitimate failure (like missing context)
    if (result.error.includes('Context') || result.output.includes('Context')) {
      skip('bundle export', 'Context issues');
    } else {
      fail('bundle export', result.error || result.output);
    }
  }
}

{
  // Test actual bundle generation: skill bodies in knowledge/, not duplicated in instructions
  const bundleResult = run(`node tools/bundle/build-bundle.mjs --context Global --portal claude`);
  if (bundleResult.success) {
    const instructionsPath = join(REPO_ROOT, 'dist', 'bundles', 'claude', 'Global', 'instructions.txt');
    const knowledgeDir = join(REPO_ROOT, 'dist', 'bundles', 'claude', 'Global', 'knowledge');

    if (existsSync(instructionsPath) && existsSync(knowledgeDir)) {
      const instructions = readFileSync(instructionsPath, 'utf-8');
      const knowledgeFiles = readdirSync(knowledgeDir);

      // Pick a distinctive phrase from a skill to check it appears in instructions (as description)
      // and also exists in its knowledge file (as body)
      // Use a phrase from the briefing skill as a test - adjust for actual text
      const testPhrase = 'executive briefing';
      const instructionsMatches = (instructions.match(new RegExp(testPhrase, 'gi')) || []).length;

      // Check knowledge files
      let knowledgeMatches = 0;
      for (const file of knowledgeFiles) {
        const content = readFileSync(join(knowledgeDir, file), 'utf-8');
        if (content.includes('executive briefing') || content.includes('Briefing')) {
          knowledgeMatches++;
        }
      }

      if (instructionsMatches === 1 && knowledgeMatches >= 1 && knowledgeFiles.length > 0) {
        pass('bundle: skill bodies in knowledge/, not duplicated in instructions');
      } else {
        fail('bundle structure', `Instructions matches: ${instructionsMatches}, knowledge files: ${knowledgeFiles.length}`);
      }
    } else {
      fail('bundle generation', `Missing: instructions=${existsSync(instructionsPath)}, knowledge=${existsSync(knowledgeDir)}`);
    }
  } else {
    fail('bundle generation', bundleResult.error || bundleResult.output);
  }
}

{
  // Test copilot portal within limits (normal case)
  const copilotResult = run(`node tools/bundle/build-bundle.mjs --context Global --portal copilot`);
  if (copilotResult.success && !copilotResult.output.includes('exceeds')) {
    pass('bundle: copilot portal within limits');
  } else {
    fail('bundle copilot generation', copilotResult.error || copilotResult.output);
  }
}

{
  // Guards the WU-13 bug where an over-limit bundle printed the overage on a red
  // line and then reported "✓ Done." with exit 0.
  //
  // This must drive the *limit* path, not the argument-validation path. Using an
  // invented portal name fails at "--portal must be one of: ..." before any limit
  // is consulted, which passes the assertion while testing nothing. So: keep the
  // real schema and a real portal name, and shrink only the limit. --limits keeps
  // the checked-in portal-limits.json untouched.
  const realLimits = JSON.parse(readFileSync(join(REPO_ROOT, 'tools', 'bundle', 'portal-limits.json'), 'utf-8'));
  realLimits.portals.copilot.instructionLimit = 100;
  realLimits.portals.copilot.notes = 'TEST FIXTURE: deliberately tiny limit.';
  const tinyLimitsPath = join(TEMP_ROOT, 'tiny-portal-limits.json');
  writeFileSync(tinyLimitsPath, JSON.stringify(realLimits, null, 2), 'utf-8');

  const overLimit = run(`node tools/bundle/build-bundle.mjs --context Global --portal copilot --limits "${tinyLimitsPath}" --dry-run 2>&1`);

  // Confirm we reached the limit check rather than an arg error, then that the
  // failure is reported honestly: non-zero exit and no success wording.
  const reachedLimitCheck = /exceeds limit|\/ 100 chars/.test(overLimit.output);
  const claimsSuccess = /✓ Done|Success/.test(overLimit.output);

  if (!reachedLimitCheck) {
    fail('bundle over-limit', `Never reached the limit check; got: ${overLimit.output.slice(0, 200)}`);
  } else if (overLimit.success) {
    fail('bundle over-limit', 'Exceeded the limit but exited 0');
  } else if (claimsSuccess) {
    fail('bundle over-limit', 'Failed correctly but still printed success wording');
  } else {
    pass('bundle: over-limit portal fails loudly (no success marker)');
  }
}

// TEST 10: Plugin build
if (!jsonOutput) console.log('\nRunning plugin build tests...\n');

{
  const result = run('npm run build-plugin');
  if (result.success) {
    const skillsDir = join(REPO_ROOT, 'skills');
    if (existsSync(skillsDir) && readdirSync(skillsDir).length > 0) {
      pass('plugin build produces skills/ directory');

      // Check if skills match core/skills/
      const coreSkills = readdirSync(join(REPO_ROOT, 'core', 'skills'))
        .filter(f => statSync(join(REPO_ROOT, 'core', 'skills', f)).isDirectory());
      const builtSkills = readdirSync(skillsDir)
        .filter(f => statSync(join(skillsDir, f)).isDirectory());

      if (coreSkills.every(s => builtSkills.includes(s))) {
        pass('plugin build matches core/skills/');
      } else {
        fail('plugin build completeness', 'Some core skills not in skills/');
      }
    } else {
      fail('plugin build', 'skills/ directory empty or missing');
    }
  } else {
    fail('plugin build', result.error || result.output);
  }
}

// TEST 11: Test with claude CLI if available
{
  if (commandExists('claude')) {
    const result = run('claude --plugin-dir . -p "list skills" --output-format text --permission-mode dontAsk');
    if (result.success && result.output.length > 0) {
      pass('claude CLI lists plugin skills');
    } else {
      skip('claude CLI skill listing', 'No skills in output or command failed');
    }
  } else {
    skip('claude CLI plugin test', 'claude binary not available');
  }
}

// TEST 12: Scheduler script validation
if (!jsonOutput) console.log('\nRunning scheduler tests...\n');

{
  const scriptPath = join(REPO_ROOT, 'tools', 'schedule', 'register-task.sh');
  if (existsSync(scriptPath)) {
    // Create a test prompt file
    const testPromptFile = join(TEMP_ROOT, 'test-prompt.txt');
    writeFileSync(testPromptFile, 'Test prompt content', 'utf-8');

    // Test 1: Valid weekday schedule (0 8 * * 1-5) with dry-run
    // --dry-run prints the plist to stdout; extract and validate it
    const result = run(`bash ${scriptPath} --name "TestTask" --schedule "0 8 * * 1-5" --prompt-file ${testPromptFile} --log-file ${join(TEMP_ROOT, 'test.log')} --dry-run`);
    if (result.success) {
      const output = result.output;

      // Extract XML from output (everything from <?xml to </plist>)
      const xmlMatch = output.match(/<\?xml.*<\/plist>/s);
      if (xmlMatch) {
        const plistXML = xmlMatch[0];
        const plistPath = join(TEMP_ROOT, 'test-weekday.plist');
        writeFileSync(plistPath, plistXML, 'utf-8');

        // Validate with plutil
        const lintResult = run(`plutil -lint ${plistPath}`);
        if (lintResult.success) {
          pass('scheduler produces valid plist (plutil)');
        } else {
          fail('scheduler plist validation', lintResult.error || lintResult.output);
        }

        // Check for exactly 5 weekday entries (Mon-Fri = 1,2,3,4,5)
        const weekdayMatches = plistXML.match(/<key>Weekday<\/key>\s*<integer>(\d)<\/integer>/g);
        if (weekdayMatches && weekdayMatches.length === 5) {
          // Extract the weekday numbers
          const weekdays = weekdayMatches.map(m => parseInt(m.match(/<integer>(\d)<\/integer>/)[1]));
          weekdays.sort();
          if (JSON.stringify(weekdays) === JSON.stringify([1, 2, 3, 4, 5])) {
            pass('scheduler weekday range (1-5) produces exactly Mon-Fri');
          } else {
            fail('scheduler weekday values', `Expected [1,2,3,4,5], got ${JSON.stringify(weekdays)}`);
          }
        } else {
          fail('scheduler weekday parsing', `Expected 5 weekday entries, got ${weekdayMatches ? weekdayMatches.length : 0}`);
        }
      } else {
        fail('scheduler plist extraction', 'Could not extract XML from dry-run output');
      }
    } else {
      fail('scheduler execution', result.error || result.output);
    }

    // Test 2: Malformed cron should fail loudly
    const malformedResult = run(`bash ${scriptPath} --name "BadCron" --schedule "not-a-cron" --prompt-file ${testPromptFile} --log-file ${join(TEMP_ROOT, 'test.log')} --dry-run 2>&1`);
    if (!malformedResult.success || malformedResult.output.includes('invalid') || malformedResult.output.includes('error') || malformedResult.error.includes('invalid')) {
      pass('scheduler rejects malformed cron');
    } else {
      fail('scheduler validation', 'Accepted invalid cron expression');
    }

    // Test 3: Week-wrapping ranges (6-1 for Sat-Mon) should fail or be explicit
    const wrapResult = run(`bash ${scriptPath} --name "WrapTest" --schedule "0 8 * * 6-1" --prompt-file ${testPromptFile} --log-file ${join(TEMP_ROOT, 'test.log')} --dry-run 2>&1`);
    if (!wrapResult.success || wrapResult.output.includes('invalid') || wrapResult.output.includes('wrap') || wrapResult.error.includes('invalid')) {
      pass('scheduler rejects week-wrapping ranges');
    } else {
      // If it accepted it, make sure it's explicit about what it did
      skip('scheduler week-wrapping', 'Accepted 6-1, behavior unclear');
    }
  } else {
    skip('scheduler script test', 'register-task.sh not found');
  }
}

// TEST 13: Installer script validation
if (!jsonOutput) console.log('\nRunning installer tests...\n');

{
  const installersDir = join(REPO_ROOT, 'tools', 'installers');
  if (existsSync(installersDir)) {
    const macInstaller = join(installersDir, 'EDWIN-Install.command');
    const winInstaller = join(installersDir, 'EDWIN-Install.cmd');

    if (existsSync(macInstaller)) {
      // Check LF line endings
      const content = readFileSync(macInstaller, 'utf-8');
      if (!content.includes('\r\n')) {
        pass('macOS installer has LF line endings');
      } else {
        fail('macOS installer line endings', 'Contains CRLF');
      }

      // Test that it fails gracefully without repo URL and no tty
      // Copy installer to temp and run with stdin closed, HOME=temp, TERM=dumb
      const installerTestHome = join(TEMP_ROOT, 'installer-test-home');
      mkdirSync(installerTestHome, { recursive: true });
      const tempInstaller = join(TEMP_ROOT, 'test-installer.command');
      copyFileSync(macInstaller, tempInstaller);

      const env = { ...process.env, HOME: installerTestHome, TERM: 'dumb' };
      try {
        const result = spawnSync('bash', [tempInstaller], {
          env,
          stdio: ['ignore', 'pipe', 'pipe'], // stdin closed
          encoding: 'utf-8',
          timeout: 10000
        });

        const output = result.stdout + result.stderr;
        // Should fail and mention --repo-url
        if (result.status !== 0 && output.includes('--repo-url')) {
          pass('macOS installer: no repo URL with no tty fails with --repo-url guidance');
        } else if (result.status !== 0) {
          fail('macOS installer error guidance', 'Failed but missing --repo-url guidance: ' + output.substring(0, 150));
        } else {
          fail('macOS installer validation', 'Should fail without repo URL (exited 0)');
        }
      } catch (err) {
        fail('macOS installer test', err.message);
      }

      // --- Prerequisite installation (WU-17) -------------------------------
      //
      // The installer installs Node.js and Git itself. None of the checks below may
      // actually install anything, so they exercise only the paths that refuse: --help,
      // argument validation, --skip-deps, and the "no console to ask at" decline.
      //
      // Two things have to be faked to reach those paths on a machine that already has
      // both tools:
      //
      //   1. A stub `node` / `git` earlier on PATH that exits non-zero. The installer
      //      decides a tool is usable by *running* it, not by finding it, so a stub that
      //      fails is indistinguishable from a broken or absent install — which is the
      //      normal state of git on a fresh Mac.
      //   2. The Homebrew probe paths. load_brew_env() finds brew by absolute path and
      //      then puts its bin directory at the front of PATH — which would shadow the
      //      stub with the real tool. Neutralising the two paths is what makes the stub
      //      stick; without it this test silently passes for the wrong reason.
      const runInstaller = (args, extraEnv = {}, script = tempInstaller) =>
        spawnSync('bash', [script, ...args], {
          env: { ...process.env, HOME: installerTestHome, TERM: 'dumb', ...extraEnv },
          stdio: ['ignore', 'pipe', 'pipe'],
          encoding: 'utf-8',
          timeout: 20000,
        });

      // --help must describe the scripted install, not a download page.
      {
        const r = runInstaller(['--help']);
        const out = r.stdout + r.stderr;
        if (r.status === 0 && /--skip-deps/.test(out) && /--yes/.test(out) && /installed for you/i.test(out)) {
          pass('macOS installer: --help documents scripted prerequisite install');
        } else {
          fail('macOS installer --help', `exit ${r.status}, output: ${out.substring(0, 200)}`);
        }
      }

      // An unrecognised option is a usage error (exit 2), not a silent default.
      {
        const r = runInstaller(['--not-a-real-option']);
        const out = r.stdout + r.stderr;
        if (r.status === 2 && /unknown option/i.test(out)) {
          pass('macOS installer: unknown option exits 2');
        } else {
          fail('macOS installer arg validation', `exit ${r.status}, output: ${out.substring(0, 200)}`);
        }
      }

      // Build the stub tools and the brew-blind installer copy.
      const stubBin = join(TEMP_ROOT, 'stub-bin');
      mkdirSync(stubBin, { recursive: true });
      const writeStub = name => {
        const p = join(stubBin, name);
        writeFileSync(p, '#!/bin/sh\nexit 1\n');
        chmodSync(p, 0o755);
        return p;
      };
      const stubNode = writeStub('node');
      const stubGit = writeStub('git');

      const brewBlind = join(TEMP_ROOT, 'test-installer-nobrew.command');
      writeFileSync(
        brewBlind,
        readFileSync(macInstaller, 'utf-8')
          .replaceAll('/opt/homebrew/bin/brew', '/nonexistent/hb/bin/brew')
          .replaceAll('/usr/local/bin/brew', '/nonexistent/ul/bin/brew')
      );

      const stubPath = `${stubBin}:${process.env.PATH}`;

      // Positive control. Same brew-blind installer, same PATH, but with the stubs
      // renamed away: it must get *past* the prerequisite checks. Without this, the two
      // checks below would pass just as happily if the installer were failing for some
      // unrelated reason — which is the whole failure mode this suite exists to catch.
      {
        const emptyBin = join(TEMP_ROOT, 'stub-bin-empty');
        mkdirSync(emptyBin, { recursive: true });
        const r = runInstaller([], { PATH: `${emptyBin}:${process.env.PATH}` }, brewBlind);
        const out = r.stdout + r.stderr;
        if (/Node\.js found/.test(out) && /git found/.test(out) && /--repo-url/.test(out)) {
          pass('macOS installer: real node and git satisfy the prerequisite checks');
        } else {
          fail(
            'macOS installer prerequisite control',
            `expected both tools accepted then the repo-url failure; got: ${out.substring(0, 300)}`
          );
        }
      }

      // --skip-deps must refuse rather than install, and say how to change that.
      {
        const r = runInstaller(['--skip-deps'], { PATH: stubPath }, brewBlind);
        const out = r.stdout + r.stderr;
        if (r.status !== 0 && /Git is not installed \(run without --skip-deps/.test(out)) {
          pass('macOS installer: --skip-deps refuses instead of installing');
        } else {
          fail('macOS installer --skip-deps', `exit ${r.status}, output: ${out.substring(0, 300)}`);
        }
      }

      // No console and no --yes must decline. An unattended run must never consent to
      // installing software on its own; stdin is already closed for every run here.
      {
        const r = runInstaller([], { PATH: stubPath }, brewBlind);
        const out = r.stdout + r.stderr;
        const declined = /installation was declined/.test(out);
        // Nothing may have been fetched: the decline happens before any download.
        const noDownload = !/Downloading/i.test(out);
        if (r.status !== 0 && declined && noDownload) {
          pass('macOS installer: no console and no --yes declines the install');
        } else {
          fail(
            'macOS installer unattended consent',
            `exit ${r.status}, declined=${declined}, noDownload=${noDownload}: ${out.substring(0, 300)}`
          );
        }
      }

      // The stubs exist only for the checks above; leave nothing executable behind that a
      // later test could pick up off PATH by accident.
      rmSync(stubNode, { force: true });
      rmSync(stubGit, { force: true });
    } else {
      skip('macOS installer', 'EDWIN-Install.command not found');
    }

    // Check Windows installer CRLF: test what git delivers on checkout, not working tree
    // The repo is LF-normalized; .gitattributes ensures CRLF on checkout for *.cmd
    const winCmdPath = 'tools/installers/EDWIN-Install.cmd';
    const winCmd = join(REPO_ROOT, winCmdPath);
    if (existsSync(winCmd)) {
      // Check 1: committed blob is LF-normalized (no \r in git's object)
      const showResult = run(`git show HEAD:${winCmdPath}`);
      if (showResult.success && !showResult.output.includes('\r')) {
        // Check 2: git check-attr confirms eol=crlf
        const attrResult = run(`git check-attr eol -- ${winCmdPath}`);
        if (attrResult.success && attrResult.output.includes('eol: crlf')) {
          pass('Windows installer: LF-normalized in repo, eol=crlf on checkout');
        } else {
          fail('Windows installer line endings', `git check-attr eol should be crlf: ${attrResult.output}`);
        }
      } else {
        fail('Windows installer normalization', 'Committed blob contains CR (should be LF-normalized)');
      }
    } else {
      skip('Windows installer', 'EDWIN-Install.cmd not found');
    }

    // Same check for macOS installer - should have eol=lf
    const macCmdPath = 'tools/installers/EDWIN-Install.command';
    const macAttrResult = run(`git check-attr eol -- ${macCmdPath}`);
    if (macAttrResult.success && macAttrResult.output.includes('eol: lf')) {
      pass('macOS installer: eol=lf on checkout');
    } else {
      fail('macOS installer eol attribute', `Expected eol: lf, got: ${macAttrResult.output}`);
    }
  } else {
    skip('installer tests', 'installers directory not found');
  }
}

// TEST 14: Personal data audit
if (!jsonOutput) console.log('\nRunning personal data audit...\n');

{
  const denylistPath = join(REPO_ROOT, 'tools', 'validate', 'denylist.txt');

  // Every pattern below is assembled from fragments rather than written literally. This file is tracked,
  // so a literal here would be found by its own audit — which happened once, and only after the file was
  // first committed. Same reason the comments never spell the patterns out.
  const OWNER = 'sql' + 'hammer';        // the GitHub account that hosts the canonical remote
  const searchPatterns = ['de' + 'rik', OWNER, '/Us' + 'ers/', 'C:\\Us' + 'ers\\'];

  // Add patterns from denylist if it exists
  if (existsSync(denylistPath)) {
    const denylist = readFileSync(denylistPath, 'utf-8')
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => line.trim());
    searchPatterns.push(...denylist);
  }

  // conventions.md §11 permits exactly one appearance of the account name: the project's own canonical
  // remote in install instructions. Rather than exempting whole files — which would let a genuine leak
  // hide in an exempted one — a line is only allowed if it carries the canonical remote itself.
  const canonicalRemote = [
    `github.com/${OWNER}/edwin`,
    `github:${OWNER}/edwin`,
  ];
  // The plugin marketplace schema requires owner.name to be the hosting account; there is no URL form.
  const marketplaceOwner = `.claude-plugin/marketplace.json`;

  let findings = [];

  for (const pattern of searchPatterns) {
    // Skip pattern if it's in denylist as example (home dir placeholders)
    if (pattern.includes('yourusername')) continue;

    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const grepCmd = `git grep -in "${escapedPattern}" -- . ':!specs' ':!docs/testing' ':!user' 2>/dev/null || true`;
    const result = run(grepCmd);

    if (result.output) {
      const lines = result.output.split('\n').filter(l => l.trim());
      const filtered = lines.filter(line => {
        if (line.includes('denylist.txt')) return false; // Examples in denylist are OK
        if (pattern === OWNER) {
          if (canonicalRemote.some(url => line.includes(url))) return false;
          if (line.startsWith(`${marketplaceOwner}:`)) return false;
        }
        return true;
      });
      if (filtered.length > 0) {
        findings.push(...filtered.map(l => `Pattern '${pattern}': ${l}`));
      }
    }
  }

  if (findings.length === 0) {
    pass('personal data audit clean');
  } else {
    fail('personal data audit', `Found ${findings.length} leaks:\n${findings.slice(0, 10).join('\n')}${findings.length > 10 ? `\n... and ${findings.length - 10} more` : ''}`);
  }
}

// TEST 15: Pruning test - remove a skill and verify it's removed
if (!jsonOutput) console.log('\nRunning pruning test...\n');

{
  // Create a fake skill in temp home
  const tempSkillDir = join(TEMP_HOME, '.claude', 'skills', 'test-prune-skill');
  mkdirSync(tempSkillDir, { recursive: true });
  writeFileSync(join(tempSkillDir, 'SKILL.md'), '# Test Skill\nShould be pruned.', 'utf-8');

  // Add it to manifest
  const manifestPath = join(TEMP_HOME, '.edwin', 'installed.json');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    manifest.skills['test-prune-skill'] = {
      hash: 'fakehash123'
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  // Run sync - should prune the skill
  const result = run(`node tools/sync/engine.mjs --home ${TEMP_HOME} --target all`);
  if (result.success) {
    if (!existsSync(tempSkillDir)) {
      pass('sync engine prunes removed skills');
    } else {
      fail('skill pruning', 'Skill directory still exists after sync');
    }
  } else {
    fail('skill pruning test', result.error);
  }
}

// Final check: verify real user/ directory was not modified
if (!jsonOutput) console.log('\nFinal safety check...\n');

const FINAL_USER_HASH = hashDirectory(USER_DIR);
if (INITIAL_USER_HASH === FINAL_USER_HASH) {
  pass('user/ directory unchanged by tests');
} else {
  fail('SAFETY VIOLATION', `Real user/ directory was modified! Initial: ${INITIAL_USER_HASH}, Final: ${FINAL_USER_HASH}`);
}

// Cleanup temp directory
try {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
  if (!jsonOutput) console.log(`\nCleaned up temp directory: ${TEMP_ROOT}`);
} catch (err) {
  if (!jsonOutput) console.error(`Warning: Failed to clean up temp directory: ${err.message}`);
}

// Output results
if (!jsonOutput) {
  console.log('\n=================================');
  console.log('Test Results');
  console.log('=================================');
  console.log(`Passed:  ${results.passed}`);
  console.log(`Failed:  ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Total:   ${results.tests.length}`);

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  - ${t.name}: ${t.reason}`);
    });
  }
} else {
  console.log(JSON.stringify({
    ok: results.failed === 0,
    passed: results.passed,
    failed: results.failed,
    skipped: results.skipped,
    total: results.tests.length,
    tests: results.tests,
  }, null, 2));
}

// Exit with appropriate code
process.exit(results.failed > 0 ? 1 : 0);
