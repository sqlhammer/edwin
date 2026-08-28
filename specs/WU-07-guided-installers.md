# WU-07: Guided double-click installers (Windows/Mac)

**Phase:** 2 · **Size:** S · **Depends on:** WU-06

## Objective
Zero-terminal installation for non-technical users: download, double-click, answer prompts, done.

## Deliverables
1. `tools/installers/EDWIN-Install.cmd` (Windows) and `tools/installers/EDWIN-Install.command` (macOS):
   - Check prerequisites (git, Node ≥18, Claude Code or Claude Desktop); if missing, explain in plain language and open the correct download page in the browser rather than failing cryptically.
   - Clone or update the repo to `~/edwin` (ask before choosing another location).
   - Run the WU-06 sync engine; on success, print/say "Open Claude and say: set up EDWIN".
   - Pause-on-error with readable messages; log to `~/edwin/install.log`.
2. macOS quarantine note: `.command` files download with quarantine attribute — the user guide (WU-15) must show the right-click-Open flow; installer prints guidance if it detects it was blocked.
3. `EDWIN-Update.cmd` / `.command` — pull + re-sync.
4. Short manual-fallback section appended to README stub (full docs in WU-14/15).

## Acceptance criteria
- On a clean Windows VM and a clean Mac account: double-click → answer prompts → open Claude → onboarding skill triggers. No terminal typed by the tester.
- Missing-Node path verified: installer explains and links, doesn't crash.
- Update script is idempotent and preserves `user/`.
