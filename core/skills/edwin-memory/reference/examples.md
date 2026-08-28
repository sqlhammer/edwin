# Extended Examples for Memory System

## Explicit memory (Sam, file tools only)

**User:** Remember that I hate bullet points in reports

**EDWIN:** _(reads memory.md, appends to Dislikes section, writes file)_
> Remembered: Never use bullet points in reports

## Recalling memory (Alex, shell available)

**User:** What do you remember about me?

**EDWIN:** _(invokes `memory.mjs list`)_
> Here's what I remember:
>
> **Preferences:**
> - Hyper-concise responses
> - Verbosity: concise
>
> **People:**
> - Name: Alex, addressed as Alex
>
> **Facts:**
> - Primary contexts: Work, Home
> - Uses VS Code
>
> **Dislikes:**
> - Bullet points in reports

## Forgetting (Sam, shell available)

**User:** Forget that I use VS Code

**EDWIN:** _(invokes `memory.mjs tombstone "VS Code"`)_
> Forgotten: Uses VS Code as primary editor

## Consolidation (Alex, shell available, monthly)

**EDWIN:**
> Time for a memory tidy?

**User:** Yes

**EDWIN:** _(invokes `memory.mjs list`, scans for duplicates and stale entries)_
> I see two similar entries: "Prefers concise" and "Verbosity: concise". Merge them?

**User:** Yes, keep the second one

**EDWIN:** _(edits memory.md, removes duplicate)_
_(invokes `memory.mjs regenerate-digest`)_
_(invokes `engine.mjs` to sync)_
> Memory tidied. Digest regenerated with 12 entries (48 lines).

## First-time explanation (Sam, file tools available)

**Context:** No memory.md exists. Hook fires for the first time.

**EDWIN:**
> I can remember things about you across sessions — preferences, people, patterns. I'll confirm before storing anything, and you can forget items anytime.
>
> I noticed:
> 1. Name: Sam, addressed as Sam
> 2. Primary contexts: Work, Home
>
> Want me to remember these?

**User:** Yes

**EDWIN:** _(initializes memory.md from template, appends entries)_
> Remembered both.

## Privacy refusal (Alex)

**User:** Remember my GitHub token: ghp_abc123

**EDWIN:**
> I never store credentials or secrets. If you need to recall it later, save it in a secure credential manager.

## Tombstone prevents re-proposal (Sam)

**Context:** User previously rejected "Uses Vim keybindings". EDWIN observes it again.

**EDWIN:** _(checks tombstones, finds match, remains silent)_

_(Later, at task completion, proposes other candidates but NOT the tombstoned one)_
