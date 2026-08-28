---
name: edwin-skill-creator
description: Turns a workflow breakdown or conversational request into a valid, installed EDWIN skill. Use when the user says "create a skill", "make me a skill for X", "turn this workflow into a skill", or "update my X skill". Handles generation, review, validation, and installation.
contexts: all
version: 1.0.0
requires: [tools/validate/edwin-doctor.mjs, tools/sync/engine.mjs]
author: edwin-core
---

# Skill Creator

## Purpose

Transform workflow breakdowns or direct user requests into executable EDWIN skills — from generation through validation to installation. The user never writes markdown unless they ask.

## When to use

- "Create a skill" / "Make me a skill for X" / "Turn this into a skill"
- "Create a skill from my [workflow-name] workflow"
- "Update my [skill-name] skill" / "Modify the [skill-name] skill"
- User has completed a workflow breakdown and is ready to generate the skill

Not for:
- Managing contexts (use `edwin-context`).
- Publishing skills to a repo (use `edwin-publish` after creation).
- Documenting workflows without turning them into skills (use `edwin-workflow-analyzer`).

## Instructions

### Mode detection

Determine which mode:

- **Breakdown mode:** User references a `user/workflows/<name>.md` file or says "create a skill from my X workflow".
- **Conversational mode:** User requests a skill directly without a breakdown ("make me a skill that drafts thank-you notes").
- **Update mode:** User wants to modify an existing skill ("update my weekly-backup skill").

### Breakdown mode

**Context:** A workflow breakdown exists in `user/workflows/<name>.md`.

1. **Read the breakdown file.** If `user/workflows/` doesn't exist or the file is missing, inform the user:
   
   > No breakdown found for `<name>`. Want to create the skill conversationally instead?
   
   If the file exists, extract frontmatter (`name`, `proposedDescription`, `proposedContexts`) and workflow sections. Mapping to skill structure is detailed in `reference/template-guide.md`.

2. **Generate the skill** using `core/templates/skill.md.tmpl`:
   - Map breakdown sections to template fields per `reference/template-guide.md`
   - Confirm contexts with user: "I'll tag this as [contexts]. Right?"
   - `version` is always `1.0.0` for new skills; `author` is always `user`
   - `degradation` and `examples` are required sections — see conventions §3

3. **Review loop (plain language).**

   Present the skill in plain language:

   > Here's the skill:
   >
   > **What it does:** [purpose in one sentence]
   >
   > **When it triggers:** [trigger phrases from "When I use it"]
   >
   > **The steps it follows:** [brief summary of instructions, not the raw numbered list]
   >
   > **Sample run:**
   > [Shortened example dialogue showing EDWIN using this skill]
   >
   > Look right, or anything to change?

   **Do not show the raw markdown** unless the user asks ("show me the file").

   If the user requests changes:
   - Parse the change in plain language ("make it always ask before sending" → add a confirmation step to instructions).
   - Apply the change to the generated `SKILL.md`.
   - Re-present the changed section in plain language.
   - Confirm: "Updated. Anything else?"
   - Loop until approved.

4. **Validate.** Run `node tools/validate/edwin-doctor.mjs --skill <path> --json` if shell available. Fix errors automatically (missing sections, invalid frontmatter, description length) and re-run until `"ok": true`. Without shell, self-check per conventions §3 (required frontmatter keys, body sections, trigger phrases in description).

5. **Install.**

   Confirm installation:

   > Ready to install. This will create `core/skills/{{name}}/` and sync it to your harnesses.

   **Shell available:**
   1. Create directory: `mkdir -p core/skills/{{name}}`
   2. Write the `SKILL.md` file to `core/skills/{{name}}/SKILL.md`
   3. Run sync engine: `node tools/sync/engine.mjs`
   4. Report: "Skill installed: **{{name}}**. It's live now — try saying '[trigger phrase]'."

   **File tools available, no shell:**
   1. Write the `SKILL.md` file to `core/skills/{{name}}/SKILL.md`
   2. Tell the user to run the sync engine manually:
      > Skill file written. Run `node tools/sync/engine.mjs` to sync it to your harnesses.

   **No file tools (web portal):**
   > Shell unavailable. Save this file as `core/skills/{{name}}/SKILL.md`:
   >
   > ```markdown
   > [full SKILL.md content]
   > ```
   >
   > Then run `node tools/sync/engine.mjs` to install it.

### Conversational mode

**Context:** No breakdown exists. User described a task they want a skill for.

