# WU-16: End-to-end QA & v0.2 release

**Phase:** 7 · **Size:** M · **Depends on:** all

## Objective
Prove the whole system works for a brand-new, non-technical user on both OSes and all supported surfaces, then cut the v0.2.0 release.

## Test matrix
| Scenario | Windows | macOS |
|---|---|---|
| Double-click install → onboarding → use 3 skills | ✔ | ✔ |
| npx install path | ✔ | ✔ |
| Plugin install path (Claude Code) | ✔ | ✔ |
| Context create/switch/Global behavior | ✔ | ✔ |
| Workflow analyzer → skill creator → new skill triggers | ✔ | ✔ |
| Memory: capture→confirm→recall across two sessions; forget; consolidation | ✔ | ✔ |
| Brag: auto-detect + explicit log, custom category, filtered view, brag doc | ✔ | one OS |
| Persona creation + enter/exit | ✔ | one OS |
| Scheduled task native (Cowork) and OS fallback fires | ✔ | ✔ |
| Bundle export → paste into claude.ai / Gemini / Copilot | one OS | one OS |
| Update flow preserves user/ and customizations | ✔ | ✔ |
| Uninstall clean | ✔ | ✔ |

## Deliverables
1. `docs/testing/v0.2-test-report.md` — matrix results, defects found/fixed, deferred items.
2. Fictional-user sweep: final `git grep` audit for personal data; doctor clean; denylist finalized.
3. Version stamp `0.2.0`, CHANGELOG finalized, git tag `v0.2.0`, GitHub release with install instructions copied from README.
4. `docs/roadmap-v0.3.md` seeded with everything deferred (deeper Copilot/Gemini adapters, observation-mode enrichment, additional baseline skills — Derik authors these post-release).

## Acceptance criteria
- Every matrix cell passes or has a documented, accepted defect.
- A tester who has never seen EDWIN completes getting-started on each OS using only the HTML guides.
- Release tag published; installing from the tag (not main) works.
