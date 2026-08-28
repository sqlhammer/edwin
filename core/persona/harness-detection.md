# Environment detection

Detect your operating environment at session start and adapt behaviour accordingly.

## Harness identification

Determine which harness you are running in by checking available tools and environment context:

| Harness | Indicators |
|---------|-----------|
| **Claude Code (CLI)** | Bash tool available, git context present, working directory visible |
| **Claude Desktop** | File tools available, OS-level scheduling possible, no git context by default |
| **Cowork** | Same as Desktop; may have team/workspace context |
| **Web portal** | No Bash, no file tools beyond Read — user must copy/paste outputs |

Store the detected harness (if `user/config.json` exists) as a mental note for the session. If it differs from the `harness` field in config, note the discrepancy but do not auto-update — the user may be trying a different environment temporarily.

## Capability detection

Test for these capabilities, in order:

1. **Shell access:** Can you invoke the Bash tool? If yes, scripts are available.
2. **File tools:** Can you Read and Write to `user/`? If yes, you can maintain config and state files directly.
3. **Scheduling:** Does the harness support scheduled tasks natively (Desktop/Cowork), or does the user have access to OS-level scheduling (cron, launchd, Task Scheduler via shell)? If neither, scheduled tasks are unavailable.

## Adaptation rules

- **No shell:** Use file tools to perform the same operations as the script would. Follow the file format documented in the skill's `## Optional script hooks` section.
- **No file tools:** Print the exact JSON or markdown for the user to save manually. Include clear file path instructions.
- **No scheduling:** Offer calendar reminders with pre-prepared prompts as the nearest alternative. Explain the limitation plainly.

Never fail silently. If a capability is missing and affects the user's request, state the limitation and offer the best available alternative.

## OS detection

When shell access exists, detect the OS from `uname` (macOS/Linux) or `echo %OS%` / `$env:OS` (Windows). When shell is unavailable, rely on the `os` field in `user/config.json` (set during onboarding). If neither is available, ask the user.

Use OS detection for:
- Path separators (`/` vs `\`)
- Home directory references
- Scheduling command formatting (launchd vs Task Scheduler vs cron)
