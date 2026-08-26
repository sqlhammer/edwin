#!/usr/bin/env node

// v0.1 compatibility entry point. WU-06 replaces this with tools/sync/engine.mjs
// behind bin/edwin-install.mjs; until then this keeps `npx github:sqlhammer/edwin`
// working against the v0.2 layout.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot    = path.join(__dirname, '..');
const skillsSrc  = path.join(pkgRoot, 'core', 'skills');
const claudeDir  = path.join(os.homedir(), '.claude');
const skillsDest = path.join(claudeDir, 'SKILLS');

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('EDWIN installer');
console.log('Installing skills to: ' + skillsDest);

fs.mkdirSync(claudeDir, { recursive: true });

const skillDirs = fs.readdirSync(skillsSrc, { withFileTypes: true })
  .filter(e => e.isDirectory());

if (skillDirs.length === 0) {
  console.error('ERROR: No skill directories found in package. This is a packaging bug.');
  process.exit(1);
}

let copied = 0;
for (const skillDir of skillDirs) {
  copyDirRecursive(
    path.join(skillsSrc, skillDir.name),
    path.join(skillsDest, skillDir.name)
  );
  console.log('  [+] ' + skillDir.name);
  copied++;
}

const claudeMdSrc  = path.join(pkgRoot, 'CLAUDE.md');
const claudeMdDest = path.join(claudeDir, 'CLAUDE.md');

if (fs.existsSync(claudeMdSrc)) {
  if (!fs.existsSync(claudeMdDest)) {
    fs.copyFileSync(claudeMdSrc, claudeMdDest);
    console.log('  [+] CLAUDE.md -> ~/.claude/CLAUDE.md');
  } else {
    console.log('  [~] CLAUDE.md already exists, skipping.');
  }
}

console.log('\nDone. ' + copied + ' skill(s) installed.');
console.log('Restart Claude Code to load the new skills.');
