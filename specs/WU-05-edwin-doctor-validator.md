# WU-05: edwin-doctor validator

**Phase:** 1 · **Size:** S · **Depends on:** WU-01

## Objective
A validation tool that checks the repo (and any user-created skill) against the conventions, so meta-skills and dev agents have an objective definition of "valid".

## Deliverables
1. `tools/validate/edwin-doctor.mjs` (Node, no deps beyond stdlib + a tiny YAML parser vendored in) checking:
   - Every `core/skills/*/SKILL.md` has valid frontmatter (required keys, kebab-case name matching folder, non-empty description, `contexts` values exist in `contexts.json` or are `all`).
   - `contexts.json` parses; Global exists.
   - Persona files exist and combined size under budget (warn > 300 lines).
   - No user-specific leakage: configurable denylist file `tools/validate/denylist.txt` (personal names, home paths) — repo ships with placeholder entries; installer never syncs `user/`.
   - Template files parse.
2. Exit code 0/1 with human-readable report; `--json` flag for agent consumption; `--skill <path>` to validate a single skill (used by WU-10 skill creator).
3. `tools/validate/Edwin-Doctor.ps1` thin wrapper invoking node, with a pure-PowerShell fallback for the frontmatter checks if Node is absent.
4. `npm run doctor` script in package.json; documented in conventions.

## Acceptance criteria
- Clean repo passes; seeding a deliberate error (missing description, bad context tag) fails with a clear message.
- Runs on Windows PowerShell and macOS zsh.
- `--json --skill` output is stable/parseable (this is the contract WU-10 consumes).
