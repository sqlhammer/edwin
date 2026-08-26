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

### Changed
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
