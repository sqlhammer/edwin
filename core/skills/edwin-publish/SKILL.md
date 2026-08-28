---
name: edwin-publish
description: Publishes EDWIN skills to the user's repository. Use when the user says "publish skills", "push edwin", "sync skills to my repo", or wants to commit and push their skill changes to their configured git repository. Also publishes user-created skills to the user's own repo when requested.
contexts: all
version: 1.1.0
requires: [shell]
author: edwin-core
---

# EDWIN Publish

## Purpose

Commit and push EDWIN skill changes to the user's configured git repository, then sync skills to local `.claude/SKILLS` directories (if sync script available). Also supports publishing user-created skills to a separate user-owned repository.

## When to use

- "Publish skills" / "Push EDWIN" / "Sync skills to my repo"
- User wants to commit and push their skill changes to the EDWIN repo
- "Publish my changes" / "Push to git"
- "Publish my [skill-name] skill to my repo" (user-created skills)

Not for:
- General git operations (use git directly or via bash)
- Publishing to a marketplace (different process)
- First-time setup (that's `edwin-setup`)

## Instructions

### Detect scope

Determine what the user wants to publish:

- **EDWIN framework changes:** "publish skills", "push edwin", "sync skills to my repo" (no specific skill named)
- **User-created skill:** "publish my [skill-name] skill", "push my thank-you-drafter skill to my repo"

If unclear, ask:

> Publish framework changes, or a specific skill to your own repo?

### For EDWIN framework changes

Follow steps 1-8 below.

### For user-created skills

**Context:** User has created a skill with `author: user` in frontmatter and wants to publish it to their own repository (not the EDWIN framework repo).

1. **Check the skill exists** in `core/skills/<name>/SKILL.md` and verify `author: user` in frontmatter.

2. **Ask for destination:**

   > Where should I push this? Your repo URL or remote name.

   If they've set `publish.remote` in `user/config.json`, offer it as default:

   > I have `[remote]` saved. Use that, or somewhere else?

3. **Stage and show what's staged:**

   ```bash
   git add core/skills/<skill-name>/
   git status
   ```

   Ask for commit message:

   > Commit message for this skill?

   Default suggestion: `Add <skill-name> skill`

4. **Confirm push:**

   > Ready to push "[message]" to [remote]/[branch]?

   Wait for confirmation.

5. **Commit and push:**

   ```bash
   git commit -m "<message>"
   git push [remote] [branch]
   ```

   Report the result.

6. **Sync locally (optional)** — same as step 6 below (framework changes).

Return to normal instructions for framework-wide publishing below:

---

### 1. Check configuration

Read `user/config.json` for `publish.remote` and `publish.branch`. If `publish.remote` is empty, ask:

> I need to know where to push. What's your git remote for EDWIN?

Offer to save it: "Want me to save `[remote]` to your config?" If yes, write to `user/config.json`. Default `publish.branch` to `main` if empty.

### 2. Detect RTK

Check `rtk --version 2>/dev/null`. If found, prefix all git commands with `rtk` (e.g., `rtk git add`). Otherwise use plain `git`.

### 3. Stage skill files

Stage the skills directory and related files:

```bash
git add core/skills/ tools/sync/ package.json bin/
```

Show the user what is staged (`git status`) so they can confirm before committing.

### 4. Commit message

If the user provided a commit message as an argument, use it directly.

If no message was provided, ask:

> What's the commit message?

Wait for their reply before proceeding.

### 5. Confirm and push

Confirm before pushing:

> Ready to push "[message]" to [remote]/[branch]?

Wait for confirmation, then commit and push:

```bash
git commit -m "<message>"
git push [remote] [branch]
```

Use the remote and branch from `user/config.json`.

### 6. Sync skills locally (optional)

If `tools/Sync-EdwinSkills.ps1` exists, offer: "Local sync script detected. Run it?" If yes, execute via `powershell -ExecutionPolicy Bypass -NoProfile -File "tools/Sync-EdwinSkills.ps1"`. If PowerShell unavailable, inform user to run manually.

### 7. Confirm

Report:
- Commit hash and message
- Push status (remote and branch)
- Which skills were copied and to which destinations (from script output, if run)

## Optional script hooks

| Script | Purpose | Invocation |
|--------|---------|-----------|
| `tools/Sync-EdwinSkills.ps1` | Copies skills to local `.claude/SKILLS` directories | `powershell -ExecutionPolicy Bypass -NoProfile -File "tools/Sync-EdwinSkills.ps1"` |

Optional. If not present, skills are pushed to git but not synced locally.

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| Shell | Execute git commands and sync script | Print exact commands for user to run manually |
| File tools | Read and write `user/config.json` for remote/branch | Ask user for remote/branch each session |

## Examples

### Example 1: First-time publish (Alex, Windows)

**User:** Publish skills

**EDWIN:** _(reads user/config.json, finds `publish.remote: ""`)_
> I need to know where to push. What's your git remote for EDWIN? (e.g., `origin` or `git@github.com:yourusername/edwin-fork.git`)

**User:** origin

**EDWIN:**
> Want me to save `origin` to your config so I remember it next time?

**User:** Yes

**EDWIN:** _(writes to user/config.json)_
_(stages files, shows git status)_
> Staged: core/skills/, tools/sync/, package.json, bin/
>
> What's the commit message?

**User:** Add new analyst skill

**EDWIN:**
> Ready to push "Add new analyst skill" to origin/main?

**User:** Yes

**EDWIN:** _(commits and pushes)_
> Committed: `a8f32b1` "Add new analyst skill"
> Pushed to origin/main
>
> Local sync script detected. Run it to copy skills to `.claude/SKILLS` directories?

**User:** Yes

**EDWIN:** _(runs Sync-EdwinSkills.ps1)_
> Synced 15 skills to:
> - [home]/.claude/SKILLS
> - [repo]/.claude/SKILLS

### Example 2: Publishing a user-created skill (Alex)

**User:** Publish my thank-you-drafter skill to my repo

**EDWIN:** _(checks core/skills/thank-you-drafter/SKILL.md, verifies author: user)_
> Where should I push this? Your repo URL or remote name.

**User:** origin

**EDWIN:** _(stages, shows git status)_
> Staged: core/skills/thank-you-drafter/
>
> Commit message for this skill?

**User:** Add thank-you note drafter skill

**EDWIN:**
> Ready to push "Add thank-you note drafter skill" to origin/main?

**User:** Yes

**EDWIN:** _(commits and pushes)_
> Committed: `d3a19f2` "Add thank-you note drafter skill"
> Pushed to origin/main

---

Additional examples (configured remote, degradation cases, sync variations) are in `reference/examples.md`.
