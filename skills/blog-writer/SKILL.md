---
name: blog-writer
description: Research-backed blog post drafting and revision. Use when the user says "write a blog post", "draft a post about", "revise this blog", or wants to create or edit long-form content with research, style guidance, leadership positioning, and image recommendations.
contexts: all
version: 1.0.1
requires: [web-search]
author: edwin-core
---

# Blog Writer

## Purpose

Draft and revise research-backed blog posts with style guidance, leadership positioning, and image recommendations. Enforces correctness over creativity — every factual claim requires a source.

## When to use

- "Write a blog post about X" / "Draft a post on Y"
- "Revise this blog post" / "Improve my draft"
- User wants long-form content (500-2000+ words) with research backing

Not for:
- Social media posts (use `x-ghostwriter`)
- Quick summaries (use `briefing`)
- Technical documentation (different format)

## Instructions

### Governing constraints

These override everything else, in order:

1. **Correctness first.** Every factual claim requires a source: a file path, a URL, or an explicit flag of "Based on general knowledge — unverified." No statistics or specific numbers without a named source. If a claim cannot be verified, do not include it — flag the gap and ask the user to fill it.
2. **No fabrication.** Do not invent experiences, outcomes, or quotes the user has not confirmed.
3. **No hype.** Phrases like "revolutionary," "game-changing," "the future of," or "transforming everything" are banned.
4. **No confirmation, no draft.** Do not write prose until both style and leadership inputs are confirmed.

### Operating modes

Detect mode from the invocation:
- User provides a topic → **NEW POST mode**
- User says "revise" or provides an existing draft → **REVISION mode**

---

## NEW POST MODE

### 1. Orient

Confirm the topic (restate your understanding if provided in args), then present the following defaults as a ready-to-confirm block. The user can reply "confirmed" to accept all, or name only the fields they want to change.

```
Topic:    [restate topic]
Audience: Engineering Managers and CTOs  ← change?
Platform: Personal blog                  ← change?
Length:   Standard (~1,000 words)        ← change? (Short ~500 / Long ~2,000+)
```

Wait for confirmation before Phase 2.

### 2. Research

Run both in parallel:

**Vault search (if applicable):**
- Read `user/config.json` for `paths.notes` (Obsidian vault or notes directory)
- If present, search that directory for notes related to the topic using file tools
- Report: files found, how each relates to the topic, key claims or facts with file path citations
- If no `paths.notes` or no relevant files, state that clearly

**Web research:**
If the topic involves facts, data, trends, technical claims, or industry context, use web search to find current, credible sources. For each fact:
- Cite the source (URL)
- Assign a confidence level: **High** (multiple credible sources agree) / **Medium** (limited sources or some ambiguity) / **Low** (single source, indirect, or significant uncertainty)

Output a **Research Summary:**

```
**Notes Found:** [list with file paths, or "None" / "No notes directory configured"]
**Web Sources:** [list with credibility notes]
**Verified Facts to Use:** [list with confidence levels]
**Gaps Requiring User Input:** [facts you could not verify — do not include these in the draft without user confirmation]
```

### 3. Leadership extraction

Ask the user 2-4 targeted questions to surface outcome-oriented and systems-thinking content. Select only the questions most relevant to the topic — do not present the full bank. Present as a numbered list and wait for answers.

Question banks (Outcomes, Systems thinking, Credibility) are in `reference/leadership-questions.md`.

Wait for answers before Phase 4.

### 4. Style selection

Read `reference/writing-styles.md` for detailed style guide definitions. Analyze the topic, audience, and user's Phase 3 answers. Recommend one style:

**Standard Style** — Best for: technical deep-dives, engineering leadership, process/systems posts, how-to guides, thought leadership on tooling or methodology. Tone: authoritative mentor, systems language, Anchor Lead structure.

**Narrative Style** — Best for: personal experience posts, career reflections, culture and mindset pieces, posts with a strong emotional arc or a pivotal "aha moment." Tone: visceral and atmospheric, sensory groundedness, constraint-driven pacing.

Output your recommendation:

```
**Recommended Style:** [Standard / Narrative]
**Reason:** [2-3 sentences explaining why this style fits the topic, audience, and content]
**Alternative:** [One sentence on when the other style would be the stronger choice]
```

Wait for explicit confirmation before writing. If the user overrides your recommendation, apply the chosen style without comment.

### 5. Draft

Write the post according to the confirmed style guide (see `reference/writing-styles.md` for full syntactic rules, lexicon, and structural flow).

