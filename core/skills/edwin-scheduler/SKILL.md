---
name: edwin-scheduler
description: Schedules recurring or future-dated tasks. Use when the user asks for anything recurring ("brief me every morning", "remind me Friday", "run this daily"), wants to see scheduled tasks, or asks to cancel a scheduled task.
contexts: all
version: 1.0.0
requires: [shell, tools/schedule/register-task.sh, tools/schedule/register-task.ps1]
author: edwin-core
---

# Task Scheduler

## Purpose

Create, list, and remove recurring or future-dated tasks that invoke EDWIN with a prepared prompt. The scheduler adapts to the environment, preferring native scheduling when available and falling back gracefully.

## When to use

- "Brief me every weekday at 8" / "Remind me Friday at 5pm"
- "Every morning, summarize my calendar"
- "What have you scheduled for me?" / "List my scheduled tasks"
- "Cancel the morning briefing" / "Remove the Friday reminder"

Not for:
- One-time reminders you want right now (just answer the request).
- Complex workflows requiring multi-step logic (consider `edwin-workflow-analyzer` first).

## Instructions

### 1. Harness detection

Before scheduling, determine the mechanism available:

**Cowork/Desktop native scheduling:** Check for native scheduled-task tools. This is UNVERIFIED — if a native scheduling tool is present, prefer it. Otherwise, fall through to OS-level scheduling.

**OS-level scheduling:** If shell access is available and no native scheduler is detected:
- **macOS:** Use `tools/schedule/register-task.sh` (launchd).
- **Windows:** Use `tools/schedule/register-task.ps1` (Task Scheduler).

**Web portals:** If no shell access and no file tools, explain unavailability and offer alternatives (calendar reminder with a prepared prompt).

### 2. Safety confirmation

Before creating any scheduled task, confirm with the user:

1. Show the exact schedule in plain language ("Every weekday at 8:00 AM").
2. Show the exact prompt that will run.
3. If the prompt contains destructive actions (delete, remove, reset, drop, etc.), warn the user and add an explicit confirmation step to the scheduled prompt itself:

> This prompt contains destructive actions. The scheduled task will ask for confirmation before proceeding. Confirm schedule?

Wait for explicit confirmation before proceeding.

### 3. Creating a scheduled task

When the user confirms:

**Shell available:**

1. Generate a unique task ID: `edwin-<timestamp>-<sanitized-name>` (e.g., `edwin-1640000000-morning-brief`).
2. Create the prompt file under `user/schedule-prompts/<task-id>.txt` with the exact prompt text.
3. Determine the log file path: `user/schedule-logs/<task-id>.log`.
4. Invoke the appropriate script:
   - macOS: `tools/schedule/register-task.sh --name "<name>" --schedule "<cron-expr>" --prompt-file "<path>" --log-file "<path>"`
   - Windows: `tools/schedule/register-task.ps1 -Name "<name>" -Schedule "<schtasks-expr>" -PromptFile "<path>" -LogFile "<path>"`
5. If the script succeeds, update `user/schedule.json` (create if absent):

```json
{
  "schemaVersion": 1,
  "tasks": [
    {
      "id": "task-id",
      "name": "human-readable-name",
      "prompt": "the exact prompt",
      "schedule": "human-readable schedule",
      "mechanism": "launchd|schtasks|cowork",
      "osJobId": "plist-filename|task-name",
      "promptFile": "user/schedule-prompts/<id>.txt",
      "logFile": "user/schedule-logs/<id>.log",
      "createdAt": "ISO timestamp",
      "lastRun": null
    }
  ]
}
```

6. Report success:

> Scheduled: **Morning briefing** will run every weekday at 8:00 AM. Logs: `user/schedule-logs/<id>.log`.

**File tools available, no shell:**

1. Generate the task structure as above.
2. Write the prompt file to `user/schedule-prompts/<id>.txt`.
3. Write or update `user/schedule.json` with `mechanism: manual`.
4. Print the exact OS command the user needs to run manually, with clear instructions.

**No file tools:**

