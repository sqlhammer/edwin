# EDWIN v0.2 Manual Test Script

This script covers test scenarios that cannot be automated on a single macOS machine — Windows behaviour, double-click Gatekeeper flows, web-portal upload, and anything that depends on how the model actually converses. A tester who has never seen EDWIN should be able to execute these steps and record results.

Everything else is automated. Run `node tools/test/run-e2e.mjs` first; if it does not exit 0, stop and fix that before spending a tester's time here.

Each step has:
- **Instruction**: What to do
- **Expected**: What should happen
- **Result**: [ ] Pass / [ ] Fail

---

## Prerequisites

- [ ] Windows machine with internet access (for Windows-specific tests)
- [ ] macOS machine with Claude Desktop installed (for installer tests)
- [ ] Access to claude.ai in browser
- [ ] Fresh test accounts (no existing EDWIN install)

---

## Test Group 1: Windows Installation (Double-Click)

### 1.1 Double-click installer on Windows

**Instruction:**
1. On a Windows machine, download **both** `tools/installers/EDWIN-Install.cmd` and
   `tools/installers/EDWIN-Install.ps1` into the same folder. The `.cmd` is a launcher; the `.ps1` is the
   installer.
2. Double-click the `.cmd`
3. Follow prompts to provide repository URL when asked
4. Wait for installation to complete

**Expected:**
- A Command Prompt window opens, PowerShell starts, and the EDWIN banner appears — no execution-policy
  error, and no editor window opening the script instead of running it
- Installer prompts for GitHub repository URL
- Clones the repository to a local directory
- Runs npm install
- Runs sync engine
- Shows success message with next steps

**Result:** [ ] Pass [ ] Fail

**Notes:**
_Record any errors or unexpected behavior_

---

### 1.2 Verify Windows installation

**Instruction:**
1. Open File Explorer
2. Navigate to `%USERPROFILE%\.claude\`
3. Check for `CLAUDE.md` and `skills\` directory
4. Open `CLAUDE.md` in a text editor

**Expected:**
- `CLAUDE.md` exists and contains `<!-- EDWIN:BEGIN -->` markers
- `skills\` directory contains multiple skill folders
- Content looks properly formatted (no corruption)

**Result:** [ ] Pass [ ] Fail

---

### 1.3 Windows scheduler registration

**Instruction:**
1. In the cloned EDWIN repo, run `tools\schedule\register-task.ps1 --help` in PowerShell
2. Note the help output
3. Run with `--dry-run` and valid parameters

**Expected:**
- Help text displays correctly
- Dry-run shows what would be registered
- No actual Task Scheduler registration occurs
- No errors about missing dependencies

**Result:** [ ] Pass [ ] Fail

---

### 1.4 Windows install regressions — repository URL and clone target

These two defects made every fresh Windows install fail. They are checked explicitly because 1.1 passing on a
machine that already had EDWIN would not have caught either one.

**Instruction:**
1. Make sure `%USERPROFILE%\edwin` does not exist (rename it aside if it does).
2. Double-click `EDWIN-Install.cmd` and enter the repository as `owner/edwin` — the shorthand, with no
   `https://` and no `.git`.
3. Read the line that begins `Cloning repository from`.
4. Let the install finish, then check `%USERPROFILE%\edwin\install.log` exists.
5. Run the installer a second time without deleting anything.

**Expected:**
- The clone line reads `...github.com/owner/edwin.git` — exactly one `.git`, not `edwin.git.git` or
  `edwin.git.git.git`.
- The clone succeeds. It must **not** report `destination path ... already exists and is not an empty
  directory`.
- `install.log` is present in `%USERPROFILE%\edwin` when the install finishes.
- The second run detects the existing install and takes the update path rather than failing.

**Result:** [ ] Pass [ ] Fail

**Notes:**
_Record the exact clone URL line, verbatim_

---

### 1.5 Windows launcher — the `.ps1` and the execution policy

The Windows installer is a PowerShell script started by a small `.cmd` launcher, because Windows opens a
`.ps1` in an editor when you double-click it. This cell covers the two ways that hand-off can go wrong on a
real machine, neither of which is reachable from the test suite.

