---
name: edwin-setup
description: First-run onboarding that configures EDWIN for a new user. Triggers automatically when user/config.json is missing, or when the user says "set up EDWIN", "configure EDWIN", or "start over". Collects preferences and writes configuration files.
contexts: all
version: 1.0.0
requires: [tools/sync/init-user.mjs]
author: edwin-core
---

# EDWIN Setup

## Purpose

Configure EDWIN for first use by collecting the user's name, preferences, and context choices, then writing the necessary configuration files.

## When to use

- `user/config.json` does not exist at session start.
- User says "set up EDWIN", "configure EDWIN", "onboard me", or "start over".

Not for:
- Changing a single preference (edit `user/config.json` directly or via conversation).
- Switching contexts (use the active context in `user/state.json`).

## Instructions

### 1. Batch the questions

Ask all questions in one or two exchanges. Do not interrogate one item at a time.

> Before we begin properly, I need a few details:
>
> 1. What should I call you?
> 2. How would you like to be addressed? (If different from your name)
> 3. Which contexts do you work in? I can set up **Work**, **Home**, or just **Global** (everything in one place). You can add more later.
> 4. What's your primary harness? (Claude Code terminal, Claude Desktop, Cowork, or web portal)
> 5. What OS are you on? (Windows, macOS, Linux)
> 6. Verbosity preference: **concise** (brief, offer detail) or **detailed** (slightly fuller responses)?

### 2. Validate and clarify

- If the user's response is ambiguous (e.g., just says "yes"), clarify which question they answered.
- If they skip a question, use sensible defaults: `addressAs` = `name`, contexts = `["Global"]`, verbosity = `concise`.
- Harness can be detected (see below) but confirm with the user.

### 3. Write the config files

Construct `user/config.json` per the schema:

```json
{
  "schemaVersion": 1,
  "name": "<user's name>",
  "addressAs": "<how to address them>",
  "os": "<windows|macos|linux>",
  "harness": "<claude-code|claude-desktop|cowork|web>",
  "contextsOwned": ["<context>", ...],
  "preferences": {
    "verbosity": "<concise|detailed>",
    "memoryCapture": true,
    "bragDetection": true,
    "workflowObservation": true
  },
  "publish": { "remote": "", "branch": "main" },
  "positioning": ""
}
```

And `user/state.json`:

```json
{
  "schemaVersion": 1,
  "activeContext": "Global",
  "offTheRecord": false,
  "lastSync": "<current ISO timestamp>"
}
```

**Execution path:**
- **Shell available:** Invoke `node tools/sync/init-user.mjs --name "<name>" --address-as "<addressAs>" --os <os> --harness <harness> --contexts "<comma-separated>" --verbosity <verbosity>`. The script writes both files.
- **File tools available, no shell:** Write both files directly using the Write tool.
- **No file tools (web portal):** Print both JSON objects with clear instructions:

> Here's your configuration. Save these files:
>
> **File:** `user/config.json`  
> ```json
> { ... }
> ```
>
> **File:** `user/state.json`  
> ```json
> { ... }
> ```

### 4. Confirm and tour

Once files are written (or printed):

> All set, <addressAs>. I'm ready when you are.
>
> **Quick tour:**
> - I organize my capabilities into **skills** — focused methodologies for specific tasks. You're currently in the **<activeContext>** context.
> - To switch contexts: "Switch to Work" or "Switch to Home".
> - To see what I can do: "List skills" or "What skills are in this context?"
> - To create a new skill by chatting about what you need: just describe the task you want help with repeatedly, and I'll offer to turn it into a skill.

### 5. Seed memory

If the `edwin-memory` skill is installed, record the answers you just collected — name, how they like to be addressed, and their contexts — as confirmed memory entries. They came from the user directly, so they need no further confirmation. If that skill is not installed, skip this step silently.

### 6. Harness detection hint

If the user hasn't specified a harness, detect it and confirm:

- Bash tool available + git context → Claude Code
- File tools available, no Bash → Claude Desktop or Cowork
- No file tools → web portal

> I see you're using <detected harness>. Is that correct?

## Optional script hooks

| Script | Purpose | Invocation |
|--------|---------|-----------|
| `tools/sync/init-user.mjs` | Writes `user/config.json` and `user/state.json` atomically | `node tools/sync/init-user.mjs --name "Alex" --address-as "Alex" --os macos --harness claude-code --contexts "Work,Home" --verbosity concise` |

The script supports `--help`, `--dry-run`, and `--json` (emits the config objects without writing).

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| Shell | Invoke `init-user.mjs` | Use file tools to write the JSON files directly |
| File tools | Write files directly | Print the JSON for the user to save manually with clear file paths |

## Examples

### Example 1: First run (Alex, Windows, shell available)

**User:** _(session starts, no config detected)_

**EDWIN:**
> I'm EDWIN — your personal AI assistant. Before we begin properly, I need a few details:
>
> 1. What should I call you?
> 2. How would you like to be addressed?
> 3. Which contexts do you work in? I can set up **Work**, **Home**, or just **Global** (everything in one place).
> 4. What's your primary harness? (Claude Code terminal, Claude Desktop, Cowork, or web portal)
> 5. What OS are you on? (Windows, macOS, Linux)
> 6. Verbosity preference: **concise** (brief, offer detail) or **detailed** (slightly fuller responses)?

**User:** Alex, just Alex is fine. Work and Home. Claude Code. Windows. Concise.

**EDWIN:** _(invokes init-user.mjs)_
> All set, Alex. I'm ready when you are.
>
> **Quick tour:**
> - I organize my capabilities into **skills** — focused methodologies for specific tasks. You're currently in the **Global** context.
> - To switch contexts: "Switch to Work" or "Switch to Home".
> - To see what I can do: "List skills" or "What skills are in this context?"
> - To create a new skill: just describe the task you need help with, and I'll offer to turn it into a skill if I see a pattern.

### Example 2: Web portal (Sam, macOS, no file tools)

**User:** Set up EDWIN

**EDWIN:**
> I need a few details:
>
> 1. What should I call you?
> 2. Which contexts do you work in? (**Work**, **Home**, or **Global**)
> 3. Verbosity: **concise** or **detailed**?

**User:** Sam. Just Global. Concise.

**EDWIN:**
> Here's your configuration. Save these files in the `user/` folder:
>
> **File:** `user/config.json`  
> ```json
> {
>   "schemaVersion": 1,
>   "name": "Sam",
>   "addressAs": "Sam",
>   "os": "macos",
>   "harness": "web",
>   "contextsOwned": ["Global"],
>   "preferences": {
>     "verbosity": "concise",
>     "memoryCapture": true,
>     "bragDetection": true,
>     "workflowObservation": true
>   },
>   "publish": { "remote": "", "branch": "main" },
>   "positioning": ""
> }
> ```
>
> **File:** `user/state.json`  
> ```json
> {
>   "schemaVersion": 1,
>   "activeContext": "Global",
>   "offTheRecord": false,
>   "lastSync": "2026-08-26T12:00:00Z"
> }
> ```
>
> Once saved, I'm ready to help. Type "List skills" to see what I can do.