**Image recommendations** — embed inline wherever an image would materially aid comprehension or engagement:

```
[IMAGE RECOMMENDATION]
Location: [where in the post — e.g., "After the opening paragraph"]
Description: [Specific enough to generate or commission — subject, composition, mood, key visual elements]
Why: [What this image accomplishes for the reader — clarifies, anchors, creates contrast, etc.]
Style: [e.g., clean technical diagram, photorealistic, abstract/conceptual, annotated screenshot]
[/IMAGE RECOMMENDATION]
```

A standard 1,000-word post warrants 1-2 recommendations. Long-form may have 3. Do not cluster them.

After the full draft, attempt to generate recommended images using available tools. If image generation is unavailable in this session, output a standalone **Image Generation Prompts** section with one detailed prompt per recommendation, ready to paste into an image generation tool.

### 6. File output

**If `user/config.json` contains `paths.blogDrafts`:**
Write the draft to that location using the folder structure and frontmatter template in `reference/file-structure.md`. Create directories if they do not exist.

**If no `paths.blogDrafts` configured:**
Print the draft with frontmatter and offer to save the path to `user/config.json` for future sessions.

After writing or printing, confirm the full file path (if written) and provide a one-sentence summary of what was written.

---

## REVISION MODE

Invoked when the user says "revise" or provides an existing draft.

### 1. Intake

Read the existing post. If a file path was given, read it directly. If a description was given, search the configured notes directory for the matching file. If the user provided the draft inline, work from that.

Output a **Diagnostic Summary:**

```
**File:** [path, or "provided inline"]
**Current Style:** [Standard / Narrative / Mixed / Unclear]
**Approximate Word Count:** [estimate]
**Strengths:** [what is working — be specific]
**Issues Identified:**
  - Unverified or uncited factual claims
  - Style inconsistencies or drift
  - Weak outcome/leadership framing
  - Missing systems thinking angle
  - Structural problems
  - Image opportunities not taken
```

### 2. Revision brief

Propose a revision plan specifying:
- What will change and why
- Whether the style will be preserved or adjusted (with reasoning)
- Any leadership questions you need answered to strengthen the piece

Wait for approval before making changes.

### 3. Revise

Apply the approved changes. All governing constraints from New Post mode apply:
- Correctness first — flag or remove any unverified claims before strengthening prose
- Embed image recommendations where they add value
- Strengthen systems thinking and outcome framing wherever the user's answers allow

**If working with a file:**
Write the revised file in the same folder as the original with a version suffix: `{post-slug}-v2.md`. Increment if v2 already exists. **Never overwrite the original.**

**If working inline:**
Output the revised draft in full.

After writing, confirm the new file path (if written) and provide a bulleted list of the key changes made.

---

## Optional script hooks

None. This skill uses file tools and web search directly.

---

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| File tools | Read user's notes, write drafts to configured directory | Print draft for user to save manually; ask for inline note excerpts |
| Web search | Research facts, trends, and current data | Work from user-provided sources and general knowledge; flag all findings as unverified |
| Image generation | Generate recommended images inline | Provide detailed prompts for manual generation |

---

## Examples

### New post (Alex, all tools available)

**User:** Write a blog post about adopting AI code review in engineering teams.

**EDWIN:**
> Topic: Adopting AI code review in engineering teams
> Audience: Engineering Managers and CTOs  ← change?
> Platform: Personal blog                  ← change?
> Length:   Standard (~1,000 words)        ← change?

**User:** Confirmed.

**EDWIN:** _(searches configured notes directory and web)_
> **Notes Found:** None (no notes directory configured)
> **Web Sources:**
>   - GitHub Copilot adoption study (Microsoft, 2023) — credible
>   - Anthropic Claude code review case studies — credible
> **Verified Facts to Use:**
>   - 55% of developers report faster code review with AI assistance (Confidence: High)
>   - AI catches style/syntax issues 2-3x faster than manual review (Confidence: Medium)
> **Gaps Requiring User Input:** No data on human-AI disagreement rates or false positive handling.
>
> **Leadership questions:**
> 1. Have you introduced AI code review to a team? What resistance did you encounter?
> 2. What metrics did you use to measure success — review time, bug catch rate, team satisfaction?
> 3. What's the honest caveat a leader needs to know before rolling this out?

_(User answers. EDWIN recommends Standard Style, waits for confirmation, then drafts the post and writes it to the configured directory.)_

Additional examples (revision mode) are in `reference/examples.md`.
