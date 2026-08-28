---
name: edwin-activate
description: Installs EDWIN persona and configuration into Claude Code/Desktop. Use when the user installs EDWIN via the plugin and needs to activate it, or says "activate EDWIN", "set up EDWIN persona", or "install EDWIN configuration".
contexts: all
version: 1.0.0
requires: [shell]
author: edwin-core
---

# EDWIN Activate

## Purpose

Install the EDWIN persona and operating instructions into `~/.claude/CLAUDE.md` so EDWIN's personality, skills, and behavior are active in all sessions. This is the activation step after plugin installation.

## When to use

- User has installed EDWIN via `/plugin install edwin` and needs to activate it
- "Activate EDWIN" / "Set up EDWIN persona" / "Install EDWIN configuration"
- First-time plugin users who need the persona installed

Not for:
- Updating skills (the plugin handles that automatically)
- Onboarding a new user (use `edwin-setup` for preferences)

## Instructions

### 1. Detect installation method

Check if `~/.edwin/installed.json` exists. If it does:

> You already have EDWIN installed via the sync engine. The persona is active. No activation needed.

If the manifest exists and lists skills, the sync path is managing EDWIN. Do not proceed — installing via the plugin would create duplicates.

### 2. Confirm activation

If no sync-engine installation is detected, confirm:

> This will install the EDWIN persona into `~/.claude/CLAUDE.md` so EDWIN's behavior is active in all sessions. Continue?

Wait for confirmation. If declined, stop.

### 3. Run the sync engine

Invoke the sync engine from the plugin directory to install only the persona and framework configuration (not individual skills, since the plugin already provides those):

```bash
node <plugin-path>/tools/sync/engine.mjs --target code
```

The plugin ships with a copy of `tools/sync/` so this operation is self-contained.

### 4. Confirm success

After the sync completes:

> ✓ EDWIN persona installed. Restart Claude to activate it.

If the sync fails, report the error and suggest manual installation:

> Installation failed. You can install manually by running `npx github:sqlhammer/edwin` from a terminal.

### 5. Suggest onboarding

If `user/config.json` does not exist in the plugin directory (first-time user):

> Run `/edwin-setup` to configure your preferences and contexts.

Do not run onboarding automatically — the user may want EDWIN's default behavior first.

## Optional script hooks

This skill requires shell access to invoke the sync engine. No separate script is needed; it invokes the existing `tools/sync/engine.mjs` directly.

## Degradation

| Missing | Behavior |
|---------|----------|
| **Shell** | Print the exact command the user must run manually: `node <plugin-path>/tools/sync/engine.mjs --target code`. Explain they need to find the plugin installation path first via `~/.claude/plugins/`. |
| **File tools** | If shell is unavailable but file tools exist, read the persona files from `core/persona/`, compose them per the template in `core/templates/CLAUDE.md.tmpl`, and write the result to `~/.claude/CLAUDE.md` with managed markers. This duplicates the sync engine's composition logic but avoids the shell dependency. |
| **Both** | Explain that EDWIN cannot self-install without file access. Provide the manual installation command: `npx github:sqlhammer/edwin`. |

## Examples

### Example 1: Plugin user activating EDWIN

**User:** Activate EDWIN

**EDWIN:**  
Checking for existing installation...

No sync-engine installation detected. This will install the EDWIN persona into `~/.claude/CLAUDE.md` so EDWIN's behavior is active in all sessions. Continue?

**User:** Yes

**EDWIN:**  
*(Runs sync engine)*

✓ EDWIN persona installed. Restart Claude to activate it.

Run `/edwin-setup` to configure your preferences and contexts.

---

### Example 2: Sync engine already installed

**User:** Activate EDWIN

**EDWIN:**  
You already have EDWIN installed via the sync engine. The persona is active. No activation needed.
