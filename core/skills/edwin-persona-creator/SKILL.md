---
name: edwin-persona-creator
description: Creates persona-mode skills conversationally — a writing editor, a negotiation coach, a patient tutor. Use when the user says "create a persona", "make me a [role] persona", or "I want to talk to a [character]".
contexts: all
version: 1.0.0
requires: [tools/validate/edwin-doctor.mjs, tools/sync/engine.mjs]
author: edwin-core
---

# Persona Creator

## Purpose

Lets users create persona-mode skills conversationally — fictional experts or characters EDWIN adopts temporarily ("talk to my negotiation coach"). Personas are modes, not separate identities, always announced on entry and exit.

## When to use

- "Create a persona" / "Make me a [role] persona"
- "I want to talk to a [character]"
- "Create a [domain] expert persona"
- User describes wanting a specific voice or character to consult

Not for:
- Creating workflow-based skills (use `edwin-skill-creator`).
- Modifying EDWIN's own base personality (that's `core/persona/`, not a skill).
- Creating tools or scripts (personas are pure instruction).

## Instructions

### Interview (batch mode)

Ask all core questions at once, not one at a time:

> I'll create that persona. A few questions:
>
> 1. **Role**: What role does this persona play? (e.g., "writing editor", "negotiation coach", "patient math tutor")
> 2. **Expertise**: What are they expert in? What knowledge or skill do they bring?
> 3. **Tone**: How do they sound? (e.g., "warm and Socratic", "direct and no-nonsense", "patient and encouraging")
> 4. **Boundaries**: What won't they do, or where do they defer? (e.g., "edits but doesn't rewrite unless asked", "flags shaky arguments but doesn't fact-check")
> 5. **Triggers**: What words or phrases should invoke this persona? (e.g., "talk to my editor", "review my writing")
> 6. **Contexts**: Should this be available everywhere (Global), or tagged to a specific context (Work, Home, etc.)?

Record all answers. If the user answers some but not all, ask only the missing ones in a follow-up.

### Generate the skill

1. **Derive the skill name** from the role: kebab-case, no prefix. Examples: `writing-editor`, `negotiation-coach`, `math-tutor`.

2. **Craft the description** (frontmatter):
   - Sentence 1: Role + what they do (one line).
   - Sentence 2: "Use when the user says [trigger phrases]."
   - Keep under 500 characters. Must include the user's trigger phrases verbatim.

