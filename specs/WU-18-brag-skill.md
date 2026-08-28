# WU-18: Brag skill (wins tracker)

**Phase:** 3 (parallel lane) · **Size:** M · **Depends on:** WU-17, WU-03

## Objective
EDWIN keeps a running record of the user's wins, small and big — auto-detected from conversation or logged on request — categorized automatically with user-extensible categories. The payoff: nothing gets forgotten at review time.

## Storage design
- `user/brags/brags.md` — the log. One entry per win: date, title, one-to-three-sentence description (impact-focused), category, size (small/notable/major — EDWIN proposes, user can adjust), optional tags/people.
- `user/brags/categories.json` — category list. Defaults seeded from the user's contexts (e.g., Work, Home→Personal) plus `Health`, `Learning` as suggestions during onboarding; user can add/rename/merge categories at any time via chat ("create a brag category called Volunteering").

## Deliverables
1. **Brag skill** `core/skills/edwin-brag/SKILL.md`:
   - **Auto-detection:** reuses the WU-17 capture pattern (observe → propose → confirm). Persona hook: when the user mentions an accomplishment — shipped something, positive feedback received, milestone hit, hard conversation handled, personal achievement — EDWIN offers: "That sounds like a win — want me to log it?" Same batching/no-nag/tombstone rules as memory. Detection and storage are brag-specific, but the interaction contract is shared; the spec must reference WU-17's rules rather than restating divergent ones.
   - **Explicit triggers:** "log a win", "brag: closed the Henderson deal", "show my wins" (filterable: category, size, date range, "this quarter"), "edit/delete that win".
   - **Auto-categorization:** EDWIN assigns a category from `categories.json` using entry content + active context as a strong hint; states its choice inline during confirmation ("Logged under Work — say the word to change it"). Unmatched wins prompt a category suggestion, possibly a new one.
   - **Outputs:** "generate my brag doc" — formatted summary for a chosen period/category: performance-review mode (impact-framed, grouped by theme) and personal-retrospective mode (chronological, celebratory tone). Written to `user/brags/exports/` as markdown; offer docx via harness abilities when present.
   - **Cadence hook:** offers (once) to schedule a monthly "any wins I missed?" check-in via WU-12 scheduler.
2. **Script hook** `tools/memory/brags.mjs` (lives with memory tooling) — append/edit/query entries, category CRUD; manual fallback via harness file tools; web-portal degradation: brag log excluded from bundles by default (personal data), with an opt-in export flag in WU-13.
3. Doctor check: brags.md and categories.json parse; categories referenced by entries exist.
4. Sample fictional brag log + example brag doc in `docs/examples/`.

## Implementation notes
- Wins are not memories: they don't enter the memory digest (no context-window cost), except EDWIN may remember durable *patterns* ("user is driving the Atlas migration") through normal WU-17 flow.
- Tone matters: logging should feel encouraging, never sycophantic; a one-line acknowledgment, then move on.

## Acceptance criteria
- Simulated conversation containing an implicit win → offer → confirm → entry logged with correct category derived from active context.
- Explicit "brag:" entry, category creation, recategorization, and deletion all work via chat only.
- "Show my wins this month, Work only" filters correctly; brag doc generation produces both modes and reads well for a fictional quarter of 10 entries.
- Passes doctor; no brag data leaks into memory digest, bundles (unless opted in), or the repo.