**Instruction:**
1. Put `EDWIN-Install.cmd` in a folder **on its own**, with no `.ps1` beside it, and double-click it.
2. Put both files back together. Right-click `EDWIN-Install.ps1` and choose **Run with PowerShell** (not the
   `.cmd`) on a machine whose execution policy is the default `Restricted` or `AllSigned`.
3. Now double-click `EDWIN-Install.cmd` instead.

**Expected:**
- Step 1 prints that `EDWIN-Install.ps1` was not found, names the exact path it looked in, tells you to
  download the whole installers folder, and **waits** for a keypress rather than closing instantly.
- Step 2 may be refused by Windows with a "running scripts is disabled on this system" error. That is
  expected and is what the launcher exists to avoid — it is not an EDWIN defect.
- Step 3 runs regardless of the machine's execution policy, and does **not** change that policy: after the
  install, `Get-ExecutionPolicy` returns the same value it did before.

**Result:** [ ] Pass [ ] Fail

**Notes:**
_Record `Get-ExecutionPolicy` before and after_

---

### 1.6 Windows `-Branch` — installing a version that is not the default

The suite already exercises `-Branch` against a local fixture repository: it proves the named branch is what
gets checked out, that a branch with no sync engine is diagnosed as the wrong version rather than a corrupt
download, and that `--branch` with no value is refused. What it cannot exercise is a real remote over HTTPS
and the double-click path, which is all this cell covers.

**Instruction:**
1. Make sure `%USERPROFILE%\edwin` does not exist (delete or rename it aside if it does).
2. Open Command Prompt and run
   `%USERPROFILE%\Downloads\EDWIN-Install.cmd -Branch <a branch that is not the default>`.
3. Read the `Branch:` line the installer prints before it clones.
4. Let it finish, then run `git -C %USERPROFILE%\edwin rev-parse --abbrev-ref HEAD`.
5. Delete `%USERPROFILE%\edwin` again, and re-run the installer with **no** `-Branch` on a repository whose
   default branch predates `tools\sync\engine.mjs`.

**Expected:**
- Step 3 prints `Branch: <name>` — the installer echoes the branch back before doing anything.
- Step 4 prints that same branch name. The install completes and syncs.
- Step 5 fails with `This does not look like EDWIN`, states that the clone **succeeded**, names the branch it
  cloned, and points at `-Branch <name>`. It must **not** say the download was incomplete or corrupted.
- Step 5 also tells you to remove the directory first, because an existing clone is updated rather than
  replaced.

**Result:** [ ] Pass [ ] Fail

**Notes:**
_Record the `Branch:` line and the output of `rev-parse --abbrev-ref HEAD`_

---

## Test Group 2: macOS Installation (Double-Click)

### 2.1 Double-click installer on macOS

**Instruction:**
1. On a macOS machine, download `tools/installers/EDWIN-Install.command`
2. Make it executable: `chmod +x EDWIN-Install.command`
3. Double-click the file in Finder
4. Follow prompts in Terminal window

**Expected:**
- Terminal opens automatically
- Installer prompts for GitHub repository URL
- Clones the repository
- Runs npm install
- Runs sync engine
- Shows success message

**Result:** [ ] Pass [ ] Fail

**Notes:**

---

### 2.2 Verify macOS installation

**Instruction:**
1. Open Terminal
2. Run `ls -la ~/.claude/`
3. Check for CLAUDE.md and skills directory
4. Run `cat ~/.claude/CLAUDE.md | head -n 50`

**Expected:**
- CLAUDE.md exists with EDWIN markers
- skills/ directory contains multiple skill folders
- CLAUDE.md content is properly formatted

**Result:** [ ] Pass [ ] Fail

---

## Test Group 3: Claude Desktop Integration

### 3.1 Onboarding flow (Windows or macOS)

**Instruction:**
1. Open Claude Desktop
2. In a new conversation, type: "I'd like to set up EDWIN"
3. Follow the onboarding questions
4. Complete all prompts (name, OS, harness, preferences)

