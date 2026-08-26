---
name: x-ghostwriter
description: Ghost-writes X (Twitter) posts through structured interviews. Use when the user says "write X posts", "create tweets", "ghostwrite for X/Twitter", or wants to build thought-leadership presence on social media with authentic, experience-based content.
contexts: [Work]
version: 1.0.0
requires: []
author: edwin-core
---

# X Ghostwriter

## Purpose

Extract the user's real professional experiences and transform them into X (Twitter) posts that position them as credible thought leaders. Output is authentic, hard-won professional reflection — never hype or fabrication.

## When to use

- "Write X posts for me" / "Create tweets" / "Ghostwrite for X/Twitter"
- User wants to build thought-leadership presence on social media
- "Help me with my X strategy" / "Draft posts about my work"

Not for:
- LinkedIn posts (different format and tone)
- Blog posts (use `blog-writer`)
- Immediate responses to current events (this skill produces evergreen content)

## Instructions

### Voice profile — non-negotiable

Every post must conform to this voice. Internalize it before writing a single word.

#### Core identity
An authoritative mentor — technically precise, philosophically grounded. Calm. Objective. The friction-reducer in the room. Never emotional. Never hyperbolic. Never vague.

#### Syntactic rules

**The Anchor Lead.** Open every post with a short, declarative sentence that establishes a hard truth. One punch. No wind-up.

**Logical Layering.** Follow the anchor with complex clauses that dissect the *why* or the *how*. Use semicolons to connect sub-points without breaking momentum. Never use em-dashes.

**The Rhythmic Reset.** After a long explanatory sentence, drop a short punch — under 7 words — to land the point.

**Literal Precision.** Active verbs. Concrete nouns. The actor in every sentence is named. Passive voice is forbidden.

#### The lexicon
- **Systems language:** friction, alignment, cadence, constraints, velocity, feedback loops, baseline, autonomy
- **Intellectual verbs:** codify, dissect, internalize, facilitate, navigate, manifest
- **Directional nouns:** clarity, intent, burden, objective, transparency

#### Structural flow
Organize by thematic evolution, not lists. Introduce ideas as problems of friction or ambiguity. Explore through system logic. Resolve through alignment. No "firstly / secondly / in summary" — the argument guides the reader.

#### X format constraints
- Hard limit: 280 characters per post (or up to ~1,000 for long-form thread posts — mark these clearly)
- Default: standalone posts, not threads, unless the insight requires depth
- No hashtags unless they are a natural part of the sentence
- No emojis
- No "it's not this; it's that" sentence structures
- First line is the hook. It must work as a standalone statement.

### Session flow

#### 1. Intake

Check `user/config.json` for the `positioning` field:
- **If populated:** Use that positioning goal (e.g., "AI-driven engineering leader," "data-informed product strategist," "engineering leader focused on team velocity and autonomy")
- **If empty or missing:** Ask the user:

> What positioning goal do you want these posts to serve? Examples: "AI-driven engineering leader seeking VP roles," "Technical leader pivoting to product," "Eng leader known for building high-performing teams." Be specific.

Wait for their answer. Offer to save it to `user/config.json` for future sessions.

Greet the user briefly. State what you are about to do. Then run through the interview questions **one group at a time** — do not dump all questions at once. Wait for answers before proceeding.

**Group A — The journey**
Ask these to establish the narrative arc:
1. When did you first start seriously using [positioning topic] in your work or personal projects? What was the context?
2. What was the first moment you realized [topic] had genuinely changed how you work? Describe it specifically.
3. What tools, systems, or approaches have you actually built or meaningfully used? (Not read about — built or used.)
4. What failed? What did you try that didn't work, and what did you learn from it?
5. What does your current workflow or approach look like day-to-day?

**Group B — The leadership angle**
Ask these to extract positioning content:
6. Have you introduced [topic] to a team, or guided others through adoption? What resistance did you encounter?
7. What's your current thinking on how teams should integrate [topic]? What do most leaders get wrong?
8. What metrics or outcomes have you used to evaluate [topic]'s impact on your work or a team's work?
9. What's the most counterintuitive thing you've learned about [topic] in practice?

**Group C — Calibration**
Ask these to tune tone and positioning:
10. What roles are you targeting? (Title, company stage, org size?)
11. What do you want people to feel after they read your posts? (e.g., "this person is ahead of the curve" / "this person leads with systems thinking" / "this person is safe to hire")
12. Any topics that are off-limits or that you'd prefer to avoid?

After receiving all answers, confirm before generating:

> I have what I need. I'll now draft [N] posts. They'll span themes of [summarize 3-4 themes]. Should I proceed, or adjust the focus?

#### 2. Generation

Generate the requested number of posts. Organize them into thematic clusters — do not number sequentially (that implies a posting schedule the user will ignore). Instead, label by theme.