1. **Run an abbreviated workflow interview** inline (from `edwin-workflow-analyzer`):

   > I'll ask a few questions to get this right.
   >
   > 1. What does this workflow accomplish — what's the end result?
   > 2. When would you use it? What exact words would you say?
   > 3. What do you need before you start?

   Then:

   > 4. Walk me through the steps — what happens first, second, third?
   > 5. Any decision points or variations?

   **Keep it proportional.** If the user describes a simple 3-step task, skip edge-case questions. If complex, add:

   > 6. What tools or systems does this touch?
   > 7. How do you know it worked?

2. **Confirm the workflow** in plain language:

   > So: you [goal], triggered by [phrases], starting with [inputs], then [steps], producing [outputs]. Right?

3. **Propose context assignment:**

   > I'll tag this as [active context]. Want it somewhere else?

   Wait for confirmation.

4. **Generate the skill** as in breakdown mode, using the interview answers to populate the template fields.

5. **Continue from step 3 of breakdown mode** (review loop, validation, installation).

### Update mode

**Context:** User wants to modify an existing skill.

1. **Read the existing skill** from `core/skills/<name>/SKILL.md`.

2. **Ask what changed:**

   > What needs updating — new steps, different triggers, something to adjust?

3. **Apply changes** based on the user's plain-language request:
   - "Make it always ask before sending" → add a confirmation step in `## Instructions`.
   - "Add Slack as a trigger" → append to `## When to use` and ensure it's in the `description`.
   - "Support email attachments" → add to instructions and note in purpose if substantive.

4. **Bump the version:**
   - Patch (x.y.Z) for wording changes or minor clarifications.
   - Minor (x.Y.0) for new steps or expanded scope.
   - Major (X.0.0) for changed triggers or removed capabilities.

   Preserve the user's prior customizations — never regenerate from scratch unless explicitly asked to "rewrite the skill".

5. **Re-validate** (same as step 4 of breakdown mode).

6. **Re-sync:**

   **Shell available:** Overwrite `core/skills/<name>/SKILL.md`, then run `node tools/sync/engine.mjs`.

   **File tools available, no shell:** Overwrite the file, tell user to sync manually.

   **No file tools:** Print the updated markdown.

7. **Report:**

   > Updated **{{name}}** to v{{new-version}}.

## Optional script hooks

| Script | Purpose | Invocation |
|--------|---------|-----------|
| `tools/validate/edwin-doctor.mjs` | Validates skill structure and catches common errors | `node tools/validate/edwin-doctor.mjs --skill <path> --json` |
| `tools/sync/engine.mjs` | Installs skills into target harnesses | `node tools/sync/engine.mjs` |

Both scripts support `--help` and `--dry-run`.

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| Shell | Run `edwin-doctor` for validation and `engine.mjs` for installation | Self-check against conventions; write skill file with file tools and instruct user to sync manually |
| File tools | Write skill files directly to `core/skills/<name>/` | Print the full `SKILL.md` content and file path for user to save manually |
| `edwin-doctor` | Validate automatically and fix errors in a loop | Self-check frontmatter and body structure per conventions §3; flag likely issues but proceed |

## Examples

### Example 1: Breakdown mode (Alex, Windows)

**User:** Create a skill from my weekly-backup workflow

**EDWIN:** _(reads user/workflows/weekly-backup.md)_
> Here's the skill:
>
> **What it does:** Backs up the database weekly by exporting, compressing, and uploading to S3.
>
> **When it triggers:** "run the backup", "back up the database", "run the S3 backup"
>
> **The steps it follows:** Check for DB credentials and S3 bucket name → export database → compress dump → upload to S3 → confirm success.
>
> **Sample run:**
>
> **User:** Run the backup
>
> **EDWIN:** Bucket name?
>
> **User:** prod-backups
>
> **EDWIN:** _(exports, compresses, uploads)_ Done. Uploaded 42MB to `prod-backups/backup-2026-08-26.sql.gz`.
>
> I'll tag this as **Work**. Right?

**User:** Yes

**EDWIN:** _(validates, installs)_
> Skill installed: **weekly-backup**. It's live now — try saying "run the backup".

### Example 2: Update mode (Alex, modifying an existing skill)

**User:** Update my weekly-backup skill

**EDWIN:** _(reads core/skills/weekly-backup/SKILL.md)_
> What needs updating?

**User:** Add a Slack notification at the end to confirm it ran

**EDWIN:**
> I see you've added: post a Slack message after the upload completes. Should it always notify, or only on success?

**User:** Only on success.

**EDWIN:** _(edits `## Instructions` to add step: "If upload succeeds, post confirmation to Slack channel")_
_(bumps version to 1.1.0)_
_(re-validates)_
> Updated **weekly-backup** to v1.1.0.

---

Additional examples (conversational mode, review loops) are in `reference/examples.md`.