3. **Populate the template** (`core/templates/persona-skill.md.tmpl`):
   - `name`: derived kebab-case name
   - `description`: as above
   - `contexts`: from interview answer, or `all` if unspecified
   - `version`: always `1.0.0` for new skills
   - `author`: always `user`
   - `type`: always `persona`
   - `title`: human-readable role (e.g., "Writing Editor")
   - `purpose`: one sentence explaining what problem this persona solves
   - `whenToUse`: bulleted list of trigger phrases from interview, plus 2-3 scenarios
   - `notFor`: 1-3 bullets clarifying scope or common confusions
   - `role`: from interview
   - `expertise`: from interview, 1-2 sentences
   - `tone`: from interview
   - `boundaries`: from interview
   - `entryTriggers`: quoted trigger phrases (e.g., "talk to my editor", "review my writing")
   - `instructions`: numbered steps for how the persona operates, written as imperatives to EDWIN. Must include:
     1. How to engage with the user
     2. What questions to ask or steps to follow
     3. How to respect conciseness (offer detail, don't dump it)
     4. How to stay in character
   - `examples`: synthesize 2-3 transcripts showing entry, in-persona dialogue (concise, no monologuing), and exit. Use Alex (Windows) or Sam (macOS).

4. **Validate structure** before showing the user:
   - Frontmatter complete: `name`, `description`, `contexts`, `version`, `requires: []`, `author: user`, `type: persona`
   - Body has: `## Purpose`, `## When to use`, `## Character`, `## Instructions`, `## Degradation`, `## Examples`
   - Description includes trigger phrases
   - Instructions include the conflict rule (see template)
   - Examples show clean entry/exit pattern

### Review loop

Present the persona in plain language:

> Here's the persona:
>
> **Role:** [role from interview]
>
> **When you say:** [trigger phrases]
>
> **What they do:** [purpose in one sentence]
>
> **Their voice:** [tone from interview]
>
> **Sample interaction:**
> [Shortened example showing entry, one exchange, exit]
>
> Look right, or anything to change?

**Do not show the raw markdown** unless the user asks ("show me the file").

If the user requests changes:
- Parse the change in plain language.
- Apply it to the generated skill.
- Re-present the changed section.
- Confirm: "Updated. Anything else?"
- Loop until approved.

### Hand off to skill-creator for validation and installation

Once approved, hand the generated skill to `edwin-skill-creator`'s pipeline:

> Ready to install. Validating and syncing to your harnesses.

**Shell available:**
1. Create directory: `mkdir -p core/skills/{{name}}`
2. Write the `SKILL.md` file to `core/skills/{{name}}/SKILL.md`
3. Run `node tools/validate/edwin-doctor.mjs --skill core/skills/{{name}} --json`
   - If errors, fix automatically (missing sections, malformed frontmatter)
   - Re-run until `"ok": true`
4. Run `node tools/sync/engine.mjs`
5. Report: "Persona installed: **{{name}}**. Say '{{trigger}}' to enter."

**File tools available, no shell:**
1. Write `SKILL.md` to `core/skills/{{name}}/SKILL.md`
2. Self-check structure per conventions §3
3. Tell user to sync manually: "Run `node tools/sync/engine.mjs` to install."

**No file tools (web portal):**
> Shell unavailable. Save this file as `core/skills/{{name}}/SKILL.md`:
>
> ```markdown
> [full SKILL.md content]
> ```
>
> Then run `node tools/sync/engine.mjs` to install it.

## Optional script hooks

| Script | Purpose | Invocation |
|--------|---------|-----------|
| `tools/validate/edwin-doctor.mjs` | Validates persona skill structure | `node tools/validate/edwin-doctor.mjs --skill <path> --json` |
| `tools/sync/engine.mjs` | Installs skills into target harnesses | `node tools/sync/engine.mjs` |

Both support `--help` and `--dry-run`.

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| Shell | Run `edwin-doctor` for validation and `engine.mjs` for installation | Self-check structure; write skill file with file tools and instruct user to sync manually |
| File tools | Write skill files directly to `core/skills/<name>/` | Print the full `SKILL.md` content for user to save manually |
| `edwin-doctor` | Validate automatically and fix errors in a loop | Self-check frontmatter and body structure per conventions §3 |

## Examples

### Example 1: Creating a negotiation coach (Sam, macOS)

**User:** Create a negotiation coach persona

**EDWIN:**
> I'll create that persona. A few questions:
>
> 1. **Role**: What role does this persona play?
> 2. **Expertise**: What are they expert in?
> 3. **Tone**: How do they sound?
> 4. **Boundaries**: What won't they do?
> 5. **Triggers**: What words should invoke this persona?
> 6. **Contexts**: Available everywhere (Global), or a specific context?

**User:** Role is negotiation coach. Expert in salary negotiation, contract terms, tactical empathy. Tone is direct, strategic, a little tough-love. Boundaries: won't negotiate for me, just coaches me through it. Triggers: "talk to my negotiation coach", "prep me for a negotiation". Global.

**EDWIN:** _(generates skill, validates structure)_
> Here's the persona:
>
> **Role:** Negotiation coach
>
> **When you say:** "talk to my negotiation coach", "prep me for a negotiation"
>
> **What they do:** Coaches you through salary and contract negotiations with strategic questions and tactical empathy.
>
> **Their voice:** Direct, strategic, a little tough-love. Won't negotiate for you, but will prep you to do it yourself.
>
> **Sample interaction:**
>
> **User:** Talk to my negotiation coach
>
> **Coach:** Entering Negotiation Coach. What's the negotiation?
>
> **User:** Salary for a new role. They offered 140K, I want 160K.
>
> **Coach:** What's your leverage — why should they move?
>
> **User:** I have another offer at 155K.
>
> **Coach:** That's your anchor. Lead with the other offer, not your want. "I'm excited about this role, and I have an offer at 155K. Can you match or beat that?" Then stop talking. What's your backup if they say no?
>
> **User:** Walk away or negotiate more PTO.
>
> **Coach:** Good. Know your line before the call. Ready?
>
> **User:** Thanks.
>
> **Coach:** Back to EDWIN.
>
> Look right?

**User:** Perfect.

**EDWIN:** _(writes file, runs doctor, syncs)_
> Persona installed: **negotiation-coach**. Say "talk to my negotiation coach" to enter.

---

A further example (review loop before install) is in `reference/examples.md`.
