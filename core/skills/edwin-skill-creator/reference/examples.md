# Additional Examples

These extended examples supplement the core examples in the skill body.

## Example: Conversational mode (Sam, macOS)

**User:** Make me a skill that drafts thank-you notes

**EDWIN:**
> I'll ask a few questions to get this right.
>
> 1. What does this accomplish — what's the end result?
> 2. When would you use it? What exact words would you say?
> 3. What do you need before you start?

**User:** It writes a short, warm thank-you note. I'd say "draft a thank-you note" or "thank-you for X". I need the person's name and what they did.

**EDWIN:**
> 4. Walk me through the steps — what happens first, second, third?
> 5. Any variations?

**User:** Ask for the person's name, what they did, and tone (formal or casual). Then draft 2-3 sentences. Show me the note before I send it.

**EDWIN:**
> So: you draft a thank-you note, triggered by "draft a thank-you note" or "thank-you for X", starting with recipient name, action, and tone, then draft → review → finalize. Right?

**User:** Right.

**EDWIN:**
> I'll tag this as **Global**. Want it somewhere else?

**User:** No, Global is fine.

**EDWIN:** _(generates skill, presents in plain language)_
> Here's the skill:
>
> **What it does:** Drafts warm, concise thank-you notes for someone who helped you.
>
> **When it triggers:** "draft a thank-you note", "thank-you for X", "write a thank-you"
>
> **The steps it follows:** Ask for recipient name, what they did, tone (formal/casual) → draft 2-3 sentences → present note for review → finalize or revise.
>
> **Sample run:**
>
> **User:** Draft a thank-you note
>
> **EDWIN:** Who's it for, what did they do, and tone (formal or casual)?
>
> **User:** Jamie, helped me debug the API issue, casual
>
> **EDWIN:** Here's the draft:
>
> > Hey Jamie, thanks for jumping in on that API issue — saved me hours. Really appreciate it!
>
> Send it?
>
> Look right?

**User:** Perfect

**EDWIN:** _(validates, installs)_
> Skill installed: **thank-you-drafter**. Try saying "draft a thank-you note".

## Example: Review loop with changes (Sam)

**User:** Create a skill from my monthly-report workflow

**EDWIN:** _(reads, generates, presents)_
> Here's the skill:
>
> **What it does:** Drafts a monthly summary of key metrics and team notes.
>
> **When it triggers:** "draft the monthly report", "time for the monthly update"
>
> **The steps it follows:** Pull ticket counts, grab revenue, scan 1:1 notes → write metrics section → highlight themes → note blockers → conditionally explain revenue drop.
>
> Look right?

**User:** Make it always confirm the numbers before writing

**EDWIN:** _(adds confirmation step to `## Instructions`)_
> Updated: after pulling ticket counts and revenue, EDWIN now plays them back and confirms they're correct before drafting. Anything else?

**User:** No, that's good

**EDWIN:** _(validates, installs)_
> Skill installed: **monthly-report**.
