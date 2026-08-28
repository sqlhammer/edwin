# WU-04: Migrate v0.1 skills to v0.2 format

**Phase:** 1 · **Size:** S · **Depends on:** WU-01, WU-03

## Objective
Convert the 12 v0.1 skills to the v0.2 skill format with frontmatter, context tags, and graceful-degradation notes, so EDWIN ships with a useful out-of-the-box library.

## Skills to migrate
analyst, blog-writer, briefing, executive-coach, intellectual-sparing-partner, project-planner, prompter, publish-edwin-skills, researcher, strategist, tutor, x-ghostwriter.

## Deliverables
1. Each skill restructured to `core/skills/<name>/SKILL.md` per `specs/conventions.md`: frontmatter (`name`, `description`, `contexts`, `version: 1.0.0`, `requires`, `author: edwin-core`), body sections normalized.
2. Default context tags (user-adjustable later): Work — analyst, briefing, executive-coach, project-planner, strategist, x-ghostwriter; all/Global-suited — researcher, prompter, tutor, intellectual-sparing-partner, blog-writer; framework — publish-edwin-skills (rename to `edwin-publish`, generalize: it must push to *the user's* fork/repo, not sqlhammer's — parameterize the remote via `user/config.json`).
3. Descriptions rewritten for trigger accuracy (one paragraph: what it does + when to use, mirroring Anthropic skill-description best practice).
4. Content debloat pass: remove anything Derik-specific (e.g., x-ghostwriter's "AI leadership positioning" becomes a configurable positioning goal captured from `user/config.json` or asked at runtime).

## Acceptance criteria
- All 12 skills pass `edwin-doctor` (WU-05) — run it if available, otherwise validate against conventions manually.
- No personal identifiers remain (`git grep` check).
- Spot-test three skills in a live session: each triggers on a natural request and follows its instructions.
