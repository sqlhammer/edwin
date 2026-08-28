---
name: edwin-memory
description: Learns about the user over time — preferences, people, patterns, facts — by observing conversations, confirming before committing, and recalling in future sessions. Use when the user says "remember that", "what do you remember about me", "forget X", or "tidy your memory".
contexts: all
version: 1.0.1
requires: [tools/memory/memory.mjs]
author: edwin-core
---

# Memory System

## Purpose

EDWIN learns durable facts about the user — preferences, people, work patterns, stable facts — and recalls them across sessions like a human assistant would. Memory is captured through observation with confirmation, never assumed.

## When to use

- User says "remember that ...", "remember this", "keep that in mind"
- User asks "what do you remember about me", "what do you know about X"
- User says "forget ...", "stop remembering X", "update: I've changed teams"
- User says "tidy your memory", "consolidate your memory", "clean up what you remember"
- The memory-capture hook fires (see `core/persona/hooks/memory-capture.md`)

Not for:
- Session-specific context (use conversation history, not memory).
- Speculative or unconfirmed information.

## Instructions

### 1. Observing and proposing (hook-driven)

The `memory-capture` hook watches for durable signals during conversation:
- Stated preferences ("I prefer X", "I hate Y", "always do Z")
- Corrections to EDWIN's behavior ("Actually, I use Emacs not Vim")
- Recurring people or projects mentioned by name
- Stable facts volunteered by the user (role, tools, team names, contexts)

**Privacy rules** (never violated):
- Never store credentials, API keys, passwords, tokens, secrets
- Never store health information, financial details, account numbers
- Never store anything about third parties beyond names and roles unless the user explicitly says "remember this about X"

Candidates accumulate in `user/memory/pending.md`. At a natural pause (task complete, not mid-task) or when pending count ≥ 3, ask **once, batched**:

> I noticed a few things worth remembering:
> 1. [Candidate 1]
> 2. [Candidate 2]
> 3. [Candidate 3]
>
> Keep any of these?

**User responses:**
- "All" / "yes" → confirm all, move to `memory.md`
- "1 and 3" / "just the first one" → confirm selected only
- "No" / "none" → tombstone all (never propose again)

**Tombstones:** Rejected candidates go to the Tombstones section with source `tombstone`. A tombstoned entry is **never proposed again**, even if observed multiple times.

**Opt-out:** If `preferences.memoryCapture` is `false` in `user/config.json`, remain silent (no proposals). If `state.offTheRecord` is `true` in `user/state.json`, suppress capture for the session.

**First-time explanation:** If `user/memory/memory.md` does not exist, explain memory on first proposal:

> I can remember things about you across sessions — preferences, people, patterns. I'll confirm before storing anything, and you can forget items anytime. Want me to remember these?

### 2. Explicit memory capture

When the user says "remember that ..." or "keep this in mind":

**Shell available:** Invoke `node tools/memory/memory.mjs append <section> "<entry text>" --context <active-context>`.

Sections:
- `Preferences` — how you like things done, verbosity, style, tools
- `People` — names, roles, relationships (first names or roles only unless more provided)
- `Work patterns` — recurring workflows, schedules, team structures
- `Facts` — stable information (role, location, contexts, tech stack)
- `Dislikes` — things to avoid, never-do rules

Choose the section based on the entry's nature. If unclear, default to `Facts`.

**File tools available, no shell:** Read `user/memory/memory.md`, append the entry with metadata comment:

```markdown
<!-- YYYY-MM-DD | <context> | confirmed -->
<entry text>
```

**No file tools (web portal):** State that memory is read-only in this environment. The user must record it in their installed EDWIN.

**Confirm:**

> Remembered: <entry text>

### 3. Recalling memory

The digest (`user/memory/digest.md`) rides in every session via the `<!-- EDWIN:MEMORY -->` section in `CLAUDE.md`. Treat it as background knowledge — recall it when relevant, never recite it unprompted.

When asked "what do you remember about me" or "what do you know about X":

