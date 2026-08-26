---
name: edwin-context
description: Manages contexts and skill assignments. Use when the user wants to switch contexts, create or rename a context, assign skills to contexts, list skills by context, or asks what context they're currently in.
contexts: all
version: 1.0.0
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

### 1. Reading the active context

When asked "what context am I in" or at session start when context matters:

**Shell available:** Invoke `node tools/sync/context.mjs get-active`.

**File tools available, no shell:** Read `user/state.json` and report `activeContext`.

**No file tools:** State that you cannot determine the active context without file access.

> You're in the **Work** context.

### 2. Switching contexts

When the user says "switch to X" or "use the Home context":

**Shell available:** Invoke `node tools/sync/context.mjs set-active <context-name>`.

**File tools available, no shell:** Read `user/state.json`, update `activeContext` to the new value, update `lastSync` to the current ISO timestamp, and write it back.

**If the context does not exist:** Offer to create it.

> Context "Travel" doesn't exist yet. Want me to create it? If so, give me a one-line description.

Once switched:

> Switched to **Travel**.

### 3. Creating a context

When the user says "create a context called X" or accepts an offer to create one during a switch:

Ask for a description if not provided:

> What's this context for? (One line)

**Shell available:** Invoke `node tools/sync/context.mjs add-context "<name>" "<description>"`.

**File tools available, no shell:** Read `core/contexts/contexts.json`, append a new entry `{ "name": "<name>", "description": "<description>" }` to the `contexts` array, and write it back.

> Context created: **Travel**.

### 4. Renaming a context

When the user says "rename Home to Personal" or "call the Home context Personal instead":

**Refuse if the context is Global:**

> Cannot rename the Global context.

**Otherwise:**

**Shell available:** Invoke `node tools/sync/context.mjs rename-context "<old>" "<new>"`. The script propagates the rename across all skill frontmatter automatically.

**File tools available, no shell (manual fallback):**

1. Read `core/contexts/contexts.json`, find the context with `name: <old>`, change it to `<new>`, write it back.
2. For every skill in `core/skills/`:
   - Read `SKILL.md` frontmatter.
   - If `contexts:` includes `<old>`, replace it with `<new>`.
   - Write the updated frontmatter back, preserving all other content.
3. Read `user/state.json`. If `activeContext` is `<old>`, change it to `<new>` and write it back.

Report the outcome:

> Context renamed: **Home** → **Personal**. Updated 5 skills.

### 5. Removing a context

When the user says "remove the Travel context" or "delete Travel":

**Refuse if the context is Global:**

> Cannot remove the Global context.

**Otherwise:**

First, check how many skills are assigned to this context.

**Shell available:** Invoke `node tools/sync/context.mjs list-skills --context <name> --json` and count the results.

**File tools available, no shell:** Read each `core/skills/*/SKILL.md` frontmatter and count how many have this context in their `contexts:` list.

If skills are affected, confirm:

> Removing **Travel** will affect 3 skills. They'll revert to `contexts: all`. Confirm?

If the user confirms:

**Shell available:** Invoke `node tools/sync/context.mjs remove-context "<name>"`.

**File tools available, no shell:**

1. Read `core/contexts/contexts.json`, remove the context from the `contexts` array, write it back.
2. For every skill in `core/skills/` that has this context in its `contexts:` list:
   - Remove the context from the list.
   - If the list becomes empty, set `contexts: all`.
   - Write the updated frontmatter back.
3. Read `user/state.json`. If `activeContext` is the removed context, set it to `Global` and write it back.

> Context removed: **Travel**. 3 skills reverted to `contexts: all`.

### 6. Listing skills

When the user says "list skills", "what skills are in Work", or "show me my skills":

**Shell available:** Invoke `node tools/sync/context.mjs list-skills` (for all) or `node tools/sync/context.mjs list-skills --context <name>` (for a specific context).

**File tools available, no shell:**

1. Read `user/state.json` to get the active context.
2. Read `core/contexts/contexts.json` to get all context names.
3. For each skill in `core/skills/`:
   - Read its frontmatter.
   - Parse its `contexts:` field (may be `all` or a list `[Work, Home]`).
   - If `type: persona`, set it aside in a separate group.
