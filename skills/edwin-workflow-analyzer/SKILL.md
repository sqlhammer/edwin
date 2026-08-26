---
name: edwin-workflow-analyzer
description: Learns the user's recurring workflows by observation or interview, producing a structured breakdown that can be turned into a skill. Triggers when EDWIN notices a repeated multi-step task, or when the user says "learn how I do X", "watch how I do this", or "analyze my workflow".
contexts: all
version: 1.0.0
requires: []
author: edwin-core
---

# Workflow Analyzer

## Purpose

Capture the user's recurring workflows — what they do repeatedly, how they do it, and when — as structured breakdowns that the skill creator can turn into executable skills. Eliminates the need to hand-write methodology; the user describes it once, EDWIN documents it.

## When to use

- EDWIN notices the user has performed the same multi-step task twice in a session (triggered by the `workflow-observation` hook).
- User says "learn how I do X", "watch how I do this", "analyze this workflow", or "turn this into a skill".
- User wants to update an existing workflow breakdown: "update my weekly report workflow".

Not for:
- Single-step tasks (no workflow to capture).
- One-off exploratory work (workflows are repeatable by definition).

## Instructions

### Mode detection

Determine which mode to use:
- **Observation mode:** The hook fired because EDWIN watched the user perform a task twice. The conversation already contains most of what is needed.
- **Interview mode:** The user requested workflow learning directly without prior observation.
- **Update mode:** The user named an existing `user/workflows/<name>.md` file to revise.

### Observation mode

**Context:** You watched the user perform a task at least twice. Much of the workflow is already visible in the current conversation.

1. **Re-read the conversation.** Identify:
   - The goal (what they accomplished)
   - The steps they took (commands, questions, tools used)
   - Inputs they provided
   - Outputs produced
   - Any decision points or variations

2. **Play back what you observed** in plain language, framed as a confirmation:

   > I saw you do this twice: [brief summary of the workflow]. Is that the pattern?

3. **Ask only about gaps** — things the observation did not reveal. Batch 2–3 questions:

   > A few questions:
   > 1. What would you call this workflow?
   > 2. When else do you use it? Any other trigger phrases?
   > 3. [Any specific gap from observation — e.g., "I saw you check the log file — is that always part of it, or just when X?"]

4. **Confirm the breakdown.** Play the completed workflow back in the user's own words and ask if it is right. Do not use framework vocabulary ("inputs and outputs") unless the user did.

5. **Write the breakdown** to `user/workflows/<kebab-case-name>.md` using the `core/templates/workflow-breakdown.md` format.

### Interview mode

**Context:** No prior observation. The user described a recurring task or asked EDWIN to learn a workflow.

1. **Frame the interview:**

   > I'll walk through this with you so I can document it properly. Should take 2–3 exchanges.

2. **Batch the questions.** Two or three at a time, never one-at-a-time interrogation:

   > 1. What does this workflow accomplish — what's the end result?
   > 2. When do you use it? What are the exact words you'd say when you need this?
   > 3. What do you need in front of you before you start?

   Then:

   > 4. Walk me through the steps — what do you do first, second, third?
   > 5. Are there any decision points or variations? ("If X, then Y")
   > 6. What tools or systems do you touch?

   Finally:

   > 7. What does success look like? How do you know it worked?
   > 8. What can go wrong, and how do you handle it?

3. **Adapt to complexity.** If the user's first answer reveals a simple three-step workflow, skip the exception-handling question. If they describe a complex branching process, add a follow-up about edge cases. Keep the interview proportional to what you are learning.

4. **Avoid framework jargon.** Never ask "what are the inputs and outputs of your workflow" — ask "what do you need before you start" and "what does it produce". Speak the user's language.

5. **Confirm the breakdown.** Play the workflow back in the user's own words:

   > So: you [goal], triggered by [phrases], starting with [inputs], then [steps], producing [outputs]. Right?

6. **Write the breakdown** to `user/workflows/<kebab-case-name>.md` using the `core/templates/workflow-breakdown.md` format.

### Update mode

**Context:** The user wants to revise an existing workflow breakdown.

1. **Read the existing breakdown** from `user/workflows/<name>.md`.

2. **Ask what changed:**

   > What's different now — new steps, different triggers, something you want to adjust?

3. **Propose the changes** in plain language, not as raw diffs:

   > I see you've added a step: [new step]. Should I drop the old step 3, or keep both?

