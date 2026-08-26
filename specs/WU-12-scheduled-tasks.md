# WU-12: Scheduled tasks (harness-native + OS fallback)

**Phase:** 4 · **Size:** M · **Depends on:** WU-02, WU-06

## Objective
When the user asks for anything recurring or future-dated ("every morning, brief me", "remind me Friday"), EDWIN sets it up using the best mechanism the environment offers.

## Deliverables
1. `core/skills/edwin-scheduler/SKILL.md` with a decision ladder:
   - **Harness-native first:** Cowork/Desktop scheduled-task tools when present (create/update/list/delete via natural conversation).
   - **OS fallback (Claude Code terminal):** create OS-level jobs that invoke headless Claude (`claude -p "<prompt>"` with appropriate flags) — Windows Task Scheduler (`schtasks` via `tools/schedule/register-task.ps1`), macOS launchd (`tools/schedule/register-task.sh` writing a plist to `~/Library/LaunchAgents`). Output of scheduled runs written to `user/schedule-logs/`.
   - **Web portals:** explain unavailability, offer alternatives (calendar reminders linking a prepared prompt).
2. Scheduling registry `user/schedule.json` — EDWIN's record of what it scheduled, wherever it scheduled it; "what have you scheduled for me?" reads this; deletion removes both registry entry and the underlying job.
3. Safety rails: confirm schedule + exact prompt before creating; never schedule anything with destructive actions without an explicit user confirmation step baked into the scheduled prompt.
4. `tools/schedule/` scripts with `--list`/`--remove` support, tested both OSes.

## Implementation notes
- Verify current headless `claude` invocation flags at build time; isolate in one script constant.
- launchd/schtasks quoting is the classic failure point — include escaping tests with prompts containing quotes/newlines.

## Acceptance criteria
- In Cowork simulation: "brief me every weekday at 8" creates a native scheduled task.
- On terminal-only Mac and Windows: same request creates a working OS job that fires and logs output; registry reflects it; removal works.
- Registry survives EDWIN updates (lives in `user/`).