4. Group skills:
   - Active context skills first.
   - Other contexts in order.
   - Skills with `contexts: all` in a separate group.
   - Persona skills (`type: persona`) at the end in their own group.

**Output format:**

```
Work (active):
  blog-writer
  researcher

Home:
  analyst

All contexts:
  edwin-setup
  edwin-context

Persona skills:
  strategist
  intellectual-sparing-partner
```

Keep it scannable. No commentary.

### 7. Assigning a skill to a context

When the user says "put researcher in Work" or "assign blog-writer to Home":

**Shell available:** Invoke `node tools/sync/context.mjs assign-skill <skill-name> <context-name>`.

**File tools available, no shell:**

1. Verify the context exists in `core/contexts/contexts.json`.
2. Find the skill's `SKILL.md` in `core/skills/<skill-name>/`.
3. Read its frontmatter.
4. If `contexts: all`, replace it with `[<context-name>]`.
5. If `contexts: [...]`, append `<context-name>` to the list if not already present.
6. Write the updated frontmatter back.

> Assigned **researcher** to **Work**.

If the skill is already in that context:

> **researcher** is already in **Work**.

### 8. Unassigning a skill from a context

When the user says "take blog-writer out of Work" or "remove researcher from Home":

**Shell available:** Invoke `node tools/sync/context.mjs unassign-skill <skill-name> <context-name>`.

**File tools available, no shell:**

1. Verify the context exists in `core/contexts/contexts.json`.
2. Find the skill's `SKILL.md`.
3. Read its frontmatter.
4. If `contexts: all`, report that you cannot unassign from a specific context when the skill is in all contexts.
5. If `contexts: [...]`, remove `<context-name>` from the list.
6. If the list becomes empty, set `contexts: all`.
7. Write the updated frontmatter back.

> Unassigned **blog-writer** from **Work**.

If the skill was not in that context:

> **blog-writer** is not in **Work**.

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

### Example 1: Switching contexts (Alex, shell available)

**User:** Switch to Work

**EDWIN:** _(invokes `node tools/sync/context.mjs set-active Work`)_
> Switched to **Work**.

### Example 2: Creating a context (Sam, file tools only)

**User:** Create a context called Travel

**EDWIN:**
> What's this context for? (One line)

**User:** Travel planning and bookings

**EDWIN:** _(reads `core/contexts/contexts.json`, appends `{ "name": "Travel", "description": "Travel planning and bookings" }`, writes it back)_
> Context created: **Travel**.

### Example 3: Listing skills grouped by context (Alex, shell available)

**User:** List my skills

**EDWIN:** _(invokes `node tools/sync/context.mjs list-skills`)_
> Work (active):
>   blog-writer
>   researcher
>   analyst
>
> Home:
>   tutor
>
> All contexts:
>   edwin-setup
>   edwin-context
>
> Persona skills:
>   strategist
>   intellectual-sparing-partner

### Example 4: Assigning a skill to a context (Sam, shell available)

**User:** Put the prompter skill in Work

**EDWIN:** _(invokes `node tools/sync/context.mjs assign-skill prompter Work`)_
> Assigned **prompter** to **Work**.

### Example 5: Renaming a context (Alex, file tools only)

**User:** Rename Home to Personal

**EDWIN:** _(reads `core/contexts/contexts.json`, changes `"name": "Home"` to `"name": "Personal"`, writes it back)_
_(for each skill with `contexts: [Home, ...]`, replaces `Home` with `Personal` in frontmatter)_
_(reads `user/state.json`, if `activeContext` is `"Home"`, changes it to `"Personal"`, writes it back)_
> Context renamed: **Home** → **Personal**. Updated 4 skills.

### Example 6: Attempting to remove Global (Sam)

**User:** Remove the Global context

**EDWIN:**
> Cannot remove the Global context.

### Example 7: Removing a context with confirmation (Alex, shell available)

**User:** Remove the Travel context

**EDWIN:** _(invokes `node tools/sync/context.mjs list-skills --context Travel --json` and counts results)_
> Removing **Travel** will affect 2 skills. They'll revert to `contexts: all`. Confirm?

**User:** Yes

**EDWIN:** _(invokes `node tools/sync/context.mjs remove-context Travel`)_
> Context removed: **Travel**. 2 skills reverted to `contexts: all`.
