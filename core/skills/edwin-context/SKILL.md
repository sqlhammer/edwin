---
name: edwin-context
description: Manages contexts and skill assignments. Use when the user wants to switch contexts, create or rename a context, assign skills to contexts, list skills by context, or asks what context they're currently in.
contexts: all
version: 1.0.1
requires: [tools/sync/context.mjs]
author: edwin-core
---

# Context Manager

## Purpose

Organize skills into named contexts (Work, Home, Travel, etc.) and control which context is active. The active context biases skill suggestions and listings but never restricts access — all skills remain available in every context.

## When to use

- "What context am I in?" / "Switch to Work"
- "Create a context called Travel" / "Rename Home to Personal" / "Remove Travel"
- "Put researcher in Work" / "Take blog-writer out of Home"
- "List my skills" / "What skills are in my Work context?"

Not for:
- Changing individual preferences (edit `user/config.json` directly).
- First-time setup (use `edwin-setup`).

## Instructions

**Degradation pattern:** Each operation below shows the shell command. When shell is unavailable but file tools are available, follow the manual procedures in `reference/manual-procedures.md`. When no file tools are available, print the exact JSON/YAML the user should write and where to save it.

### 1. Reading the active context

When asked "what context am I in" or at session start when context matters:

**Shell:** Invoke `node tools/sync/context.mjs get-active`.

**File tools:** Read `user/state.json` and report `activeContext`.

> You're in the **Work** context.

### 2. Switching contexts

When the user says "switch to X" or "use the Home context":

**Shell:** Invoke `node tools/sync/context.mjs set-active <context-name>`.

**File tools:** Read `user/state.json`, update `activeContext` and `lastSync`, write it back.

**If context doesn't exist:** Offer to create it.

> Switched to **Travel**.

### 3. Creating a context

When the user says "create a context called X" or accepts an offer to create one during a switch:

Ask for a description if not provided:

> What's this context for? (One line)

**Shell:** Invoke `node tools/sync/context.mjs add-context "<name>" "<description>"`.

**File tools:** Read `core/contexts/contexts.json`, append new entry, write it back.

> Context created: **Travel**.

### 4. Renaming a context

When the user says "rename Home to Personal" or "call the Home context Personal instead":

**Refuse if the context is Global:**

> Cannot rename the Global context.

**Otherwise:**

**Shell:** Invoke `node tools/sync/context.mjs rename-context "<old>" "<new>"`. The script propagates the rename across all skill frontmatter automatically.

**File tools:** Follow the manual procedure in `reference/manual-procedures.md` (update contexts.json, all affected skill frontmatter, and state.json).

> Context renamed: **Home** → **Personal**. Updated 5 skills.

### 5. Removing a context

When the user says "remove the Travel context" or "delete Travel":

**Refuse if the context is Global:**

> Cannot remove the Global context.

**Otherwise:** First, count affected skills and confirm if any exist:

> Removing **Travel** will affect 3 skills. They'll revert to `contexts: all`. Confirm?

If the user confirms:

**Shell:** Invoke `node tools/sync/context.mjs remove-context "<name>"`.

**File tools:** Follow the manual procedure in `reference/manual-procedures.md`.

> Context removed: **Travel**. 3 skills reverted to `contexts: all`.

### 6. Listing skills

When the user says "list skills", "what skills are in Work", or "show me my skills":

**Shell:** Invoke `node tools/sync/context.mjs list-skills` (all) or with `--context <name>` (specific).

**File tools:** Follow the manual procedure in `reference/manual-procedures.md` to group skills by active context, other contexts, all-contexts, and persona skills.

**Output format:**

```
Work (active):
  blog-writer
  researcher

All contexts:
  edwin-setup
```

Keep it scannable. No commentary.

### 7. Assigning a skill to a context

When the user says "put researcher in Work" or "assign blog-writer to Home":

**Shell:** Invoke `node tools/sync/context.mjs assign-skill <skill-name> <context-name>`.

**File tools:** Follow the manual procedure in `reference/manual-procedures.md`.

> Assigned **researcher** to **Work**.

### 8. Unassigning a skill from a context

When the user says "take blog-writer out of Work" or "remove researcher from Home":

**Shell:** Invoke `node tools/sync/context.mjs unassign-skill <skill-name> <context-name>`.

**File tools:** Follow the manual procedure in `reference/manual-procedures.md`.

> Unassigned **blog-writer** from **Work**.

## Optional script hooks

| Script | Purpose | Invocation |
|--------|---------|-----------|
| `tools/sync/context.mjs` | Manages contexts and skill assignments with surgical frontmatter editing and automatic rename propagation | `node tools/sync/context.mjs <command> [args] [--json] [--dry-run]` |

Subcommands:
- `get-active` / `set-active <context>`
- `list-contexts` / `add-context <name> <description>` / `rename-context <old> <new>` / `remove-context <name>`
- `list-skills [--context <name>]` / `assign-skill <skill> <context>` / `unassign-skill <skill> <context>`

The script supports `--help`, `--dry-run`, and `--json`.

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| Shell | Invoke `context.mjs` for all operations | Use file tools to read/write `user/state.json`, `core/contexts/contexts.json`, and skill frontmatter directly, following the manual steps documented in §3-8 |
| File tools | Read and write JSON and frontmatter directly | Print the exact JSON the user should write and where to save it, with clear file paths |

## Examples

### Switching contexts (Alex, shell available)

**User:** Switch to Work

**EDWIN:** _(invokes `node tools/sync/context.mjs set-active Work`)_
> Switched to **Work**.

### Listing skills grouped by context (Alex, shell available)

**User:** List my skills

**EDWIN:** _(invokes `node tools/sync/context.mjs list-skills`)_
> Work (active):
>   blog-writer
>   researcher
>
> Home:
>   tutor
>
> All contexts:
>   edwin-setup
>   edwin-context

Additional examples (creating contexts, assigning/unassigning skills, renaming, removing, refusals) are in `reference/examples.md`.