4. **Confirm before writing:**

   > Updated: [summary of changes]. Overwrite the old version?

5. **Bump the workflow's revision.** If the breakdown does not track versions, note in a comment at the top when it was last updated.

### Writing the breakdown

Use the format in `core/templates/workflow-breakdown.md`. Fill all required sections; omit optional sections if the user did not provide that information. Write in the user's voice — if they said "check the logs", write "check the logs", not "review system diagnostics".

**File path:** `user/workflows/<kebab-case-name>.md`

**Execution:**
- **File tools available:** Write the file directly.
- **No file tools (web portal):** Print the markdown with clear instructions:

  > Here's your workflow breakdown. Save it as `user/workflows/<name>.md`:
  >
  > ```markdown
  > [full content]
  > ```

### After writing

Confirm completion:

> Workflow documented. When you're ready, I can turn this into a skill — just say "create a skill from my [name] workflow".

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| File tools | Write the breakdown file directly to `user/workflows/` | Print the full markdown content with the file path; user saves it manually |

No scripts required. This skill is pure instruction.

## Examples

### Example 1: Observation mode (Alex, repeated task)

**Context:** Alex has run a two-step backup command twice. The hook fires.

**EDWIN:**
> You've done that twice now. Want me to learn it as a skill?

**User:** Yeah, I do this every week.

**EDWIN:**
> I saw you do this twice: export the database, compress it, and upload to S3. Is that the pattern?

**User:** Exactly.

**EDWIN:**
> A few questions:
> 1. What should I call this?
> 2. Any other times you'd say it, besides "run the backup"?
> 3. Do you always compress, or only when the dump is large?

**User:** Call it "weekly-backup". I'd also say "back up the database" or "run the S3 backup". Always compress it.

**EDWIN:**
> So: you back up the database weekly, triggered by "run the backup" or "back up the database", starting with the DB credentials and S3 bucket name, then export → compress → upload. Right?

**User:** Yep.

**EDWIN:** _(writes user/workflows/weekly-backup.md)_
> Workflow documented. When you're ready, I can turn this into a skill — just say "create a skill from my weekly-backup workflow".

### Example 2: Interview mode (Sam, no prior observation)

**User:** Learn how I write my monthly report.

**EDWIN:**
> I'll walk through this with you so I can document it properly. Should take 2–3 exchanges.
>
> 1. What does this workflow accomplish — what's the end result?
> 2. When do you use it? What are the exact words you'd say when you need this?
> 3. What do you need in front of you before you start?

**User:** It's a summary of the month's key metrics and team notes. I do it the first of every month. I'd say "draft the monthly report" or "time for the monthly update". I need last month's ticket count, revenue numbers, and my 1:1 notes.

**EDWIN:**
> 4. Walk me through the steps — what do you do first, second, third?
> 5. Are there any decision points or variations?

**User:** Pull the ticket count from the tracker, grab revenue from the finance sheet, scan my 1:1 notes for themes. Then I write: key metrics section, team highlights, and any blockers. If revenue dropped, I add a note about why. Otherwise I skip it.

**EDWIN:**
> 6. What does success look like? How do you know it worked?

**User:** The report is clear, the numbers match the source, and I didn't miss any major team event.

**EDWIN:**
> So: you draft a monthly report at the start of each month, triggered by "draft the monthly report" or "time for the monthly update", starting with ticket counts, revenue, and 1:1 notes, then pull metrics → highlight themes → note blockers, with a conditional revenue explanation. Right?

**User:** Right.

**EDWIN:** _(writes user/workflows/monthly-report.md)_
> Workflow documented. When you're ready, I can turn this into a skill.

### Example 3: Update mode (Alex, revising an existing workflow)

**User:** Update my weekly-backup workflow.

**EDWIN:** _(reads user/workflows/weekly-backup.md)_
> What's different now — new steps, different triggers, something you want to adjust?

**User:** I added a Slack notification at the end to confirm it ran.

**EDWIN:**
> I see you've added a step: post a Slack message after the upload completes. Where does it go — after the S3 upload, or as a final verification step?

**User:** After the upload. If the upload fails, skip the Slack message.

**EDWIN:**
> Updated: step 4 is now "If upload succeeds, post confirmation to #backups on Slack". Overwrite the old version?

**User:** Yes.

**EDWIN:** _(updates user/workflows/weekly-backup.md)_
> Workflow updated.
