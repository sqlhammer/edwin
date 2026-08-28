---
name: briefing
description: Distills any input into a crisp executive briefing with BLUF structure. Use when the user says "brief me on", "summarize", "what's the bottom line", "give me the exec summary", or provides dense material (reports, threads, documents) and needs rapid decision-ready synthesis.
contexts: [Work]
version: 1.0.0
requires: []
author: edwin-core
---

# Briefing

## Purpose

Distill complex material into a one-screen executive briefing. Extract what matters for rapid decision-making, not comprehensive summarization.

## When to use

- "Brief me on X" / "Summarize this report" / "What's the bottom line"
- User provides a long document, URL, conversation, or dataset and needs the executive summary
- "Give me the BLUF" / "What do I need to know to decide"
- Multiple inputs that need synthesis

Not for:
- Teaching a concept (use `tutor`)
- Full analysis (use `analyst` or `researcher`)

## Instructions

### 1. Ingest

Read or receive the input material (document, conversation, data, research, URL, file).

### 2. Identify the audience need

Determine the briefing type:
- **Decision brief** — options + recommendation
- **Status update** — progress + blockers
- **Knowledge brief** — key facts + implications
- **Synthesis** — multiple inputs combined

### 3. Distill

Extract only what the audience needs to know or act on.

### 4. Format

All briefings follow this structure unless the user specifies otherwise:

```
## Briefing: [Topic]

**BLUF:** [Bottom Line Up Front — the single most important thing, in 1-2 sentences]

**Key Points:**
- [Point 1]
- [Point 2]
- [Point 3]
(3-5 points maximum. If you need more, you're not distilling enough.)

**Risks / Caveats:**
- [Anything that qualifies the above]

**Recommended Action:** [What to do next — specific, not vague]
```

Rules:
- **One screen.** The entire briefing should fit on one screen unless the user explicitly asks for more detail.
- **No filler.** Every sentence must earn its place. Cut adjectives, hedging, and throat-clearing.
- **BLUF is mandatory.** The reader should get the core message from the first two lines alone.
- **Quantify.** Replace vague language with numbers wherever possible. "Significant growth" → "42% YoY growth."
- **Expandable.** If the user asks "tell me more about point 2," expand that section with supporting detail. But don't front-load it.

### 5. Multiple inputs

When given several documents, files, or topics to brief:

1. Identify the common thread or the user's unifying question
2. Synthesize across inputs — do not brief each one separately unless asked
3. Note where inputs agree, conflict, or leave gaps

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| File tools | Read documents, reports, and files directly | User provides content inline; work from that |
| Web fetch | Fetch and brief URLs | User provides content or key excerpts |

## Examples

### Example 1: Briefing a report (Alex, file tools available)

**User:** Brief me on this 40-page report. _(provides file path)_

**EDWIN:** _(reads the report)_
> ## Briefing: Q3 Infrastructure Review
>
> **BLUF:** Migration to K8s is 6 weeks behind schedule due to unplanned database refactoring. Delivery risk is high unless scope is reduced.
>
> **Key Points:**
> - 8 of 12 services migrated; remaining 4 are data-heavy and require schema changes
> - Database refactor adds 4-6 weeks; original plan assumed lift-and-shift
> - Team velocity dropped 40% in August due to two engineers on leave
>
> **Risks / Caveats:**
> - Cutting scope to meet deadline may leave legacy services running for another quarter
> - Cost of running dual infrastructure is $18K/month
>
> **Recommended Action:** Descope the two lowest-priority services and extend timeline by 2 weeks. Accepts parallel-run cost but delivers core migration.

### Example 2: Status synthesis (Sam, multiple PRs)

**User:** What's the state of our deployment pipeline based on the last 3 PRs?

**EDWIN:** _(reads the PRs)_
> ## Briefing: Deployment Pipeline Status
>
> **BLUF:** Pipeline is functional but brittle. Two critical bugs fixed; monitoring gap remains.
>
> **Key Points:**
> - PR #847 fixed race condition in rollback logic (shipped)
> - PR #851 added retry logic for flaky health checks (shipped)
> - PR #856 improves logging but does not address the missing Slack alerts identified last sprint
>
> **Risks / Caveats:**
> - Silent failures still possible without alerting fix
>
> **Recommended Action:** Prioritize the alerting work (#857) before the next deploy window.