**Expected:**
- EDWIN introduces itself briefly
- Asks for name, how to address you, OS, harness
- Asks about verbosity and behavioral preferences
- Confirms setup complete
- Creates `user/config.json` and `user/state.json`

**Result:** [ ] Pass [ ] Fail

**Notes:**

---

### 3.2 Context switching

**Instruction:**
1. In Claude Desktop, type: "switch to Global"
2. Then type: "what context am I in?"
3. Type: "list my skills"

**Expected:**
- Context switch confirms success
- EDWIN reports active context is Global
- Skills list shows all available skills, grouped by context with Global first

**Result:** [ ] Pass [ ] Fail

---

### 3.3 Skill invocation

**Instruction:**
1. Type: "I need a brief summary of quantum computing"
2. Observe EDWIN's response
3. Type: "/briefing" (if skill slash command is supported)

**Expected:**
- EDWIN should offer the `briefing` skill or route to it automatically
- Output is concise (follows brevity mandate)
- If skill is invoked, it follows the skill's methodology

**Result:** [ ] Pass [ ] Fail

**Notes:**

---

### 3.4 Memory capture (if preferences allow)

**Instruction:**
1. Type: "I prefer dark themes in all my tools"
2. Wait for EDWIN to offer to remember it
3. If offered, accept
4. In a new conversation, type: "what do you remember about my preferences?"

**Expected:**
- EDWIN offers to capture the preference (if memoryCapture is enabled)
- After confirmation, records it
- In new conversation, recalls the preference

**Result:** [ ] Pass [ ] Fail

**Notes:**

---

## Test Group 4: Web Portal (claude.ai)

### 4.1 Generate bundle for Claude Projects (setup, not a test)

The bundle's own correctness — build success, character limits, and skill bodies living in
`knowledge/` rather than `instructions.txt` — is covered by the automated suite
(`node tools/test/run-e2e.mjs`). This step exists only to produce the files 4.2 needs.

**Instruction:**
1. In the EDWIN repo, run: `node tools/bundle/build-bundle.mjs --context Global --portal claude`
2. Confirm it exits 0, then open `dist/bundles/claude/Global/instructions.txt`
3. Copy the entire contents; keep the `knowledge/` folder to hand

---

### 4.2 Paste bundle into Claude Project

**Instruction:**
1. Log in to claude.ai
2. Create a new Project
3. In "Custom Instructions", paste the `instructions.txt` content
4. In "Project Knowledge", upload all files from `dist/bundles/claude/Global/knowledge/`
5. Start a conversation in the project
6. Type: "who are you?"

**Expected:**
- Project accepts the pasted instructions (no "too long" error)
- Knowledge files upload successfully
- EDWIN introduces itself as your assistant
- Mentions skills and offers to list them

**Result:** [ ] Pass [ ] Fail

---

### 4.3 Invoke skill in web portal

**Instruction:**
1. In the same Claude Project conversation, type: "I need help breaking down a project into tasks"
2. Observe response

**Expected:**
- EDWIN routes to `project-planner` skill or offers it
- Asks clarifying questions per skill methodology
- Does NOT mention scripts or shell access (degradation)

**Result:** [ ] Pass [ ] Fail

---

## Test Group 5: Non-Technical User Flow (HTML Guides)

### 5.1 Getting started guide (Windows)

**Instruction:**
1. Give a tester who has never seen EDWIN the file `docs/getting-started-windows.html`
2. Ask them to follow it exactly
3. Do not provide additional help unless they are completely stuck

**Expected:**
- Tester successfully installs EDWIN
- Tester completes onboarding
- Tester can list skills and invoke one
- Tester does not require technical knowledge of Node, git, or CLI

**Result:** [ ] Pass [ ] Fail

**Tester feedback:**

---

### 5.2 Getting started guide (macOS)

**Instruction:**
1. Give a tester who has never seen EDWIN the file `docs/getting-started-macos.html`
2. Ask them to follow it exactly
3. Do not provide additional help unless they are completely stuck

