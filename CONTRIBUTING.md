# Contributing to EDWIN

Contributions are welcome. Before submitting a PR, read this document to understand how the project is organized and what the validation requirements are.

## The Conventions Contract

[specs/conventions.md](specs/conventions.md) is the binding contract for this project. Every skill, persona file, hook, script, and `user/` file schema conforms to what is written there.

**Before writing code:**
1. Read `specs/conventions.md` in full.
2. If you're implementing or extending a work unit, read its spec in `specs/WU-*.md`.
3. When the spec and conventions disagree, raise it rather than guessing.

The conventions document covers:
- Repository layout and the three laws (markdown-first, portability, hyper-conciseness)
- Skill format (frontmatter, body sections, size budget)
- Persona format (budget: 300 lines combined, hooks are 15 lines max)
- Graceful degradation (every skill works without its scripts)
- Script rules (Node ESM, zero dependencies, cross-platform, idempotent)
- Managed markers (how EDWIN writes into files it doesn't own)
- `user/` file schemas (config.json, state.json, memory, brags, workflows)
- Versioning, changelog, and definition of done

## Running the Doctor

`edwin-doctor` is the structure validator. It turns the conventions into an executable contract:

```bash
npm run doctor              # Validate entire repo
npm run doctor -- --skill core/skills/<name>   # Single skill
npm run doctor -- --json    # JSON output for tooling
npm run doctor -- --quiet   # Errors only
```

**The doctor must exit 0 before a change lands.** It checks:

- **Skills:** Frontmatter present and complete, name matches directory, description is trigger-optimised, contexts exist, required body sections present (`## Purpose`, `## When to use`, `## Instructions`, `## Degradation`, `## Examples`).
- **Contexts:** `contexts.json` parses, Global context exists, context names are unique.
- **Persona:** Required files exist, combined line count under budget, hook files follow format.
- **Templates:** Files in `core/templates/` are readable, YAML frontmatter parses.
- **Leakage:** Scans `core/`, `tools/`, `docs/`, and root `CLAUDE.md` for personal data (names, home paths, account handles). Excludes `specs/` and `docs/testing/`.
- **User data:** If `user/config.json` or `user/state.json` exist, validates against schemas.

Exit codes: `0` success (warnings allowed), `1` validation failed, `2` bad usage.

## Work Units and Specs

Development is organized into **work units** (WUs), each with a self-contained spec in `specs/`.

The plan is in [specs/PLAN.md](specs/PLAN.md). Each WU spec (`specs/WU-##-description.md`) defines:
- **Objective:** What the WU delivers and why.
- **Deliverables:** Files created or modified.
- **Acceptance criteria:** The definition of done.

### Sequencing and Ownership

Work units can run in parallel lanes when they don't conflict. The conventions document and the PLAN define boundaries:

- **Never edit another WU's files.** Extending something another WU created happens only when your spec says so and that WU is complete.
- **Shared files** (`CHANGELOG.md`, `package.json`, `README.md`) are orchestrator-owned. A work unit that needs a change states it in the completion report; it does not edit the file.

### Phases

WUs are grouped into phases:
- **Phase 0 (serial):** Framework scaffold and core persona.
- **Phase 1:** Context system, skill migration, validator.
- **Phase 2:** Sync engine, installers, plugin packaging.
- **Phase 3:** Meta-skills (workflow analyzer, skill creator, persona creator) and memory system.
- **Phase 4:** Scheduled tasks.
- **Phase 5:** Web-portal bundle generator.
- **Phase 6:** Documentation (README, HTML guides).
- **Phase 7:** End-to-end QA and release.

## The Changelog

[CHANGELOG.md](CHANGELOG.md) follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

During development, changes accumulate in the `## [Unreleased]` section under the appropriate heading (`Added`/`Changed`/`Removed`/`Fixed`). Each bullet ends with the WU reference: `(WU-05)`.

**Do not edit the changelog directly as part of a work unit.** The orchestrator maintains it to prevent merge collisions between parallel lanes.

## Versioning

- **Framework version:** `core/VERSION`, semver. `0.2.0` at release; the working branch carries `<next>-dev` between releases.
- **Skill versions:** `version` in frontmatter, semver, independent. Patch for wording, minor for new behaviour, major for a changed trigger or removed capability.

EDWIN bumps skill versions automatically when it edits a skill on the user's behalf.

## The Generated `skills/` Directory

The `skills/` directory at the repository root is **generated** by `npm run build-plugin` from `core/skills/`. It must be rebuilt whenever `core/skills/` changes, or `edwin-doctor` reports drift.

**Never hand-edit `skills/`.** Edit `core/skills/<name>/SKILL.md` and then run:

```bash
npm run build-plugin
```

This flattens the v0.2 skill format into the plugin-compatible structure and updates `.claude-plugin/plugin.json`. The second run should report "No changes" (idempotency check).

## npm Scripts

Available scripts (defined in `package.json`):

```bash
npm run doctor       # Validate repo structure and check for personal data leakage
npm run sync         # Install skills and persona to ~/.claude/ (sync engine)
npm run bundle       # Generate web-portal bundles
npm run build-plugin # Rebuild skills/ from core/skills/ for plugin packaging
npm run memory       # Memory helper (record, recall, forget, digest)
npm run brags        # Wins helper (log, list, generate a brag document)
npm test             # End-to-end suite (65 checks, temp directories only)
```

## Definition of Done

A work unit is complete when:

1. Every acceptance criterion in its spec is satisfied.
2. `npm run doctor` exits 0 and `npm test` exits 0.
3. No personal data has leaked into committed files (checked by doctor's leakage scan).
4. Every new skill has `## Degradation` and `## Examples`, and its dialogue is hyper-concise.
5. Every new script runs on both macOS and Windows, supports `--help`, and has zero dependencies.
6. If `core/skills/` was edited, `skills/` has been rebuilt with `npm run build-plugin`.

Discovered gaps outside scope are written up in the completion report, not fixed inline.

## Testing

- **End-to-end suite:** `npm test` must exit 0. It runs 65 checks against temp directories and a temp
  `HOME`, and fails if the real `user/` directory changed during the run. A new tool belongs in it.
- **Testability is part of the tool.** Anything that writes under `user/` takes `--root <path>`; anything
  that reads tracked config takes an override for it (`--limits` on the bundler). A tool that can only be
  exercised against live personal data is incomplete, not merely awkward.
- **Assert the failure, not the success.** A check named "rejects X" must prove the rejection came from the
  logic under test and not from argument validation upstream of it. Defeat your own guard once and confirm
  the check goes red.
- **No test may install software or invoke `sudo`.** The installers install Node.js and Git; the suite tests
  only the paths that *refuse* — `--help`, argument validation, `--skip-deps`, and the no-console decline.
  Simulate a missing tool with a stub on `PATH` that exits non-zero, and pair it with a control run that has
  no stub, so a check cannot pass because the installer broke for some other reason. Note that mutating an
  installer to prove a consent check goes red would make the suite install software for real — verify by
  removing the stub instead.
- **Cover the success path, not only the refusals.** Every installer check once tested a path that *refuses* —
  `--help`, argument validation, `--skip-deps`, the no-console decline — and all of them passed against an
  installer that could not complete a single install, because nothing ever ran `git clone`. If a tool's whole
  point is to do something, one check must make it do that thing end to end. Use a local `file://` fixture
  built from the tracked working tree rather than the network, and build it from the working tree rather than
  `git clone --bare`, which ships `HEAD` and would test the last commit instead of your change.
- **Test the artifact the user receives.** Windows scripts were once stored LF with `eol=crlf` in
  `.gitattributes`, and the suite asserted exactly that — a committed blob normalised to LF. The guarantee
  only applies on checkout, and the people who double-click an installer download the raw file instead, which
  is served byte for byte. `cmd` silently skips the inner lines of a multi-line block in an LF-only file, so
  the installer failed with no error message while the suite stayed green. `*.cmd` and `*.ps1` are now
  `-text` with CRLF committed. Assert what is *stored*, not what a checkout would have produced.
- **Prefer a language you can execute here.** The Windows installer was batch, and three consecutive
  failures on a real Windows 11 machine were found by the user and none by the suite — every one of them
  `cmd.exe` mis-parsing a nested block, which it does without printing anything. Reviewing that dialect line
  by line kept missing defects a single run would have caught. It is PowerShell now, `pwsh` runs on macOS,
  and the first execution surfaced two defects that no amount of reading had. When a platform-specific
  script must exist, choose the interpreter that is available on both the target and the developer's
  machine, and keep the un-runnable part small enough that it cannot hide a bug — the `.cmd` files are
  launchers of 40 and 33 lines with no branching, and a check enforces that they stay that way.
- **Doctor validation:** `npm run doctor` must pass.
- **Idempotency:** Run `npm run sync` or `npm run build-plugin` twice — second run should report no changes.
- **Cross-platform:** Scripts must run on macOS and Windows. Use `path.join`, never string concatenation for paths. Use `os.homedir()`, never `$HOME` or `%USERPROFILE%`.
- **Degradation:** Skills must function without their scripts, using file tools and EDWIN's instruction-following capability.

## Pull Requests

1. **One PR per work unit.** Keep changes focused.
2. **Title format:** `WU-##: description` (e.g., `WU-14: add README and CONTRIBUTING`).
3. **Description:** Link to the spec, summarize what was done, note any discovered gaps.
4. **Doctor and tests must pass:** CI should run `npm run doctor` and `npm test`, and fail the PR if either
   does not exit 0.
5. **No personal data:** The doctor's leakage scan must find nothing. Add your own name/paths to `tools/validate/denylist.txt` locally but do not commit real data.

## Commit Messages

Imperative, ≤ 72 chars, prefixed with the WU number:

```
WU-14: add README and CONTRIBUTING
```

One commit per completed work unit.

## Questions and Issues

- **Questions:** Open a discussion or issue in the repository.
- **Bugs:** Open an issue with steps to reproduce.
- **Feature requests:** Describe the use case and why existing skills don't cover it.

## License

By contributing, you agree that your contributions will be licensed under the MIT License (see `package.json`).