Explain that scheduling is unavailable in this environment. Offer an alternative:

> I can't schedule tasks directly in this environment. Here's a calendar reminder you can set: "Every weekday at 8 AM: Ask EDWIN for a morning briefing" with this prompt ready to paste: [prompt text].

### 4. Listing scheduled tasks

When the user asks "what have you scheduled" or "list my scheduled tasks":

**File tools available:**

1. Read `user/schedule.json`.
2. For each task, check if the OS job still exists:
   - macOS: Check if `~/Library/LaunchAgents/<osJobId>.plist` exists and is loaded (`launchctl list | grep <id>`).
   - Windows: Check `schtasks /Query /TN "EDWIN\<name>"`.
3. Report any drift (registry entry without OS job, or vice versa):

> Warning: Task "Morning briefing" is in the registry but the OS job is missing. Want me to recreate it or remove the registry entry?

4. Display the list:

```
Scheduled tasks (2):
  Morning briefing — Every weekday at 8:00 AM
  Friday reminder — Fridays at 5:00 PM
```

**No file tools:**

> I need file access to read the schedule registry.

### 5. Removing a scheduled task

When the user says "cancel the morning briefing" or "remove the Friday reminder":

**Shell available:**

1. Read `user/schedule.json` to find the task by name or ID.
2. Confirm with the user if the name is ambiguous or if there are multiple matches.
3. Invoke the removal script:
   - macOS: `tools/schedule/register-task.sh --remove "<task-id>"`
   - Windows: `tools/schedule/register-task.ps1 -Remove "<task-id>"`
4. The script removes the OS job and deletes the prompt and log files.
5. Remove the task from `user/schedule.json`.
6. Report success:

> Removed: **Morning briefing** is no longer scheduled.

**File tools available, no shell:**

1. Read `user/schedule.json` to find the task.
2. Remove the task from the registry.
3. Delete the prompt file.
4. Print the exact OS command the user needs to run to remove the OS job:
   - macOS: `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/<osJobId>.plist && rm ~/Library/LaunchAgents/<osJobId>.plist`
   - Windows: `schtasks /Delete /TN "EDWIN\<name>" /F`

**No file tools:**

> I need file access to manage scheduled tasks.

### 6. Registry drift detection

When listing tasks, detect and report drift:

- **Registry entry without OS job:** Offer to recreate or remove the registry entry.
- **OS job without registry entry:** Offer to add it to the registry or remove the OS job.

Do not auto-correct drift — always confirm with the user first.

## Optional script hooks

| Script | Purpose | Invocation |
|--------|---------|-----------|
| `tools/schedule/register-task.sh` | Registers launchd jobs on macOS, writes plist to `~/Library/LaunchAgents/`, handles prompt-file-based invocation to avoid quoting issues | `./register-task.sh --name "<name>" --schedule "<cron>" --prompt-file "<path>" --log-file "<path>"` or `--list` or `--remove "<id>"` |
| `tools/schedule/register-task.ps1` | Registers Task Scheduler jobs on Windows, namespaced under `EDWIN\`, handles prompt-file-based invocation | `./register-task.ps1 -Name "<name>" -Schedule "<expr>" -PromptFile "<path>" -LogFile "<path>"` or `-List` or `-Remove "<id>"` |

Both scripts support `--help`, `--dry-run`, and exit with code 0 on success, 1 on expected failure, 2 on bad usage.

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| Shell + OS scheduling | Use `register-task.sh` (macOS) or `register-task.ps1` (Windows) to create OS-level jobs | Use file tools to write registry and prompt files, print the exact OS command for the user to run manually |
| File tools | Read/write `user/schedule.json` and prompt files directly | Print the exact JSON and prompt file contents with clear instructions on where to save |
| Scheduling entirely unavailable | N/A | Explain limitation, offer calendar reminder with prepared prompt as alternative |

## Examples

See `reference/examples.md` for detailed transcripts covering:
- Creating scheduled tasks (macOS and Windows)
- Listing tasks with drift detection
- Removing tasks
- Handling web portal limitations
- Confirming destructive actions
