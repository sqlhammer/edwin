# WU-01: Framework specification & repo scaffold

**Phase:** 0 · **Size:** M · **Depends on:** none · **Blocks:** everything

## Objective
Establish the EDWIN v0.2 repository structure, file-format conventions, and the shared `specs/conventions.md` contract that all later work units follow. This is the foundation; get it right and every other WU can run in parallel without drift.

## Background
EDWIN v0.1 (github.com/sqlhammer/edwin) is a flat `SKILLS/` folder, a CLAUDE.md personality, an npx installer, and a PowerShell sync script. v0.2 formalizes it into a portable framework: persona, skills with context tags, user config separated from framework, meta-skills, and tooling.

## Deliverables
1. Repo restructured to the layout in PLAN.md ("Target repository layout"). Preserve git history; move v0.1 `SKILLS/*` into `core/skills/` unchanged for now (WU-04 reformats them).
2. `specs/conventions.md` defining:
   - **Skill format:** `core/skills/<kebab-name>/SKILL.md` with YAML frontmatter: `name`, `description` (trigger-optimized, one paragraph), `contexts` (list of context names or `all`), `version`, `requires` (optional scripts/tools), `author`. Body sections: Purpose, When to use, Instructions, Optional script hooks, Examples.
   - **Persona format:** `core/persona/*.md` — identity, tone, operating rules; composed into CLAUDE.md by the sync engine.
   - **Graceful degradation rule:** every skill must state behavior when its optional scripts/harness features are unavailable.
   - **Portability rule:** no real names, personal paths, or accounts anywhere in `core/`; user data lives only in `user/` (gitignored).
   - **Naming, versioning (semver per skill + framework version in `core/VERSION`), changelog conventions.**
3. `user/` directory pattern: `user/config.json` (name, contexts owned, preferences), `user/state.json` (active context), `user/README.md` explaining it is machine-local. `.gitignore` updated.
4. `CHANGELOG.md` started; `core/VERSION` = `0.2.0-dev`.
5. Placeholder `core/contexts/contexts.json` with schema comment (WU-03 fills in behavior).

## Implementation notes
- Keep v0.1's npx entry (`bin/`) and `tools/Sync-EdwinSkills.ps1` working against the new layout with a minimal patch (full rewrite is WU-06).
- Frontmatter must be compatible with Claude Code and Cowork skill discovery (`name` + `description` keys as used by Anthropic skills).

## Acceptance criteria
- Fresh clone shows the target layout; `specs/conventions.md` is complete enough that an agent could write a new conforming skill without other guidance.
- v0.1 skills still install via existing scripts after the move.
- `git grep -i derik` (and similar personal identifiers) in `core/` returns nothing.
