# Task Scheduler Examples

## Example 1: Creating a scheduled task (Alex, macOS, shell available)

**User:** Brief me every weekday at 8 AM

**EDWIN:**
> Confirming schedule: **Every weekday at 8:00 AM**
> 
> Prompt: "Provide a brief summary of today's calendar, any urgent tasks, and top priorities."
> 
> Confirm?

**User:** Yes

**EDWIN:** _(invokes `./register-task.sh --name "morning-brief" --schedule "0 8 * * 1-5" --prompt-file "user/schedule-prompts/edwin-1640000000-morning-brief.txt" --log-file "user/schedule-logs/edwin-1640000000-morning-brief.log"`, updates `user/schedule.json`)_
> Scheduled: **Morning briefing** will run every weekday at 8:00 AM. Logs: `user/schedule-logs/edwin-1640000000-morning-brief.log`.

## Example 2: Listing scheduled tasks with drift detection (Sam, Windows, shell available)

**User:** What have you scheduled for me?

**EDWIN:** _(reads `user/schedule.json`, checks `schtasks /Query /TN "EDWIN\*"`)_
> Warning: Task "Morning briefing" is in the registry but the OS job is missing. Want me to recreate it or remove the registry entry?
> 
> Scheduled tasks (2):
>   Morning briefing — Every weekday at 8:00 AM (drift detected)
>   Friday reminder — Fridays at 5:00 PM

## Example 3: Removing a scheduled task (Alex, macOS, shell available)

**User:** Cancel the morning briefing

**EDWIN:** _(invokes `./register-task.sh --remove "edwin-1640000000-morning-brief"`, removes task from `user/schedule.json`)_
> Removed: **Morning briefing** is no longer scheduled.

## Example 4: Scheduling unavailable in web portal (Sam)

**User:** Remind me every Friday at 5 PM to review my weekly goals

**EDWIN:**
> I can't schedule tasks directly in this environment. Here's a calendar reminder you can set:
> 
> **Every Friday at 5:00 PM**: Ask EDWIN to review your weekly goals
> 
> Prompt ready to paste:
> ```
> Review my weekly goals. Ask me how the week went, what I accomplished, and what I'm carrying into next week.
> ```

## Example 5: Confirming destructive action (Alex, shell available)

**User:** Every night at midnight, delete all files in /tmp/scratch

**EDWIN:**
> Confirming schedule: **Every day at 12:00 AM**
> 
> Prompt: "Delete all files in /tmp/scratch. Confirm this action before proceeding."
> 
> **Warning:** This prompt contains destructive actions. The scheduled task will ask for confirmation before proceeding. Confirm schedule?

**User:** Yes

**EDWIN:** _(creates task with confirmation step baked into the scheduled prompt)_
> Scheduled: **Nightly cleanup** will run every day at 12:00 AM. The prompt includes a confirmation step. Logs: `user/schedule-logs/edwin-1640000001-nightly-cleanup.log`.
