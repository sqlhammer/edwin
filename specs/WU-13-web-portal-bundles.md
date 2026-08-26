# WU-13: Web-portal bundle generator

**Phase:** 5 · **Size:** L (3 checkpoints) · **Depends on:** WU-03, WU-04; WU-17 for memory-digest export (checkpoint 2+)

## Objective
Make EDWIN usable by people who only touch AI through a browser: generate paste-able/uploadable bundles of persona + a context's skills for claude.ai Projects, Gemini Gems, and Microsoft Copilot. Also the "could have" portability path.

## Checkpoint 1 — Core generator
1. `tools/bundle/build-bundle.mjs --context <name|Global> --portal <claude|gemini|copilot|all>`:
   - Flattens `core/persona/*` + skill index + full skill bodies for the chosen context into portal-shaped outputs under `dist/bundles/<portal>/<context>/`.
   - **Two artifacts per portal/context:** (a) `instructions.txt` — persona + skill index + routing rules, sized to the portal's instruction character limit (research current limits at build time; store in `tools/bundle/portal-limits.json`); (b) `knowledge/` — individual skill files formatted for upload to Project knowledge / Gem files where supported.
   - Skill degradation rewrite: strips/rewrites harness-only features (script hooks, scheduling, file ops) into web-appropriate behavior, driven by each skill's graceful-degradation section.
2. `core/skills/edwin-export/SKILL.md` — chat trigger ("export my Work context for claude.ai") that runs the generator and tells the user where the files are and what to do next.
3. **Personal-data flags:** `--include-memory` appends `user/memory/digest.md` to instructions (off by default; the export skill asks). `--include-brags` similarly opt-in (WU-18). Exports containing personal data are watermarked with a "contains personal info — paste only into your own account" warning.

## Checkpoint 2 — Portal adaptations
- Claude Projects: instructions + knowledge files; test real paste/upload.
- Gemini Gems: single-instruction bias (weaker file support) — generator produces a condensed variant; oversized contexts get a priority-ordered truncation with a manifest of what was cut.
- Copilot: adapt to current customization surface (research at build time; likely instructions-only, most condensed variant).

## Checkpoint 3 — Refresh story
- `--diff` mode: after skills change, report which portals/contexts are stale (hash manifest in `dist/`), regenerate only those, and print exact re-paste steps per portal.

## Acceptance criteria
- Each portal bundle for a sample Work context is generated within its size limits and, pasted into a real portal, produces an assistant that self-identifies as EDWIN, lists its skills, and executes two skills correctly.
- Skills with script hooks degrade per their stated fallback (verified for two skills).
- Regeneration after editing one skill flags only affected bundles.
