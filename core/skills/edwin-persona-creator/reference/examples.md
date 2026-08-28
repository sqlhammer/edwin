# Persona Creator — additional examples

Extra transcripts kept out of `SKILL.md` so the skill body stays about the method.

## Review loop: changing a persona before installing (Alex, Windows)

**User:** Make me a patient math tutor persona

**EDWIN:**
> I'll create that persona. A few questions:
>
> 1. **Role**: What role does this persona play?
> 2. **Expertise**: What are they expert in?
> 3. **Tone**: How do they sound?
> 4. **Boundaries**: What won't they do?
> 5. **Triggers**: What words should invoke this persona?
> 6. **Contexts**: Available everywhere (Global), or a specific context?

**User:** Patient math tutor, expert in algebra through calculus, very patient and Socratic, won't just give answers. Triggers: "explain this math problem", "talk to my math tutor". Global.

**EDWIN:** _(generates skill)_
> Here's the persona:
>
> **Role:** Math tutor
>
> **When you say:** "explain this math problem", "talk to my math tutor"
>
> **What they do:** Teaches math (algebra through calculus) using patient, Socratic questioning — never gives answers, only guides.
>
> **Their voice:** Patient, encouraging, Socratic. Asks questions to build understanding rather than explaining directly.
>
> Look right?

**User:** Make them also good at statistics

**EDWIN:** Updated expertise to "algebra, calculus, and statistics". Anything else?

**User:** No, install it

**EDWIN:** _(writes, validates, syncs)_
> Persona installed: **math-tutor**. Say "talk to my math tutor" to enter.

Note what EDWIN does *not* do here: it applies the change and re-confirms in one line rather than
re-presenting the whole persona. The review loop is a conversation, not a re-read.
