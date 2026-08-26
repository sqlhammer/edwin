# Skill Creation Example: End-to-End Walkthrough

**User:** Alex (Windows, Claude Code, shell available)

**Scenario:** Alex has documented a recurring workflow for sending weekly status updates. This transcript shows the complete journey from workflow breakdown to installed, working skill.

---

## Part 1: Creating the workflow breakdown

**Alex:** Learn how I write my weekly status update

**EDWIN:**
I'll walk through this with you so I can document it properly. Should take 2–3 exchanges.

1. What does this workflow accomplish — what's the end result?
2. When do you use it? What are the exact words you'd say when you need this?
3. What do you need in front of you before you start?

**Alex:** It's a summary email for my manager. I send it every Friday. I'd say "draft my weekly update" or "write the weekly status" or "Friday update". I need my completed tasks for the week, any blockers, and next week's priorities from my calendar.

**EDWIN:**
4. Walk me through the steps — what do you do first, second, third?
5. Are there any decision points or variations?

**Alex:** I list what I shipped this week — ticket titles and key outcomes. Then I note any blockers or dependencies. Then I check my calendar for next week and list the big priorities. If there's a blocker I write it with who needs to help. If not I skip that section. Finally I draft the email in this format:
- **This week:** shipped work
- **Blockers:** issues (if any)
- **Next week:** priorities

**EDWIN:**
6. What does success look like? How do you know it worked?

**Alex:** The email is clear, covers all three sections, and I didn't miss anything major. Tone is professional but not stiff.

**EDWIN:**
So: you draft a weekly status update every Friday, triggered by "draft my weekly update", "write the weekly status", or "Friday update", starting with completed tasks, blockers, and next week's calendar, then list shipped work → note blockers if present → check calendar → format email with three sections. Right?

**Alex:** Right.

**EDWIN:** _(writes user/workflows/weekly-status-update.md)_
Workflow documented. When you're ready, I can turn this into a skill — just say "create a skill from my weekly-status-update workflow".

---

## Part 2: Generating the skill

**Alex:** Create a skill from my weekly-status-update workflow

**EDWIN:** _(reads user/workflows/weekly-status-update.md)_
Here's the skill:

**What it does:** Drafts a weekly status update email summarizing completed work, blockers, and next week's priorities.

**When it triggers:** "draft my weekly update", "write the weekly status", "Friday update"

**The steps it follows:** Gather completed tasks, current blockers, and next week's calendar → list shipped work with outcomes → note blockers and who can help → check calendar for priorities → format email with three sections (This week / Blockers / Next week).

**Sample run:**

**User:** Draft my weekly update

**EDWIN:** What did you ship this week?

**User:** Closed tickets ABC-101, ABC-108. The API integration is live and the dashboard refresh is done.

**EDWIN:** Any blockers?

**User:** Waiting on design for the new onboarding flow.

**EDWIN:** Next week's priorities?

**User:** Start the payment flow work, review meeting Tuesday, and planning session Thursday.

**EDWIN:**
Here's the draft:

**This week:**
- API integration live (ABC-101)
- Dashboard refresh complete (ABC-108)

**Blockers:**
- Waiting on design for new onboarding flow

**Next week:**
- Start payment flow work
- Review meeting (Tuesday)
- Planning session (Thursday)

Send it?

I'll tag this as **Work**. Right?

**Alex:** Yes

**EDWIN:** _(validates with edwin-doctor)_
Validated. No errors.

Ready to install. This will create `core/skills/weekly-status-update/` and sync it to your harnesses.

_(creates directory, writes SKILL.md, runs sync engine)_

Skill installed: **weekly-status-update**. It's live now — try saying "draft my weekly update".

---

## Part 3: Testing the installed skill

**Alex:** Draft my weekly update

**EDWIN:** What did you ship this week?

**Alex:** Finished the auth refactor and fixed that memory leak.

**EDWIN:** Any blockers?

**Alex:** None.

**EDWIN:** Next week's priorities?

**Alex:** Code review sessions, start the new feature work, and customer demo prep.

**EDWIN:**
Here's the draft:

**This week:**
- Auth refactor complete
- Memory leak fixed

**Next week:**
- Code review sessions
- Start new feature work
- Customer demo prep

Send it?

**Alex:** Perfect. Yes.

**EDWIN:** Draft ready. Want me to save it to a file or copy to clipboard?

**Alex:** Save it as friday-update.md

**EDWIN:** _(writes the file)_
Saved to `friday-update.md`.

---

## Part 4: Updating the skill

_(Two weeks later, Alex wants to add a section for team shout-outs)_

**Alex:** Update my weekly-status-update skill

**EDWIN:** _(reads core/skills/weekly-status-update/SKILL.md)_
What needs updating?

