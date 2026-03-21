---
name: publish-edwin-skills
description: Commits and pushes the edwin repo, then syncs all SKILLS to both .claude/SKILLS directories via Sync-EdwinSkills.ps1.
---

You are executing the **publish-edwin-skills** workflow. Follow these steps precisely, in order.

## Workflow

### Step 1 — Detect RTK

Check whether `rtk` is available:

```bash
rtk --version 2>/dev/null || echo "rtk not found"
```

- If `rtk` is found: prefix all subsequent git commands with `rtk` (e.g., `rtk git add ...`)
- If `rtk` is not found: use plain `git` commands

### Step 2 — Stage skill files

Stage the SKILLS directory and the sync script:

```bash
git add SKILLS/ Sync-EdwinSkills.ps1
```

Show the user what is staged (`git status`) so they can confirm before committing.

### Step 3 — Commit message

If the user provided a commit message as an argument, use it directly.

If no message was provided, ask the user for one now. Wait for their reply before proceeding.

### Step 4 — Commit

```bash
git commit -m "<message>"
```

### Step 5 — Push

```bash
git push
```

### Step 6 — Sync skills locally

Run the PowerShell sync script from the repo root:

```bash
powershell -ExecutionPolicy Bypass -NoProfile -File "Sync-EdwinSkills.ps1"
```

If PowerShell is not available on this device, inform the user and instruct them to run `Sync-EdwinSkills.ps1` manually once PowerShell is available.

### Step 7 — Confirm

Report:
- Commit hash and message
- Push status
- Which skills were copied and to which destinations (from script output)

## Notes

- **RTK fallback:** Always prefer `rtk git` when available; fall back to `git` silently if not.
- **Scope:** Only stage `SKILLS/` and `Sync-EdwinSkills.ps1`. Do not stage unrelated files without explicit user instruction.
- **Commit message:** Never invent a commit message. Always use what the user provides or explicitly ask.
