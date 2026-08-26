---
name: edwin-export
description: Exports EDWIN persona and skills for web portals (claude.ai, Gemini, Copilot). Use when the user says "export my Work context for claude.ai", "create a Gemini bundle", "make EDWIN work in Copilot", or asks to use EDWIN in a browser-based AI.
contexts: all
version: 1.0.0
requires: [tools/bundle/build-bundle.mjs]
author: edwin-core
---

# EDWIN Export

## Purpose

Generate paste-able bundles of EDWIN persona + context skills for browser-based AI portals where Claude Code/Desktop are unavailable.

## When to use

- "Export my Work context for claude.ai" / "Create a Gemini Gems bundle"
- "Make EDWIN work in Copilot" / "I want to use EDWIN in the browser"
- "Generate a portable EDWIN bundle" / "Export for web portals"

Not for:
- Installing locally (use sync engine or setup skill)
- Publishing to the plugin marketplace (different tool)

## Instructions

### 1. Confirm details

When the user requests an export, confirm three things if not specified:

1. **Context:** Which context to export (Work, Home, Global, etc.)
2. **Portal:** Target portal (claude.ai, gemini, copilot, or all)
3. **Personal data:** Whether to include memory digest and/or achievements

Ask concisely:

> Exporting for which context and portal? Include memory/achievements? (off by default)

**Defaults:**
- Context: active context from `user/state.json`, or Global if unset
- Portal: whichever was mentioned, or ask
- Personal data: off unless explicitly requested

### 2. Generate bundle

**Shell available:** Invoke the generator:

```
node tools/bundle/build-bundle.mjs --context <name> --portal <name> [--include-memory] [--include-brags]
```

**File tools available, no shell:** State that export requires shell access and print the command the user should run.

**Neither:** State that export is unavailable in this environment.

### 3. Report results

When the generator succeeds, report:

> ✓ Bundle generated: `dist/bundles/<portal>/<context>/`
>
> **Instructions:** `instructions.txt` (<size> chars, limit <limit>)
> **Knowledge files:** <count> (if portal supports them)
>
> **Next steps:**
> 1. Open <portal> and create/edit your EDWIN project
> 2. Paste `instructions.txt` into custom instructions
> 3. (If knowledge files) Upload files from `knowledge/` directory

If the bundle was truncated:

> ⚠️ Bundle exceeded <portal> character limit. See `TRUNCATION_MANIFEST.md` for removed skills.
>
> **To fit:** export a narrower context or disable personal data.

If personal data was included, remind:

> ⚠️ Personal data included. Paste only into your own account.

### 4. Multiple portals

When `--portal all` is used, report each portal's bundle separately with its size and status.

### 5. Staleness checking

If the user says "refresh my bundles" or "regenerate stale exports", invoke with `--diff`:

```
node tools/bundle/build-bundle.mjs --context <name> --portal all --diff
```

This regenerates only changed bundles and prints re-paste steps per portal.

## Optional script hooks

| Script | Purpose | Invocation |
|--------|---------|-----------|
| `tools/bundle/build-bundle.mjs` | Generates web portal bundles with persona + skills, applies degradation rewrites, enforces character limits | `node tools/bundle/build-bundle.mjs --context <name> --portal <name> [--include-memory] [--include-brags] [--diff] [--dry-run] [--json]` |

Flags:
- `--context <name|Global>`: Context to export (required)
- `--portal <claude|gemini|copilot|all>`: Target portal (required)
- `--include-memory`: Append memory digest
- `--include-brags`: Append achievements
- `--diff`: Report and regenerate only stale bundles
- `--dry-run`: Show what would be generated
- `--json`: JSON output

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| Shell | Invoke `build-bundle.mjs` to generate bundles | Print the exact command for the user to run, with clear instructions on where the output will appear |
| File tools | Read the generated bundle and report its contents | State that export is unavailable without file or shell access |

## Examples

### Example 1: Exporting Work context for Claude Projects (Alex, shell available)

**User:** Export my Work context for claude.ai

**EDWIN:** _(invokes `node tools/bundle/build-bundle.mjs --context Work --portal claude`)_
> ✓ Bundle generated: `dist/bundles/claude/Work/`
>
> **Instructions:** `instructions.txt` (18,432 chars, limit 50,000)
> **Knowledge files:** 12
>
> **Next steps:**
> 1. Open claude.ai Projects and create a new project called "EDWIN Work"
> 2. Paste `instructions.txt` into custom instructions
> 3. Upload files from `knowledge/` directory to Project knowledge

### Example 2: Exporting with personal data (Sam, shell available)

**User:** Export Global for Gemini, include my memory

**EDWIN:**
> Include achievements too?

**User:** No, just memory

**EDWIN:** _(invokes `node tools/bundle/build-bundle.mjs --context Global --portal gemini --include-memory`)_
> ✓ Bundle generated: `dist/bundles/gemini/Global/`
>
> **Instructions:** `instructions.txt` (22,104 chars, limit 20,000)
>
> ⚠️ Bundle exceeded gemini character limit. See `TRUNCATION_MANIFEST.md` for removed skills.
>
> **To fit:** export a narrower context or disable personal data.
>
> ⚠️ Personal data included. Paste only into your own account.

### Example 3: Export all portals (Alex, shell available)

**User:** Generate bundles for all portals, Home context

**EDWIN:** _(invokes `node tools/bundle/build-bundle.mjs --context Home --portal all`)_
> ✓ claude:Home — 14,221 / 50,000 chars, 8 knowledge files
> ✓ gemini:Home — 14,221 / 20,000 chars
> ✓ copilot:Home — 9,876 / 10,000 chars
>
> Bundles in `dist/bundles/*/Home/`

### Example 4: No shell access (Sam, file tools only)

**User:** Export Work for claude.ai

**EDWIN:**
> Export requires shell access. Run this command:
>
> ```
> node tools/bundle/build-bundle.mjs --context Work --portal claude
> ```
>
> Output will be in `dist/bundles/claude/Work/`.

### Example 5: Regenerate stale bundles (Alex, shell available)

**User:** Refresh my bundles after editing skills

**EDWIN:** _(invokes `node tools/bundle/build-bundle.mjs --context Work --portal all --diff`)_
> Stale bundles regenerated:
> - claude:Work
>
> Re-paste steps:
>
> ### claude:Work
> 1. Open claude and navigate to your EDWIN Work configuration
> 2. Paste contents of: dist/bundles/claude/Work/instructions.txt
> 3. Upload files from: dist/bundles/claude/Work/knowledge/
