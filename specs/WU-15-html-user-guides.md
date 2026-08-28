# WU-15: HTML user guides

**Phase:** 6 · **Size:** L (2 checkpoints) · **Depends on:** WU-01–13 substantially complete

## Objective
Self-contained HTML guides a non-technical user can open in any browser and follow without help. These are the product's front door for the target audience.

## Design requirements
- Static, self-contained HTML in `docs/` (inline CSS, no build step, no external CDNs so they work offline). Shared lightweight stylesheet inlined or duplicated per page.
- Plain language throughout: no "repo", "CLI", "frontmatter" without an immediate parenthetical explanation. Screenshots or annotated step boxes for anything involving clicking.
- Every guide starts with "What you'll need" and "How long this takes".
- `docs/index.html` hub linking all guides, organized by "I want to…".

## Checkpoint 1 — Core guides
1. `getting-started-windows.html` and `getting-started-mac.html` — double-click installer walkthrough (incl. Mac right-click-Open for quarantine), first conversation, onboarding.
2. `using-edwin.html` — talking to EDWIN, what skills are, listing them, contexts and switching (incl. Global), asking EDWIN for help with EDWIN.
3. `creating-skills.html` — the workflow analyzer + skill creator journey, told as a story with a sample dialogue; creating personas.
4. `memory-and-wins.html` — how EDWIN remembers (what it asks to keep, how to say "remember/forget", going off the record, where the data lives and that it never leaves the machine) and the brag skill (logging wins, categories, generating a review-season brag doc).

## Checkpoint 2 — Extended guides
5. `web-portals.html` — using EDWIN in claude.ai, Gemini, Copilot: per-portal sections with exact click paths for pasting instructions/uploading knowledge, opt-in memory export, and how to refresh after changes.
6. `scheduled-tasks.html` — what's possible per environment, examples, how to review/remove schedules.
7. `updating-edwin.html` — update scripts, what's preserved (`user/`, incl. memory and brags), plugin update path.
8. `troubleshooting.html` — top failure modes from WU-06/07/12 testing (Node missing, quarantine, skills not appearing, schedule not firing) with fixes.

## Acceptance criteria
- Usability pass: someone matching the persona "non-technical, has used ChatGPT in a browser" follows getting-started to a working EDWIN without assistance (or every stumble found is fixed).
- All pages render offline, look acceptable on a laptop window, pass basic HTML validation, contain no personal data.
- index.html reachable path exists from README.
