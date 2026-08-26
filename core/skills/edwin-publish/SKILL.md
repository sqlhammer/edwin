---
name: edwin-publish
description: Publishes EDWIN skills to the user's repository. Use when the user says "publish skills", "push edwin", "sync skills to my repo", or wants to commit and push their skill changes to their configured git repository.
contexts: all
version: 1.0.0
requires: [shell]
author: edwin-core
---

# EDWIN Publish

## Purpose

Commit and push EDWIN skill changes to the user's configured git repository, then sync skills to local `.claude/SKILLS` directories (if sync script available).

## When to use

- "Publish skills" / "Push EDWIN" / "Sync skills to my repo"
- User wants to commit and push their skill changes
- "Publish my changes" / "Push to git"

Not for:
- General git operations (use git directly or via bash)
- Publishing to a marketplace (different process)

## Instructions

### 1. Check configuration

Read `user/config.json` for `publish.remote` and `publish.branch`:

**If `publish.remote` is empty or missing:**

> I need to know where to push. What's your git remote for EDWIN? (e.g., `origin` or `git@github.com:yourusername/edwin-fork.git`)

Wait for their answer. Offer to save it:

> Want me to save `[remote]` to your config so I remember it next time?

If yes, write it to `user/config.json` under `publish.remote`.

**If `publish.branch` is empty:**
Default to `main`.

### 2. Detect RTK

Check whether `rtk` is available:

```bash
rtk --version 2>/dev/null || echo "rtk not found"
```

- If `rtk` is found: prefix all subsequent git commands with `rtk` (e.g., `rtk git add ...`)
- If `rtk` is not found: use plain `git` commands

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

### 5. Commit

```bash
git commit -m "<message>"
```

### 6. Push

```bash
git push [remote] [branch]
```

Use the remote and branch from `user/config.json`.

### 7. Sync skills locally (optional)

If `tools/Sync-EdwinSkills.ps1` exists, offer to run it:

> Local sync script detected. Run it to copy skills to `.claude/SKILLS` directories?

If yes:

```bash
powershell -ExecutionPolicy Bypass -NoProfile -File "tools/Sync-EdwinSkills.ps1"
```

If PowerShell is not available on this device, inform the user and instruct them to run `Sync-EdwinSkills.ps1` manually once PowerShell is available.

### 8. Confirm

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

### Example 2: Configured remote (Sam, macOS, no sync script)

**User:** Push to git with message "Fix briefing examples"

**EDWIN:** _(reads user/config.json, finds `publish.remote: "origin"`)_
_(stages files, shows git status, commits, pushes)_
> Committed: `f7e22a8` "Fix briefing examples"
> Pushed to origin/main
>
> No local sync script found. Skills are pushed to git but not synced to `.claude/SKILLS` directories.

### Example 3: No shell available (web portal)

**User:** Publish skills

**EDWIN:**
> Shell unavailable. Run these commands manually:
>
> ```bash
> git add core/skills/ tools/sync/ package.json bin/
> git status  # review what's staged
> git commit -m "Your commit message here"
> git push origin main
> ```
>
> Replace `origin` with your remote and `main` with your branch if different. Your config shows: `publish.remote: origin`, `publish.branch: main`.