**Alex:** Add a section at the end for team shout-outs — recognizing people who helped me this week.

**EDWIN:**
I see you've added: a fourth section for team shout-outs after "Next week". Should it always appear, or only if there are shout-outs to give?

**Alex:** Only if I have shout-outs.

**EDWIN:** _(edits ## Instructions to add conditional step: "Ask if there are any team members to recognize. If yes, add a **Shout-outs:** section with their names and what they did.")_
_(bumps version from 1.0.0 to 1.1.0)_
_(re-validates with edwin-doctor)_
_(overwrites core/skills/weekly-status-update/SKILL.md)_
_(runs sync engine)_

Updated **weekly-status-update** to v1.1.0.

**Alex:** Draft my weekly update

**EDWIN:** What did you ship this week?

**Alex:** Deployed the new search feature, fixed three bugs.

**EDWIN:** Any blockers?

**Alex:** No.

**EDWIN:** Next week's priorities?

**Alex:** Refactor the legacy dashboard, sprint planning, and one-on-ones.

**EDWIN:** Any team members to recognize?

**Alex:** Yes — Jamie helped debug the search issue, and Taylor reviewed my PR super fast.

**EDWIN:**
Here's the draft:

**This week:**
- New search feature deployed
- Three bugs fixed

**Next week:**
- Refactor legacy dashboard
- Sprint planning
- One-on-ones

**Shout-outs:**
- Jamie — helped debug the search issue
- Taylor — lightning-fast PR review

Send it?

**Alex:** Great. Yes.

---

## Part 5: Publishing the skill to a personal repo

**Alex:** Publish my weekly-status-update skill to my repo

**EDWIN:** _(checks core/skills/weekly-status-update/SKILL.md, verifies author: user)_
Where should I push this? Your repo URL or remote name.

**Alex:** origin

**EDWIN:** _(stages core/skills/weekly-status-update/, shows git status)_
Staged: core/skills/weekly-status-update/

Commit message for this skill?

**Alex:** Add weekly status update skill

**EDWIN:** _(commits with message "Add weekly status update skill")_
Committed: `e4f8a3c` "Add weekly status update skill"

_(pushes to origin/main)_
Pushed to origin/main

Local sync script detected. Run it to copy skills to `.claude/SKILLS` directories?

**Alex:** Yes

**EDWIN:** _(runs tools/Sync-EdwinSkills.ps1)_
Synced 17 skills to:
- [home]\.claude\SKILLS
- [repo]\.claude\SKILLS

---

## Key Observations

1. **The user never wrote markdown.** Alex described the workflow conversationally, EDWIN documented it, then generated the skill.

2. **Review was in plain language.** EDWIN presented "what it does" and "when it triggers", not raw frontmatter and instruction blocks.

3. **Validation happened silently.** Edwin-doctor ran in the background; Alex only heard "Validated. No errors."

4. **The skill worked immediately after install.** No restart, no manual sync — the sync engine made it live.

5. **The update flow preserved customizations.** When Alex added the shout-outs section, EDWIN edited the existing skill and bumped the version rather than regenerating from scratch.

6. **Publishing was a single command.** EDWIN handled staging, committing, pushing, and local sync without Alex touching git directly.

---

## Variations

### If Alex had no workflow breakdown

If Alex had said "make me a skill that drafts weekly updates" without first running the workflow analyzer, EDWIN would have run an abbreviated interview inline:

**Alex:** Make me a skill that drafts weekly updates

**EDWIN:**
I'll ask a few questions to get this right.

1. What does this accomplish — what's the end result?
2. When would you use it? What exact words would you say?
3. What do you need before you start?

_(interview continues as in Part 1, then proceeds to generation)_

### If shell was unavailable

If Alex were in a web portal with no shell access:

**EDWIN:**
Shell unavailable. Save this file as `core/skills/weekly-status-update/SKILL.md`:

```markdown
---
name: weekly-status-update
description: Drafts a weekly status update email summarizing completed work, blockers, and next week's priorities. Use when the user says "draft my weekly update", "write the weekly status", or "Friday update".
contexts: [Work]
version: 1.0.0
requires: []
author: user
---

# Weekly Status Update

...
```

Then run `node tools/sync/engine.mjs` to install it.

### If requesting changes during review

**EDWIN:** _(presents the skill in plain language)_

Look right, or anything to change?

**Alex:** Make it ask me to review the draft before finalizing

**EDWIN:** _(adds instruction step: "Present the formatted draft and ask: 'Send it?' Wait for confirmation before proceeding.")_

Updated: EDWIN now asks you to review the draft before finalizing. Anything else?

**Alex:** No, that's good.

**EDWIN:** _(validates, installs)_

Skill installed: **weekly-status-update**.
