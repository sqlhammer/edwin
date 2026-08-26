# Changelog

All notable changes to EDWIN are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is [semver](https://semver.org/).

## [0.2.0] — 2026-08-26

v0.2 turns EDWIN from a folder of Claude Code skills into a portable personal-assistant framework: a
persona, skills grouped into contexts, personal data separated from the framework, meta-skills that build
new skills from conversation, and tooling for installation, validation, scheduling, and web-portal export.

### Added
- Repository restructured to the v0.2 framework layout: `core/` (framework source), `user/`
  (machine-local personal data, gitignored), `tools/` (sync, validate, schedule, bundle, memory,
  installers), `docs/`, `specs/`. (WU-01)
- `specs/conventions.md` — the format contract for skills, personas, hooks, scripts, and `user/` file
  schemas that every work unit and every generated skill follows. (WU-01)
- `core/VERSION` framework version stamp, starting at `0.2.0-dev`. (WU-01)
- `user/README.md` explaining, in plain language, that the folder is machine-local and never synced. (WU-01)
- Placeholder `core/contexts/contexts.json` defining the context schema. (WU-01)
- EDWIN's persona, split into `core/persona/identity.md` (character and the conciseness mandate),
  `operating-rules.md` (skill routing, context bias, verbosity controls, degradation ladder, citations),
  and `harness-detection.md` (environment detection and adaptation) — 152 lines combined, inside the
  300-line budget that keeps the persona cheap to carry in every context window. (WU-02)
- `core/persona/hooks/` mechanism: always-on behaviours are contributed as one file per owning skill and
  appended to the persona by the sync engine, so skills can make EDWIN *notice* things before they are
  invoked. (WU-02)
- `edwin-setup` skill — conversational first-run onboarding that batches its questions, writes
  `user/config.json` and `user/state.json`, and ends with a short tour. Triggers when no config exists or
  on "set up EDWIN". (WU-02)
- `tools/sync/init-user.mjs` — writes the user config and state deterministically when a shell is
  available; supports `--help`, `--dry-run`, `--json`, and `--force`, and refuses to clobber an existing
  config. (WU-02)
- `core/templates/CLAUDE.md.tmpl` — the persona composition template and its token contract, consumed by
  the sync engine. (WU-02)
- `edwin-doctor` (`tools/validate/edwin-doctor.mjs`) — structure validator that turns the conventions into
  an executable contract: skill frontmatter and required body sections, context definitions, the persona
  line budget, hook format, template parsing, and a scan for personal-data leakage. Zero dependencies, with
  a vendored frontmatter parser that refuses what it cannot parse rather than mis-parsing it. (WU-05)
- `edwin-doctor --json` emits a stable findings object, and `--skill <path>` validates one skill — the
  contract the skill creator consumes to check its own output. `--root <path>` allows validating a tree
  other than the repo. (WU-05)
- `tools/validate/denylist.txt` — user-extensible personal-data patterns, shipping with commented
  placeholders only so the file itself stays portable. (WU-05)
- `tools/validate/Edwin-Doctor.ps1` — PowerShell wrapper that uses Node when present and falls back to a
  frontmatter-only check when it is not, announcing the reduced coverage. (WU-05)
- `npm run doctor`. (WU-05)
- Context system: `Global`, `Work`, and `Home` defined in `core/contexts/contexts.json`, with skill
  membership living in each skill's frontmatter as the single source of truth. All skills stay available in
  every context — the active context biases suggestions and ambiguity resolution, it never restricts
  access. (WU-03)
- `edwin-context` skill — switch, create, rename, and remove contexts, assign skills to them, and list
  skills grouped by context, entirely through conversation. Refuses to remove or rename `Global`, and
  reports how many skills a removal affects before doing it. (WU-03)
- `core/persona/hooks/context-bias.md` — the always-on bias behaviour, including surfacing a strong
  out-of-context match once rather than hiding it. (WU-03)
- `tools/sync/context.mjs` — context and skill-assignment operations with surgical frontmatter editing that
  rewrites only the `contexts:` line, so a context rename propagates across every skill without disturbing
  anything else. (WU-03)
- `edwin-workflow-analyzer` skill — learns a recurring task either by watching the current conversation or
  by a guided interview, then writes a structured breakdown to `user/workflows/`. The interview batches its
  questions, skips anything already observed, speaks the user's vocabulary rather than the framework's, and
  plays the workflow back for confirmation. Re-running it on an existing breakdown updates it with a
  plain-language diff. (WU-09)
- `core/persona/hooks/workflow-observation.md` — offers once, at a natural pause, when the same multi-step
  task has been done twice; tombstones a decline and honours the opt-out silently. (WU-09)
- `core/templates/workflow-breakdown.md` and its worked example — the breakdown format and the documented
  handoff contract the skill creator consumes. (WU-09)
- `core/skills/blog-writer/reference/writing-styles.md` — the Standard and Narrative style guides, split out
  of the skill body so the skill itself stays about the workflow. (WU-04)
- `tools/sync/engine.mjs` — the sync engine. Composes `CLAUDE.md` from the persona, hooks, and a
  context-grouped skill index, installs skills into `~/.claude/skills/`, and tracks what it installed in
  `~/.edwin/installed.json` so a later run can prune skills that no longer exist. Idempotent by content
  hash: a second run reports everything unchanged. (WU-06)
- Managed markers are honoured unconditionally — anything outside `<!-- EDWIN:BEGIN -->` /
  `<!-- EDWIN:END -->` is never modified, by any flag, and a `CLAUDE.md` with no markers gets the EDWIN
  block appended rather than replaced. The `EDWIN:MEMORY` and `EDWIN:CONTEXT` sections survive re-sync so
  the memory system can own them independently. (WU-06)
- `tools/sync/targets.mjs` — the only place harness paths are computed, so supporting a new harness or a
  corrected path is a one-file change. (WU-06)
- `bin/edwin-install.mjs` — the `npx` entry point. Checks Node and git, works either from a clone or from a
  cached one it manages itself, and reads the repository to install from out of `package.json` so a fork
  needs no code edits. (WU-06)
- `tools/sync/Sync-Edwin.ps1` — PowerShell path for machines without Node, explicit about the features it
  cannot offer. (WU-06)
- `npm run sync`. (WU-06)
- Memory system that EDWIN owns rather than borrowing: `edwin-memory` skill, the `memory-capture` persona
  hook that notices facts worth keeping and offers once, and `tools/memory/memory.mjs` to record, recall,
  forget, and digest entries in `user/memory/`. Deliberately independent of any harness's own memory
  feature, so EDWIN remembers the same things in Claude Code, Desktop, and a browser. (WU-17)
- The memory digest is substituted into the `EDWIN:MEMORY` block of the generated `CLAUDE.md` by the sync
  engine, so recall costs no tool calls. `edwin-doctor` enforces a digest line budget, because a digest that
  grows without bound quietly taxes every context window. (WU-17)
- `npm run memory`. (WU-17)
- `user/config.json` gains `website` and a `paths` object (`notes`, `blogDrafts`, `careerBackground`) for
  the optional locations `blog-writer` and `executive-coach` ask about. Onboarding does not ask for them;
  a skill asks the first time it needs one and offers to save the answer. (WU-04)
- EDWIN is installable as a Claude plugin: `.claude-plugin/plugin.json` and `marketplace.json`, with
  `tools/bundle/build-plugin.mjs` generating the plugin's `skills/` tree from `core/skills/`. Because a
  plugin installs by cloning, that tree is generated *and* committed, so `edwin-doctor` checks it for drift
  and names the stale skills. (WU-08)
- `edwin-activate` skill — a plugin can install skills but cannot write the user's `CLAUDE.md`, so a
  plugin-only install has EDWIN's skills without EDWIN's persona. "Activate EDWIN" closes that gap. (WU-08)
- `tools/installers/` — double-click installers for people who will not clone a repository:
  `EDWIN-Install`/`EDWIN-Update` as `.command` (macOS) and `.cmd` (Windows). They check prerequisites, fetch
  EDWIN, run the sync engine, and log the run. The macOS scripts detect the Gatekeeper quarantine attribute
  and explain the right-click-Open step instead of failing silently. Run as a lone downloaded file, with no
  `package.json` beside them, they ask for the repository address rather than giving up. (WU-07)
- `edwin-skill-creator` — turns a workflow breakdown or a plain conversational request into a valid,
  installed skill, reviewed with the user in plain language rather than raw markdown, validated through
  `edwin-doctor --json`, and installed via the sync engine. (WU-10)
- `edwin-persona-creator` and the `persona-host` hook — users can create personas ("a patient French
  tutor") from a batched interview. EDWIN stays the host and personas are announced modes it adopts, one at
  a time; a persona can never override safety behaviour or the user's own config, a rule embedded in
  `core/templates/persona-skill.md.tmpl` so every generated persona carries it. Ships `writing-editor` as a
  worked example. (WU-11)
- `edwin-scheduler` and `tools/schedule/register-task.{sh,ps1}` — EDWIN can run itself on a cadence via
  launchd or Task Scheduler, invoking `claude -p` headless with the prompt read from a file to sidestep
  shell-quoting problems in both schedulers. Neither script may narrow a schedule silently: malformed cron,
  invalid weekdays, week-wrapping ranges, and Windows day-lists on a non-weekly schedule all fail loudly
  rather than quietly scheduling something else. (WU-12)
- `README.md` rewritten so a reader can say what EDWIN is and pick an install path within the first screen,
  plus `CONTRIBUTING.md` covering the conventions contract, the clean-doctor requirement, and the work-unit
  layout. (WU-14)
- `edwin-export` and `tools/bundle/build-bundle.mjs` — exports EDWIN as a paste-ready bundle for harnesses
  with no filesystem: a custom-instructions file plus one knowledge file per skill. Skill bodies live in
  `knowledge/` only, never duplicated into the instructions, so the instructions stay an index. Portals that
  cannot take knowledge files get a condensed single-file variant instead of a truncated full one. (WU-13)
- `tools/bundle/portal-limits.json` — per-portal instruction limits, each carrying a `verified` flag and its
  source. Only Microsoft Copilot's 8,000-character limit is documented publicly; Claude Projects and Gemini
  Gems are recorded as unknown rather than guessed. EDWIN will not truncate or fail against a threshold it
  cannot cite — it reports the size and says the limit is unpublished. (WU-13)
- `npm run bundle`. (WU-13)
- Wins tracking: the `edwin-brag` skill, the `brag-detection` persona hook, and `tools/memory/brags.mjs`
  managing `user/brags/`. EDWIN notices accomplishments as they happen and offers once to record them, sized
  small/notable/major, so the brag document is assembled from contemporaneous notes rather than reconstructed
  from memory at review time. Generates review-oriented or personal-retrospective documents over any date
  range. (WU-18)
- `edwin-doctor` gains `brags-files-parse` and `brags-categories-valid`, so a hand-edited brag log that
  references a category that no longer exists is caught before a brag document is generated from it. (WU-18)
- Nine self-contained HTML user guides in `docs/`, written for a reader whose only prior experience is
  ChatGPT in a browser: getting started on macOS and Windows, using EDWIN, creating skills, memory and wins,
  web portals, scheduled tasks, updating, and troubleshooting — with `docs/index.html` as a hub organised by
  "I want to…". Inline CSS and no external requests, so every page works offline. Each opens with "What
  you'll need" and "How long this takes". (WU-15)
- `tools/test/run-e2e.mjs` — end-to-end harness (38 checks at WU-16, 43 after WU-17, 47 after the installer fixes) covering doctor, the sync engine, context
  operations, memory, brags, the scheduler, bundle export, both installers, and the no-personal-data
  contract. Every check runs against a temp `HOME` or a `--root` scratch tree and the suite hashes the real
  `user/` directory before and after to prove it was untouched. `npm test`. (WU-16)
- `--root <path>` on `tools/memory/memory.mjs` and `tools/sync/context.mjs`, and `--limits <path>` on
  `tools/bundle/build-bundle.mjs`, so those tools can be exercised without writing to real personal data or
  editing the tracked portal limits. A tool that can only be tested against live user data is treated as
  incomplete. (WU-16)
- `docs/testing/v0.2-test-report.md` and `docs/testing/manual-test-script.md` — automated results plus a
  numbered script for the cells a single macOS machine cannot cover: Windows, Gatekeeper double-click,
  web-portal upload, and conversational behaviour. (WU-16)
- `docs/roadmap-v0.3.md` recording everything deliberately deferred out of v0.2. (WU-16)

### Fixed
- Both double-click installers wrote their log file into the directory they were about to clone
  into, and `git clone` refuses a destination that exists and is not empty. **No fresh install
  could ever succeed on either platform.** The emptiness check exempted `install.log`, which only
  hid the fact that the installer had just created the obstacle itself. The log now lives in the
  system temp directory and is copied into the install directory once the clone has happened.
  Found by a user on Windows 11; the same defect was present on macOS. (WU-07)
- The Windows installer appended `.git` to the repository URL on every call to its validation
  routine, producing `edwin.git.git.git` and a failed clone. `echo %VAR% | findstr "\.git$"` can
  never match: `echo` emits the space that sits before the pipe, so the line ends in a space and
  the `$` anchor always fails. The same trap silently broke the `owner/repo` shorthand the prompt
  advertises. Suffix and prefix tests now use substring comparison. (WU-07)
- The Windows installer read `repository.url` from `package.json` by splitting on `:`, which
  splits the URL at its own scheme colon and yielded `git+https`. It now cuts at the scheme
  instead, and leaves `REPO_URL` untouched when the file has no usable line, so a malformed
  `package.json` falls through to the prompt rather than producing a mangled URL. (WU-07)
- The sync engine refused a home directory with no `~/.claude`, which is correct for a manual
  sync but made the double-click installers fail at the final step on a machine where Claude had
  never been started — after cloning, leaving the user with nothing. The engine gained
  `--create-target`, which the installers pass; the default still fails closed so a mistyped
  `--home` cannot silently populate a directory nobody asked for. (WU-06)
- Both installers gained `--no-pause`. A double-clicked installer is hosted by `cmd /c` (or owns
  its Terminal window), so the window closes the instant the script ends and takes every error
  message with it. Early-exit paths now pause like the success path does, and the flag exists so
  the test suite can drive a full install without blocking on a keypress. (WU-07)
- `tools/test/run-e2e.mjs` never exercised the clone path, which is why a total install failure
  shipped. It now builds a fake remote from this checkout's tracked working-tree files and drives
  a complete install over `file://` into a fresh temp `HOME` — no network, no personal data. Both
  installers accept `file://` specifically so this is testable offline. The remote is built from
  the working tree rather than by `git clone --bare`, which would test the last commit instead of
  the change in front of the author. (WU-16)
- `edwin-doctor` counted one line too many in every file, because a trailing newline yields an empty final
  segment from `split('\n')`. This inflated every size check, including the persona and memory-digest
  budgets, and falsely flagged a 250-line skill as over the 250-line guideline. (WU-16)
- `edwin-doctor`'s `brags-files-parse` accepted any `user/brags/categories.json` that was valid JSON,
  including a wrong-shaped one whose values were not description strings. The downstream
  `brags-categories-valid` check then reported every entry in `brags.md` as referencing a missing category —
  blaming the wrong file. It now rejects non-string values and names them. (WU-16)
- Both macOS `.command` installers died silently on some terminals. `clear` exits non-zero when `TERM` is
  unset or minimal, and it ran as the first statement of `main()` under `set -euo pipefail`, so the installer
  aborted with no output at all. A cosmetic screen-clear can no longer abort an install. (WU-16)
- `tools/memory/brags.mjs` labelled months using `new Date('YYYY-MM-01')`, which parses as UTC midnight and
  renders local — shifting the label back a month for anyone behind UTC. Month labels are now derived by
  string parsing, with no `Date` involved. (WU-16)

### Changed
- Both double-click installers now **install** missing prerequisites instead of opening a download page.
  Node.js and Git are installed by the installer itself: from Homebrew on macOS or winget on Windows when
  either is present, and otherwise from the vendors' own official packages — Node's signed `.pkg`/`.msi`
  with its SHA-256 verified against the published `SHASUMS256.txt`, Git from Apple's Command Line Tools on
  macOS and the official Git for Windows installer run silently on Windows. A download that fails its
  checksum is refused, not installed. Nothing is fetched through a web browser. (WU-17)
- Installer prerequisite handling is consent-based and fails closed. Both installers gained `--yes` (assume
  yes), `--skip-deps` (never install; report and stop), and `--help`. With no console to prompt at, the
  answer is **no** — an unattended run cannot accidentally consent to installing software. On Windows this
  required `choice` rather than `set /p`, which cannot tell a bare Return from end-of-input and so would
  have read "nobody is there" as "yes". (WU-17)
- The macOS installer looks for Homebrew by absolute path (`/opt/homebrew`, `/usr/local`) and loads its
  environment before deciding anything is missing. A double-clicked `.command` inherits a minimal
  environment, so a perfectly good Homebrew install is frequently not on `PATH` — most often on Apple
  silicon. It also verifies Git by *running* it, because `/usr/bin/git` exists on every Mac as a stub that
  fails until the Command Line Tools are installed. (WU-17)
- Installers report a tool that installed but isn't visible to the current shell as exactly that, and say to
  reopen the window — instead of continuing into a broken clone. (WU-17)
- `bin/edwin-install.mjs` (the npx path) prints the command that installs the missing tool on the machine it
  is running on — `brew`, `winget`, or whichever of apt/dnf/pacman/zypper/apk is present — rather than a URL.
  It keeps refusing to proceed; the npx path assumes a terminal and does not install anything itself. (WU-17)
- `docs/getting-started-mac.html`, `docs/getting-started-windows.html`, `docs/troubleshooting.html`, and the
  README prerequisites line rewritten to describe the scripted installs, the sudo/UAC prompts they cause,
  and the real failure modes: declined consent, `--skip-deps`, a `PATH` that needs a new window, and a
  checksum mismatch. (WU-17)
- **Verification status:** the macOS paths were exercised on a real machine, including a live download with
  checksum verification and a deliberately corrupted package to prove the mismatch is caught. The Windows
  `.cmd` paths were written against live URL probes and reviewed, but **never executed** — no Windows
  machine was available. `docs/testing/manual-test-script.md` §7 covers them and marks them UNVERIFIED.
  (WU-17)
- All 13 v0.1 skills rewritten to the v0.2 format: frontmatter (`name`, `description`, `contexts`,
  `version`, `requires`, `author`) plus the required body sections, including a `## Degradation` ladder that
  none of them previously had. Their methodologies are preserved; the structure around them is new. (WU-04)
- Every skill `description` rewritten for trigger accuracy — it is the only text the harness sees when
  deciding whether to route to a skill, and v0.1's single terse clauses were not enough to route on. (WU-04)
- Skills assigned to contexts: `analyst`, `briefing`, `executive-coach`, `project-planner`, `strategist`,
  and `x-ghostwriter` to `Work`; the rest available in every context. (WU-04)
- `publish-edwin-skills` renamed to `edwin-publish` and generalised — it reads `publish.remote` and
  `publish.branch` from `user/config.json`, asks when they are unset, and offers to save the answer. It no
  longer assumes any particular repository owner. (WU-04)
- `blog-writer`, `executive-coach`, and `x-ghostwriter` de-personalised. They previously named one
  individual, read that person's files by absolute Windows path, and fetched their website. They now take
  those inputs from `user/config.json` or ask for them, and degrade to working from what the user pastes
  into the conversation. (WU-04)
- `blog-image-producer` given v0.2 frontmatter and body sections. It had none in v0.1 — the sync engine
  reported it as `[Migration needed]` in the skill index. Its image prompt is preserved verbatim. (WU-04)
- v0.1's flat `SKILLS/` folder moved to `core/skills/`; the npx installer and PowerShell sync script were
  patched to the new paths so v0.1 installation keeps working until the WU-06 sync engine replaces them. (WU-01)
- `.gitignore` now excludes `user/` (except its README) and `dist/`, and no longer excludes `docs/` —
  `docs/` becomes published user documentation in v0.2. (WU-01)

### Removed
- `achievement-tracker` skill — it hardcoded one person's machine paths and external accounts, and its
  purpose is served portably by the `edwin-brag` skill. (WU-01)

### Migration note
The root `CLAUDE.md` becomes a generated artifact in v0.2, composed from `core/persona/*` by the sync
engine and written between managed markers. The v0.1 hand-written version remains in place until WU-06
generates its replacement.
