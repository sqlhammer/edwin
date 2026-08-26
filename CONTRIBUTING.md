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

- **Framework version:** `core/VERSION`, semver. Currently `0.2.0-dev` during development, `0.2.0` at release.
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
```

## Definition of Done

A work unit is complete when:

1. Every acceptance criterion in its spec is satisfied.
2. `npm run doctor` exits 0.
3. No personal data has leaked into committed files (checked by doctor's leakage scan).
4. Every new skill has `## Degradation` and `## Examples`, and its dialogue is hyper-concise.
5. Every new script runs on both macOS and Windows, supports `--help`, and has zero dependencies.
6. If `core/skills/` was edited, `skills/` has been rebuilt with `npm run build-plugin`.

Discovered gaps outside scope are written up in the completion report, not fixed inline.

## Testing

- **Doctor validation:** `npm run doctor` must pass.
- **Idempotency:** Run `npm run sync` or `npm run build-plugin` twice — second run should report no changes.
- **Cross-platform:** Scripts must run on macOS and Windows. Use `path.join`, never string concatenation for paths. Use `os.homedir()`, never `$HOME` or `%USERPROFILE%`.
- **Degradation:** Skills must function without their scripts, using file tools and EDWIN's instruction-following capability.

## Pull Requests

1. **One PR per work unit.** Keep changes focused.
2. **Title format:** `WU-##: description` (e.g., `WU-14: add README and CONTRIBUTING`).
3. **Description:** Link to the spec, summarize what was done, note any discovered gaps.
4. **Doctor must pass:** CI should run `npm run doctor` and fail the PR if it doesn't exit 0.
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