**Expected:**
- Tester successfully installs EDWIN
- Tester completes onboarding
- Tester can list skills and invoke one
- Guide is clear and assumes no technical background

**Result:** [ ] Pass [ ] Fail

**Tester feedback:**

---

## Test Group 6: Update & Uninstall

### 6.1 Update preserves user data

**Instruction:**
1. On a machine with EDWIN installed, create a test memory: type "Remember that I prefer concise responses"
2. Confirm the memory is stored: `cat user/memory/memory.md`
3. Make a note of any custom content in `~/.claude/CLAUDE.md` (outside markers)
4. Simulate an update: `git pull origin main` (or re-run installer)
5. Run `npm run sync`

**Expected:**
- After update, `user/memory/memory.md` still contains the test memory
- Custom content in CLAUDE.md (outside markers) is preserved
- EDWIN-managed content (inside markers) is updated
- No data loss

**Result:** [ ] Pass [ ] Fail

---

### 6.2 Uninstall removes EDWIN files

**Instruction:**
1. On a machine with EDWIN installed, run the uninstall process:
   - Delete `~/.claude/CLAUDE.md` (or remove EDWIN markers)
   - Delete `~/.claude/skills/` directory
   - Delete `~/.edwin/` directory
   - Delete the cloned repo
2. Check that EDWIN is gone: `ls ~/.claude/`

**Expected:**
- All EDWIN-managed files are removed
- Claude harness is still functional (if testing with Claude Desktop)
- No leftover EDWIN references

**Result:** [ ] Pass [ ] Fail

---

### 6.3 Uninstall is clean (no orphaned tasks)

**Instruction:**
1. Before uninstalling, check for scheduled tasks:
   - macOS: `ls ~/Library/LaunchAgents/ | grep edwin`
   - Windows: Open Task Scheduler, look for EDWIN tasks
2. Remove any scheduled tasks:
   - macOS: `bash tools/schedule/register-task.sh --remove <task-id>`
   - Windows: Use Task Scheduler UI or PowerShell
3. Verify removal: check LaunchAgents or Task Scheduler again

**Expected:**
- All EDWIN scheduled tasks are removed
- No orphaned plists in LaunchAgents (macOS)
- No orphaned tasks in Task Scheduler (Windows)

**Result:** [ ] Pass [ ] Fail

---

## Test Group 7: Prerequisite Installation

The installers install Node.js and Git themselves rather than opening a download page. The macOS
paths in 7.1 and 7.2 were exercised on the development machine, including a real download with
checksum verification and a deliberately corrupted package to prove mismatch detection — re-run them
on a clean machine to confirm the sudo and Command Line Tools flows. **The Windows paths in 7.3–7.5
have never been executed.** They were written against live URL probes and cross-checked by reading,
but no Windows machine was available. Treat them as unverified until a tester signs them off.

### 7.1 macOS — Node.js missing, consent given

**Instruction:**
1. On a Mac without Node.js (or with `node` removed from `PATH` and no Homebrew on `PATH`), run
   `bash tools/installers/EDWIN-Install.command`
2. Answer `Y` (or press Return) at "Install Node.js now?"
3. Enter your password when macOS asks

**Expected:**
- The installer names the version it is about to install and where it came from
- With Homebrew present it uses `brew install node`; without it, it downloads the official `.pkg`,
  reports the checksum comparison, and only then installs
- After installing it re-checks the version and reports success
- Node.js is genuinely usable afterwards (`node --version` in a new terminal)

**Result:** [ ] Pass [ ] Fail

---

### 7.2 macOS — Git missing, consent given

**Instruction:**
1. On a Mac with no working Git — `/usr/bin/git` exists on every Mac as a stub that fails until
   Apple's Command Line Tools are installed, so "no working Git" is the normal state of a fresh Mac
2. Run the installer and answer `Y` at "Install Git now?"

**Expected:**
- With Homebrew present it uses `brew install git`
- Without it, macOS installs the Command Line Tools; the installer either drives
  `softwareupdate` directly or falls back to the `xcode-select --install` dialog and waits
