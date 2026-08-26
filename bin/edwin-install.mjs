#!/usr/bin/env node

/**
 * edwin-install.mjs
 *
 * npx entry point for installing EDWIN from GitHub.
 *
 * Usage:
 *   npx github:<owner>/<repo> [options]     (owner/repo read from package.json)
 *
 * Options:
 *   --target <code|desktop|all>    Target harness (default: all)
 *   --dry-run                      Show what would be done
 *   --uninstall                    Remove EDWIN
 *   --force                        Force overwrite
 *   --help                         Show help
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Node version check
const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
if (nodeMajor < 18) {
  console.error(`\nERROR: Node.js version 18 or higher is required.`);
  console.error(`You have ${process.version}.`);
  console.error(`\nPlease upgrade Node.js: https://nodejs.org/\n`);
  process.exit(1);
}

// Check if git is installed
function hasGit() {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!hasGit()) {
  console.error(`\nERROR: git is not installed.`);
  console.error(`\nPlease install git: https://git-scm.com/downloads\n`);
  process.exit(1);
}

// Read repository info from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');
// package.json is the single source of truth for where to clone from. Refuse to guess:
// silently falling back to a default owner would clone upstream over a user's fork.
let packageJson;
try {
  packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
} catch {
  console.error(`\nERROR: could not read ${packageJsonPath}.`);
  console.error(`The installer needs it to know which repository to install from.\n`);
  process.exit(1);
}

const repoUrl = packageJson.repository?.url;
if (!repoUrl) {
  console.error(`\nERROR: package.json has no "repository.url".`);
  console.error(`Add it so the installer knows which repository to install from.\n`);
  process.exit(1);
}

const cleanUrl = repoUrl.replace(/^git\+/, ''); // Strip git+ prefix if present
const match = cleanUrl.match(/github\.com[/:](.+?)\/(.+?)(\.git)?$/);
if (!match) {
  console.error(`\nERROR: could not parse a GitHub owner/repo out of "${repoUrl}".`);
  console.error(`The installer currently supports GitHub remotes only.\n`);
  process.exit(1);
}

const repoOwner = match[1];
const repoName = match[2];
const githubShorthand = `github:${repoOwner}/${repoName}`;

// Detect if we're running from inside a git clone
function isInsideRepo() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const potentialRepoRoot = join(__dirname, '..');

  // Check if this looks like the edwin repo
  const hasPackageJson = existsSync(join(potentialRepoRoot, 'package.json'));
  const hasCoreDir = existsSync(join(potentialRepoRoot, 'core'));
  const hasToolsDir = existsSync(join(potentialRepoRoot, 'tools'));

  if (hasPackageJson && hasCoreDir && hasToolsDir) {
    // Verify it's actually a git repo
    try {
      execSync('git rev-parse --git-dir', {
        cwd: potentialRepoRoot,
        stdio: 'ignore',
      });
      return potentialRepoRoot;
    } catch {
      return null;
    }
  }

  return null;
}

// Clone or update the repo
function ensureRepo() {
  const existingRepo = isInsideRepo();

  if (existingRepo) {
    console.log('Running from local edwin repository...\n');
    return existingRepo;
  }

  const cacheDir = join(homedir(), '.cache', 'edwin');
  const repoPath = join(cacheDir, 'repo');

  console.log('Installing EDWIN...\n');

  if (existsSync(repoPath)) {
    // Update existing clone
    console.log('Updating cached repository...');
    try {
      execSync('git fetch origin', { cwd: repoPath, stdio: 'inherit' });
      execSync('git reset --hard origin/main', { cwd: repoPath, stdio: 'inherit' });
      console.log();
    } catch (err) {
      console.error('\nFailed to update repository. Trying fresh clone...');
      try {
        rmSync(repoPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      return cloneRepo(cacheDir, repoPath);
    }
  } else {
    return cloneRepo(cacheDir, repoPath);
  }

  return repoPath;
}

function cloneRepo(cacheDir, repoPath) {
  console.log('Cloning EDWIN repository...');
  mkdirSync(cacheDir, { recursive: true });

  try {
    execSync(`git clone ${cleanUrl} repo`, {
      cwd: cacheDir,
      stdio: 'inherit',
    });
    console.log();
  } catch (err) {
    console.error('\nFailed to clone repository.');
    console.error('Please check your internet connection and try again.\n');
    process.exit(1);
  }

  return repoPath;
}

// Run the sync engine
function runEngine(repoPath, args) {
  const enginePath = join(repoPath, 'tools', 'sync', 'engine.mjs');

  if (!existsSync(enginePath)) {
    console.error('\nERROR: Sync engine not found in repository.');
    console.error('This may be a corrupted clone. Try removing:');
    console.error(`  ${join(homedir(), '.cache', 'edwin')}\n`);
    process.exit(1);
  }

  console.log('Running EDWIN sync engine...\n');

  const result = spawnSync('node', [enginePath, ...args], {
    stdio: 'inherit',
    cwd: repoPath,
  });

  if (result.error) {
    console.error('\nFailed to run sync engine:', result.error.message);
    process.exit(1);
  }

  process.exit(result.status || 0);
}

// Main
function main() {
  const args = process.argv.slice(2);

  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
EDWIN Installer

Installs EDWIN skills and persona into Claude Code / Claude Desktop.

Usage:
  npx ${githubShorthand} [options]

Options:
  --target <code|desktop|all>    Install to specific harness (default: all)
  --dry-run                      Show what would be installed without installing
  --uninstall                    Remove EDWIN from your system
  --force                        Force overwrite existing files
  --help, -h                     Show this help

Examples:
  npx ${githubShorthand}
  npx ${githubShorthand} --dry-run
  npx ${githubShorthand} --uninstall

More info: ${cleanUrl.replace('.git', '')}
`);
    process.exit(0);
  }

  const repoPath = ensureRepo();
  runEngine(repoPath, args);
}

main();
