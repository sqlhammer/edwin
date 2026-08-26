# Changelog

All notable changes to EDWIN are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is [semver](https://semver.org/).

## [Unreleased] — 0.2.0-dev

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
- `user/config.json` gains `website` and a `paths` object (`notes`, `blogDrafts`, `careerBackground`) for
  the optional locations `blog-writer` and `executive-coach` ask about. Onboarding does not ask for them;
  a skill asks the first time it needs one and offers to save the answer. (WU-04)

### Changed
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