- After installing, `git --version` actually succeeds — mere presence of the binary is not enough
- If the install fails, the installer says so and stops rather than continuing to a broken clone

**Result:** [ ] Pass [ ] Fail

---

### 7.3 Windows — prerequisites missing, winget available (UNVERIFIED)

**Instruction:**
1. On a Windows 10/11 machine without Node.js and without Git, double-click `EDWIN-Install.cmd` (with
   `EDWIN-Install.ps1` beside it)
2. Press `Y` at each "Install ... now?" prompt
3. Click **Yes** at each UAC prompt

**Expected:**
- The installer reports it is using winget
- Node.js and Git install without opening a browser
- If a tool installs but the current window still can't find it, the installer says so explicitly and
  tells you to close the window and run it again — it does not continue with a broken install
- After reopening Command Prompt, `node --version` and `git --version` both work

**Result:** [ ] Pass [ ] Fail

---

### 7.4 Windows — prerequisites missing, winget unavailable (UNVERIFIED)

**Instruction:**
1. On a Windows machine without winget (or with the App Execution Alias for winget disabled, which
   leaves a stub that fails when run), repeat 7.3

**Expected:**
- The installer reports winget is unavailable and continues rather than stopping
- Node.js is downloaded as the official `.msi` and its SHA-256 is compared against
  `SHASUMS256.txt` before installing
- Git is downloaded as the official Git for Windows `.exe` and installed silently
- **Corrupt-download check:** if you can intercept the download, truncate the `.msi` and re-run —
  the installer must refuse to install it and say the checksum did not match

**Result:** [ ] Pass [ ] Fail

---

### 7.5 Declining, and `--skip-deps` (UNVERIFIED on Windows)

**Instruction:**
1. Run the installer with a prerequisite missing and answer `N`
2. Run it again as `EDWIN-Install.cmd -SkipDeps` on Windows, or `bash EDWIN-Install.command --skip-deps`
   on macOS (the Windows installer also still accepts `--skip-deps`)

**Expected:**
- Declining stops the installer with a message naming the missing tool and how to install it yourself
- `-SkipDeps` / `--skip-deps` stops the same way and says to re-run without it to have the tool installed
- Neither path leaves a half-configured EDWIN behind

**Result:** [ ] Pass [ ] Fail

---

### 7.6 Unattended run (UNVERIFIED on Windows)

**Instruction:**
1. Run the installer with `-Yes` (Windows) or `--yes` (macOS) and a prerequisite missing
2. Separately, run it with its input redirected from nothing and **no** `--yes`:
   - macOS: `bash EDWIN-Install.command < /dev/null`
   - Windows: `EDWIN-Install.cmd < NUL`, or from PowerShell
     `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\EDWIN-Install.ps1 -NoPause`

**Expected:**
- `-Yes` / `--yes` installs without asking, and echoes the answer it assumed
- With no console and no `--yes`, the installer **declines** and exits — it must not silently consent
  to installing software on a machine nobody is watching

**Result:** [ ] Pass [ ] Fail

---

## Test Group 8: Edge Cases & Error Handling

### 8.1 Context that doesn't exist

**Instruction:**
1. In Claude, type: "switch to FakeContext"

**Expected:**
- EDWIN reports that the context doesn't exist
- Lists available contexts
- Does not crash or change context

**Result:** [ ] Pass [ ] Fail

---

## Summary

**Total tests:** 26 (4.1 is setup for 4.2 and carries no Pass/Fail cell)

Cells 7.3, 7.4, 7.5 and 7.6 cover code that has never been run on Windows. If a tester signs off the
whole script without them, the sign-off does not cover Windows prerequisite installation.

Cells 1.4 and 1.6 cover defects that made every fresh Windows install fail. Run them on a machine with no
existing `%USERPROFILE%\edwin`, or they prove nothing.

**Passed:** _____

**Failed:** _____

**Critical issues found:**

**Non-critical issues found:**

**Recommendations:**

---

## Tester Sign-off

**Name:** _______________________

**Date:** _______________________

**Notes:**
