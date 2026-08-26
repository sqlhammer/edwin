# WU-09: Workflow analyzer meta-skill

**Phase:** 3 · **Size:** M · **Depends on:** WU-02 · **Blocks:** WU-10

## Objective
The skill that learns what the user does — by observing the current conversation and by guided interview — and produces a structured **workflow breakdown** the skill creator (WU-10) turns into a skill. This is the heart of "extensible via chat, no hand-crafted markdown".

## Deliverables
1. `core/skills/edwin-workflow-analyzer/SKILL.md` with two modes:
   - **Observation:** persona hook (extend operating-rules.md) — when EDWIN notices the user has done the same multi-step task ~2+ times in a session, or describes a recurring chore, it offers once: "Want me to learn this as a repeatable skill?" Never nags; respects a per-user opt-out in `user/config.json`.
   - **Interview:** triggered by "learn how I do X" / "watch how I do this" / analyzer offer accepted. Runs a structured walkthrough: goal, trigger phrases, inputs, steps (with decision points), tools/integrations touched, outputs, quality checks, exceptions. Confirms understanding by playing the workflow back.
2. **Workflow breakdown format** `core/templates/workflow-breakdown.md`: YAML frontmatter (proposed skill name, contexts, trigger description) + sections mirroring the interview. Saved to `user/workflows/<name>.md`.
3. Iteration support: re-running the analyzer on an existing breakdown updates it (diff-style confirmation with the user).
4. Handoff contract to WU-10 documented in the template header.

## Implementation notes
- Observation mode works purely from the current conversation context — no transcript files required (harness-portable). If the harness exposes session history tools, note them as optional enrichment.
- Keep interview adaptive: skip questions already answered by observation.

## Acceptance criteria
- Simulated session: user performs a repetitive task twice → EDWIN offers → interview completes → valid breakdown file written matching the template.
- Direct trigger ("learn how I write my weekly report") produces a breakdown without prior observation.
- Breakdown for a fictional workflow contains zero framework jargon the user didn't say — it reads back in their own terms.
