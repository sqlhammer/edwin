# WU-10: Skill creator meta-skill

**Phase:** 3 · **Size:** M · **Depends on:** WU-05, WU-09 · **Blocks:** WU-11

## Objective
Turn a workflow breakdown (WU-09) — or a direct conversational request — into a valid, installed EDWIN skill. The user never writes markdown.

## Deliverables
1. `core/skills/edwin-skill-creator/SKILL.md`:
   - **Inputs:** a `user/workflows/*.md` breakdown, or a live conversation ("make me a skill that drafts thank-you notes"). If starting from conversation without a breakdown, run an abbreviated WU-09 interview inline.
   - **Generation:** drafts `SKILL.md` per conventions using `core/templates/skill.md.tmpl` — trigger-optimized description, context tags (proposes based on active context; confirms), instructions derived from the breakdown steps, graceful-degradation notes, examples synthesized from the interview.
   - **Review loop:** presents the skill in plain language ("Here's what it will do, when it triggers, here's a sample run") — not raw markdown unless asked. User approves/edits conversationally.
   - **Validation:** runs `edwin-doctor --json --skill` via script hook when shell exists; self-checks against conventions otherwise.
   - **Install:** writes to `core/skills/<name>/` (user's local clone) and runs the sync engine; in Cowork, may also use native skill-save mechanisms if present; in web portals, outputs the file content + points to the guide.
   - **Edit/version:** "update my thank-you-note skill" flow — load, modify, bump version, re-validate, re-sync.
2. Sample end-to-end transcript committed to `docs/examples/skill-creation-example.md` (fictional user) — doubles as test script and documentation source.
3. Extend `edwin-publish` (from WU-04) so user-created skills can optionally be committed/pushed to the user's own repo.

## Acceptance criteria
- From nothing to invoked: a fictional workflow → breakdown → generated skill → passes doctor → synced → triggers correctly on its trigger phrase in a fresh session.
- Review loop honors a requested change (e.g., "make it always ask before sending") and the change lands in the skill.
- Update flow bumps version and preserves user's prior customizations.
