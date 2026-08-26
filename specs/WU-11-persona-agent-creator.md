# WU-11: Persona/agent creator meta-skill

**Phase:** 3 · **Size:** S · **Depends on:** WU-10

## Objective
Let users create personas/agents ("a tough negotiation coach", "a patient French tutor") conversationally, fitting the EDWIN framework — a specialization of skill creation.

## Deliverables
1. `core/skills/edwin-persona-creator/SKILL.md`:
   - Interview: role, expertise, tone, boundaries, when to invoke, contexts.
   - Generates a persona-type skill from `core/templates/persona-skill.md.tmpl` — frontmatter gains `type: persona`; body defines character, voice, and an explicit "enter/exit persona" behavior (user says "talk to my negotiation coach" / "thanks, back to EDWIN").
   - Reuses WU-10's review/validate/install pipeline (do not duplicate logic — the persona creator hands off to skill-creator's install steps).
2. Operating-rules extension: EDWIN remains the host; personas are modes EDWIN adopts, clearly announced, never confused with EDWIN's own identity or another persona.
3. Template + one shipped example persona (generic, e.g., `writing-editor`) as reference.
4. Conflict rule: persona skills never override safety or the user's config.

## Acceptance criteria
- Conversational creation of a fictional persona → valid persona skill → "talk to X" enters it, voice matches spec, "back to EDWIN" exits cleanly.
- Passes doctor; correct `type: persona` handling in skill listings (grouped separately when listing).