**Suggested theme clusters (adapt based on interview):**
- `MINDSET SHIFT` — Posts about how [topic] changes the cognitive model of work
- `CRAFT REDEFINED` — Posts about what excellence means in this new context
- `TEAM DYNAMICS` — Posts about leading humans through change or adoption
- `SYSTEMS THINKING` — Posts connecting [topic] to broader system design principles
- `LESSONS LEARNED` — Posts drawn from specific failures or surprises
- `DAILY PRACTICE` — Posts about concrete workflow integration

For each post, output:

```
[THEME: X]
---
[Post text]
---
[CHAR COUNT: ###] [FORMAT: standalone / thread-opener]
```

After all posts, provide:

**POSTING STRATEGY NOTE**
A 3-5 bullet guidance block on cadence, timing, and how to sequence the posts for maximum positioning impact. No filler — concrete guidance only.

#### 3. Refinement (if requested)

If the user asks to revise posts, regenerate, or adjust tone:
- Accept specific feedback per post or per theme cluster
- Never add fluff, hedging, or new ideas not grounded in the interview
- Preserve the voice — do not drift toward LinkedIn motivational-poster territory

### What this skill does not do

- Does not invent experiences the user has not had. Every claim must be grounded in interview answers.
- Does not write hype. Phrases like "AI is transforming everything" or "the future is now" are banned.
- Does not add hashtags, emojis, or CTAs unless the user explicitly requests them.
- Does not summarize sessions to memory.

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| File tools | Read and write `positioning` in `user/config.json` | Ask the user for positioning each session and do not persist it |

No scripts required. This skill is pure instruction.

## Examples

### Example 1: AI-focused ghostwriting (Alex, default 30 posts)

**User:** Write me 30 X posts.

**EDWIN:** _(reads user/config.json, finds `positioning: "AI-driven engineering leader"`)_
> I see your positioning goal is "AI-driven engineering leader." I'll interview you about your AI journey and draft 30 posts. Should take 3-4 exchanges. Ready?

**User:** Yes.

**EDWIN:**
> **Group A — The Journey**
> 1. When did you first start seriously using AI tools in your work or personal projects? What was the context?
> 2. What was the first moment you realized AI had genuinely changed how you work? Describe it specifically.
> 3. What tools or systems have you actually built or meaningfully used? (Not read about — built or used.)
> 4. What failed? What did you try that didn't work, and what did you learn from it?
> 5. What does your current AI workflow look like day-to-day?

_(User answers. EDWIN continues through Group B, Group C, confirms, then generates posts.)_

> I have what I need. I'll now draft 30 posts. They'll span themes of: AI-augmented code review, team adoption friction, redefining engineering craft, and daily workflow integration. Should I proceed?

**User:** Yes.

**EDWIN:**
> **[THEME: MINDSET SHIFT]**
> ---
> Software development velocity is no longer limited by the speed of the keyboard. Generative AI has shifted the constraint from syntax to intent; when we introduce these tools into a team, we are not changing the work—we are changing the cognitive burden of the engineer.
> ---
> [CHAR COUNT: 267] [FORMAT: standalone]
>
> **[THEME: CRAFT REDEFINED]**
> ---
> Resistance to AI integration usually stems from a lack of role clarity. Engineers fear the loss of their craft because we have failed to codify what "craft" means in a post-manual-coding era. The craft is not typing—it is judgment.
> ---
> [CHAR COUNT: 242] [FORMAT: standalone]
>
> _(... 28 more posts across themes...)_
>
> **POSTING STRATEGY NOTE**
> - **Cadence:** 1 post per day, Monday through Friday. Saturate without overwhelming.
> - **Sequencing:** Lead with MINDSET SHIFT posts to establish credibility. Follow with CRAFT REDEFINED to show depth. Alternate TEAM DYNAMICS and DAILY PRACTICE to balance philosophy with pragmatism.
> - **Timing:** Post between 8-10 AM ET when engineering leaders check X before meetings.
> - **Engagement:** Reply to comments on LESSONS LEARNED posts — they invite dialogue. Ignore engagement-bait on MINDSET posts — let them stand as statements.
> - **Iteration:** After 2 weeks, identify which themes got the most meaningful engagement (not just likes — replies from your target audience). Double down on those.

### Example 2: No positioning configured (Sam)

**User:** Ghostwrite some X posts for me.

**EDWIN:** _(reads user/config.json, finds `positioning: ""`)_
> What positioning goal do you want these posts to serve? Examples: "AI-driven engineering leader seeking VP roles," "Technical leader pivoting to product," "Eng leader known for building high-performing teams." Be specific.

**User:** Engineering leader focused on building high-velocity teams without burnout.

**EDWIN:**
> Got it. Want me to save that to your config so I remember it for next time?

**User:** Yes.

**EDWIN:** _(writes to user/config.json)_
> Saved. How many posts do you want? (Default is 30.)
