---
name: edwin-brag
description: Tracks wins and accomplishments — auto-detected from conversation or logged on request — categorized automatically and exportable as performance-review or retrospective docs. Use when the user says "log a win", "brag:", "show my wins", "generate my brag doc", or when accomplishments are mentioned in conversation.
contexts: all
version: 1.0.0
requires: [tools/memory/brags.mjs]
author: edwin-core
---

# Brag Tracker (Wins)

## Purpose

EDWIN keeps a running record of the user's wins — shipped features, positive feedback, milestones, hard conversations, personal achievements — so nothing gets forgotten at review time.

## When to use

- User says "log a win", "brag: <accomplishment>", "I shipped X"
- User asks "show my wins" (filterable by category, size, date range)
- User says "generate my brag doc", "brag doc for Q1"
- User says "edit that win", "delete the last brag", "change category to Work"
- User mentions "create a brag category", "rename category", "merge categories"
- The brag-detection hook fires (see `core/persona/hooks/brag-detection.md`)

Not for:
- Routine tasks without notable impact — this is for wins worth remembering
- Speculative or future plans — only log what's already done

## Instructions

### 1. Auto-detection (hook-driven)

The `brag-detection` hook watches for accomplishment signals during conversation:
- Shipped something ("deployed X", "launched Y", "merged the PR")
- Positive feedback received ("client loved it", "team praised the approach", "manager said...")
- Milestone hit ("reached 100K users", "passed the exam", "finished the migration")
- Hard conversation handled ("gave difficult feedback", "negotiated the terms")
- Personal achievement ("ran a marathon", "published an article", "learned Rust")

**Interaction contract:** Reuses WU-17's observe → propose → confirm pattern (see `edwin-memory` skill for full rules). Candidates accumulate; at a natural pause or when ≥ 3, ask once, batched:

> I noticed a few wins:
> 1. [Candidate 1]
> 2. [Candidate 2]
> 3. [Candidate 3]
>
> Log any of these?

User may accept all, pick specific ones, or decline. Declined wins become tombstones (never proposed again). If `preferences.bragDetection` is `false` in `user/config.json`, remain silent.

### 2. Explicit logging

When the user says "log a win" or "brag: <text>":

**Shell available:** Invoke `node tools/memory/brags.mjs append "<entry-text>" [--context <active-context>] [--size <small|notable|major>]`.

Determine size from impact:
- **small:** Routine accomplishment, positive moment (fixed a gnarly bug, helped a colleague)
- **notable:** Significant work, visible impact (shipped a feature, key milestone, difficult conversation)
- **major:** High-impact, career-defining (launched a product, promoted, major public win)

If uncertain, propose `notable` and let the user adjust.

**Auto-categorization:** EDWIN assigns a category from `user/brags/categories.json` using entry content + active context as a strong hint. State the choice during confirmation:

> Logged under Work — say the word to change it.

If no good match, suggest a new category or prompt the user.

**File tools available, no shell:** Read `user/brags/brags.md`, append entry with metadata comment:

```markdown
<!-- YYYY-MM-DD | <category> | <size> | <context> -->
<entry text>
```

**Confirm:**

> Win logged: <entry text>

### 3. Viewing wins

When asked "show my wins" or "what have I accomplished this month":

**Parse filters:** Category (`Work only`), size (`major wins`), date range (`this month`, `Q1`, `last 6 months`).

**Shell available:** Invoke `node tools/memory/brags.mjs list [--category <name>] [--size <size>] [--since <date>]`.

**File tools available, no shell:** Read `user/brags/brags.md` directly and filter entries matching the criteria.

**Format response:**

> **Q1 2026 — Work wins (notable and major):**
> - [March 3] Shipped the analytics dashboard — doubled user engagement (major)
> - [Feb 15] Led the incident response for the outage — minimal downtime (notable)
> - [Jan 10] Negotiated new vendor contract, saved 20% (notable)

### 4. Editing and deleting

**Edit:** "Change that win to major" or "update the last brag"

**Shell available:** Invoke `node tools/memory/brags.mjs edit <line-number> "<new-text>"` or `node tools/memory/brags.mjs set-size <line-number> <size>`.

**Delete:** "Delete that win" or "remove the last brag"

**Shell available:** Invoke `node tools/memory/brags.mjs delete <line-number>`.

