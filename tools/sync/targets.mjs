/**
 * targets.mjs
 *
 * Isolates all harness-specific path knowledge so a harness change is a one-file fix.
 * Exports target descriptors for each supported Claude harness.
 *
 * Findings from specs/environment-findings.md:
 * - Claude Code uses ~/.claude/
 * - Claude Desktop bundles Claude Code, so Cowork reads the same ~/.claude/ tree
 * - Skills directory is LOWERCASE ~/.claude/skills/ (v0.1 bug: used uppercase SKILLS/)
 * - Windows paths are unverified; probe defensively
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Returns target descriptors for all supported harnesses.
 * Each target has:
 *   id: internal identifier
 *   label: human-readable name
 *   skillsDir: absolute path to skills directory
 *   claudeMdPath: absolute path to CLAUDE.md
 *   detected: boolean indicating if this target exists
 *   coworkDetected: boolean indicating if Cowork is enabled (macOS only)
 *
 * @param {string} [home] - Home directory override (defaults to os.homedir())
 */
export function getTargets(home = null) {
  const homeDir = home || homedir();
  const claudeRoot = join(homeDir, '.claude');

  // Claude Code / Desktop (same paths due to Desktop bundling Code)
  const codeTarget = {
    id: 'code',
    label: 'Claude Code',
    skillsDir: join(claudeRoot, 'skills'),
    claudeMdPath: join(claudeRoot, 'CLAUDE.md'),
    detected: existsSync(claudeRoot),
    coworkDetected: false,
  };

  // Check for Cowork (macOS)
  if (process.platform === 'darwin') {
    const coworkMarker = join(
      homeDir,
      'Library',
      'Application Support',
      'Claude',
      'cowork-enabled-cli-ops.json'
    );
    codeTarget.coworkDetected = existsSync(coworkMarker);
  }

  // Windows Claude Desktop paths (UNVERIFIED)
  // Expected: %APPDATA%\Claude\ but we probe rather than assume
  const desktopTarget = {
    id: 'desktop',
    label: 'Claude Desktop',
    skillsDir: codeTarget.skillsDir, // Same as code due to bundling
    claudeMdPath: codeTarget.claudeMdPath,
    detected: codeTarget.detected,
    coworkDetected: codeTarget.coworkDetected,
  };

  return {
    code: codeTarget,
    desktop: desktopTarget,
    all: [codeTarget], // Desktop is same paths as code, so only one install target
  };
}

/**
 * Returns the legacy v0.1 SKILLS directory (uppercase) for cleanup.
 *
 * @param {string} [home] - Home directory override (defaults to os.homedir())
 */
export function getLegacySkillsDir(home = null) {
  const homeDir = home || homedir();
  return join(homeDir, '.claude', 'SKILLS');
}

/**
 * Returns the EDWIN state directory (~/.edwin/).
 *
 * @param {string} [home] - Home directory override (defaults to os.homedir())
 */
export function getEdwinStateDir(home = null) {
  const homeDir = home || homedir();
  return join(homeDir, '.edwin');
}

/**
 * Returns the manifest path tracking installed skills.
 *
 * @param {string} [home] - Home directory override (defaults to os.homedir())
 */
export function getManifestPath(home = null) {
  return join(getEdwinStateDir(home), 'installed.json');
}