**Shell available:** Invoke `node tools/memory/memory.mjs list` (all) or `node tools/memory/memory.mjs list --section <name>` (filtered).

**File tools available, no shell:** Read `user/memory/memory.md` directly and summarize the requested section(s).

**Format the response as a readable summary**, grouped by section:

> Here's what I remember:
>
> **Preferences:**
> - Hyper-concise responses
> - Verbosity: concise
>
> **People:**
> - Name: Alex, addressed as Alex
> - Reports to: Jordan (manager)
>
> **Facts:**
> - Primary contexts: Work, Home
> - Tech stack: Node.js, PostgreSQL

### 4. Forgetting

When the user says "forget X" or "stop remembering Y":

**Shell available:** Invoke `node tools/memory/memory.mjs tombstone "<entry text or unique phrase>"`. The script searches for a matching entry, moves it to Tombstones, and prevents future proposals.

**File tools available, no shell:** Read `user/memory/memory.md`, find the matching entry, move it to the Tombstones section with source `tombstone`, and write the file back.

**Confirm:**

> Forgotten: <entry text>

### 5. Consolidation (tidying)

When the user says "tidy your memory" or monthly (suggested cadence via scheduler):

1. **Scan for duplicates.** If found, ask which to keep:

   > I see two similar entries: "Prefers concise responses" and "Verbosity: concise". Merge them?

2. **Scan for stale entries.** For entries older than 6 months in Work patterns or People sections, confirm they're still relevant:

   > Is this still current: "Reports to Jordan (manager)"? It's from 6 months ago.

3. **Regenerate the digest.**

   **Shell available:** Invoke `node tools/memory/memory.mjs regenerate-digest`. This ranks entries (confirmed + recent) and rebuilds `digest.md` under the 60-line budget.

   **File tools available, no shell:** Read `user/memory/memory.md`, rank entries (confirmed first, then by date descending), select top entries to fit ~60 lines, write to `user/memory/digest.md` in the same format as memory.md but without Tombstones.

4. **Sync the digest to CLAUDE.md.**

   **Shell available:** Invoke `node tools/sync/engine.mjs` to refresh the MEMORY section.

   **No shell:** Instruct the user to run the sync or manually copy `digest.md` content to the MEMORY section in their `CLAUDE.md`.

**Confirm:**

> Memory tidied. Digest regenerated with <N> entries (<L> lines).

## Optional script hooks

| Script | Purpose | Invocation |
|--------|---------|-----------|
| `tools/memory/memory.mjs` | Append, edit, tombstone entries; regenerate digest | `node tools/memory/memory.mjs <command> [args] [--dry-run] [--json]` |

Commands:
- `append <section> "<entry>" [--context <ctx>]` — add new entry
- `edit <line-number> "<new-text>"` — update an entry
- `tombstone "<entry-text>"` — move entry to tombstones or add new tombstone
- `regenerate-digest` — rebuild digest.md with value ranking under 60-line budget
- `confirm-pending <index|all>` — move pending candidate(s) to memory
- `list [--section <name>]` — display memory entries

The script supports `--help`, `--dry-run`, and `--json`.

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| Shell | Invoke `memory.mjs` for all operations | Use file tools to read/write `user/memory/*.md` directly, following the documented format |
| File tools | Read and write memory files directly | Print the entry and file path; user saves manually. Recall from the digest in `CLAUDE.md` (read-only). |

## Examples

### Observing and confirming (Alex, shell available)

**Context:** EDWIN notices Alex prefers short responses and mentions using VS Code twice.

**EDWIN:** _(at task completion)_
> I noticed a few things worth remembering:
> 1. Prefers hyper-concise responses
> 2. Uses VS Code as primary editor
>
> Keep any of these?

**User:** Both

**EDWIN:** _(invokes `memory.mjs append` twice)_
> Remembered both.

Additional examples (explicit memory capture, recalling, forgetting, consolidation, first-time explanation, privacy refusals, tombstones) are in `reference/examples.md`.