**File tools:** Perform the same edits directly on `brags.md`.

### 5. Category management

**Create:** "Create a brag category called Volunteering"

**Shell available:** Invoke `node tools/memory/brags.mjs add-category "<name>" "<description>"`.

**File tools:** Read `categories.json`, append the new category, write back.

**Rename:** "Rename category Volunteering to Community"

**Shell available:** Invoke `node tools/memory/brags.mjs rename-category "<old>" "<new>"`. This updates `categories.json` and all entries in `brags.md`.

**Merge:** "Merge Health into Personal"

**Shell available:** Invoke `node tools/memory/brags.mjs merge-categories "<source>" "<target>"`. All entries from source category move to target, source category is removed.

### 6. Brag doc generation

When the user says "generate my brag doc" or "brag doc for Q1":

**Parse parameters:** Period/date range (`this quarter`, `2025`, `last 6 months`), category filter (optional), mode (default: `performance-review`).

**Two modes:**

1. **Performance-review mode** (default): Impact-framed, grouped by theme. Written for promotion packets, manager 1-on-1s, performance reviews. Emphasizes outcomes and scope.

2. **Personal-retrospective mode** (`--mode retrospective`): Chronological, celebratory tone. Written for personal reflection, year-end review, gratitude journaling.

**Shell available:** Invoke `node tools/memory/brags.mjs generate-doc [--since <date>] [--until <date>] [--category <name>] [--mode <performance-review|personal-retrospective>]`.

The script writes output to `user/brags/exports/brag-doc-<YYYY-MM-DD>.md`.

**File tools available, no shell:** Read `brags.md`, filter entries by date/category, format according to the mode, write to exports directory.

**Confirm:**

> Brag doc generated: `user/brags/exports/brag-doc-2026-03-31.md` (12 entries, performance-review mode)

### 7. Monthly check-in (cadence hook)

Offer (once) to schedule a monthly "any wins I missed?" check-in via WU-12 scheduler:

> Want me to check in monthly about wins? I'll ask what you accomplished that month and help log it.

If accepted, invoke `tools/schedule/register-task.sh` or `.ps1` with:
- Task name: `edwin-brag-checkin`
- Frequency: monthly, first day of month, 9am
- Prompt: "What wins did you have last month? I'll help log them."

If declined, tombstone the offer (never raise again).

## Optional script hooks

| Script | Purpose | Invocation |
|--------|---------|-----------|
| `tools/memory/brags.mjs` | Append, edit, delete entries; category CRUD; generate docs | `node tools/memory/brags.mjs <command> [args] [--dry-run] [--json]` |

Commands:
- `append "<entry>" [--context <ctx>] [--size <size>] [--category <cat>]` — add new win
- `edit <line> "<new-text>"` — update entry text
- `set-size <line> <size>` — update entry size
- `delete <line>` — remove entry
- `list [--category <name>] [--size <size>] [--since <date>]` — filter and display wins
- `add-category "<name>" "<description>"` — create category
- `rename-category "<old>" "<new>"` — rename category and update all entries
- `merge-categories "<source>" "<target>"` — merge source into target
- `generate-doc [--since <date>] [--until <date>] [--category <cat>] [--mode <mode>]` — generate brag doc

The script supports `--help`, `--dry-run`, and `--json`.

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| Shell | Invoke `brags.mjs` for all operations | Use file tools to read/write `user/brags/*.md` and `categories.json` directly |
| File tools | Read and write brag files directly | Print the entry and file path; user saves manually |

## Examples

### Example 1: Auto-detection (Sam, shell available)

**Context:** EDWIN notices Sam shipped a feature and got positive feedback.

**EDWIN:** _(at task completion)_
> I noticed a few wins:
> 1. Shipped the analytics dashboard — user engagement doubled
> 2. Manager said the incident response was "textbook"
>
> Log any of these?

**User:** Both

**EDWIN:** _(invokes `brags.mjs append` twice with auto-categorization)_
> Logged both under Work.

---

### Example 2: Explicit logging (Alex, file tools only)

**User:** Brag: finished the Rust course

**EDWIN:** _(reads categories.json, matches to "Learning", appends to brags.md)_
> Win logged under Learning (notable).

---

Additional examples (filtering, brag doc generation, category management, check-in cadence) are in [`reference/examples.md`](reference/examples.md).
