<!--
A filled-in workflow breakdown, for reference. Fictional user: Sam.
This is what core/templates/workflow-breakdown.md looks like once the workflow analyzer
has interviewed someone. Note the register: it reads like Sam's own notes, not like a form.
-->
---
name: weekly-team-update
proposedDescription: Drafts a weekly team update summarizing completed work, blockers, and next week's priorities. Use when the user mentions "weekly update", "team sync email", "Friday roundup", or asks to summarize the week's work.
proposedContexts: [Work]
---

# Weekly Team Update Breakdown

## What this workflow does

Pulls together the week's shipped work, current blockers, and next week's plan into a structured email for the team. Saves me from starting at a blank page every Friday.

## When I use it

- "Draft my weekly update"
- "Time for the Friday roundup"
- "Summarize this week's work for the team"

## What I need before I start

- This week's completed tickets (from the project tracker)
- Any blockers or dependencies I've flagged
- My calendar for next week to know what's coming

## The steps

1. List completed tickets from this week — title and key outcome for each.
2. Check for any blockers or dependencies and note them with who's involved.
3. Look at next week's calendar and pull out the major focus areas (meetings, deadlines, new work starting).
4. Draft the email:
   - **This week:** bullet list of shipped work
   - **Blockers:** call out dependencies or issues
   - **Next week:** priorities and key events
5. Read it back to confirm tone and completeness before sending.

## What it produces

- A markdown-formatted email ready to send to the team
- Occasionally a shorter version for posting in Slack if the update is simple

## Tools and integrations

- Project tracker API (when available) to pull ticket titles and statuses
- Calendar (Google Calendar or Outlook) to check next week's schedule

## How I know it worked

- The email covers completed work, blockers, and next week's plan
- Tone is clear and not overly formal
- I didn't forget any major shipped feature or upcoming deadline

## What can go wrong

- **No tickets closed this week:** Note it plainly rather than skipping the section. "Heads down on [feature] — ships next week."
- **Blocker is vague:** If I can't name who owns it, flag it as "needs clarity" rather than guessing.
