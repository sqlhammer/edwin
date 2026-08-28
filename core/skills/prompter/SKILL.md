---
name: prompter
description: Master-level AI prompt optimization using the 4-D methodology. Use when the user says "optimize this prompt", "improve my prompt", "help me write a prompt for", "make this prompt better", or provides a weak/ambiguous prompt that needs structure and precision.
contexts: all
version: 1.0.0
requires: []
author: edwin-core
---

# Prompter

## Purpose

Transform any user input into precision-crafted prompts that unlock AI's full potential using the 4-D methodology: Deconstruct, Diagnose, Develop, Deliver.

## When to use

- "Optimize this prompt" / "Improve my prompt" / "Make this better"
- "Help me write a prompt for X" / "How should I phrase this"
- User provides a weak or ambiguous prompt that needs structure

Not for:
- General writing help (stay focused on AI prompts)
- Teaching about prompting concepts (use `tutor` for that)

## Instructions

### 1. Deconstruct

Extract core intent, key entities, and context. Identify output requirements and constraints. Map what's provided vs. what's missing.

### 2. Diagnose

Audit for clarity gaps and ambiguity. Check specificity and completeness. Assess structure and complexity needs.

Auto-detect complexity:
- **Simple tasks** → BASIC mode (quick fix primary issues, apply core techniques only)
- **Complex/professional** → DETAIL mode (gather context, ask 2-3 targeted clarifying questions, provide comprehensive optimization)

Inform user of mode with override option if DETAIL mode selected.

### 3. Develop

Select optimal techniques based on request type:
- **Creative** → Multi-perspective + tone emphasis
- **Technical** → Constraint-based + precision focus
- **Educational** → Few-shot examples + clear structure
- **Complex** → Chain-of-thought + systematic frameworks

Assign appropriate AI role/expertise. Enhance context and implement logical structure.

Optimization techniques:
- **Foundation:** Role assignment, context layering, output specs, task decomposition
- **Advanced:** Chain-of-thought, few-shot learning, multi-perspective analysis, constraint optimization

### 4. Deliver

Present the optimized prompt using the appropriate format:

**Simple requests:**

```
**Your Optimized Prompt:**
[Improved prompt]

**What Changed:** [Key improvements]
```

**Complex requests:**

```
**Your Optimized Prompt:**
[Improved prompt]

**Key Improvements:**
• [Primary changes and benefits]

**Techniques Applied:** [Brief mention]

**Pro Tip:** [Usage guidance]
```

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| Web search | Research current best practices for specific prompt types | Work from general knowledge of prompt engineering |

No scripts required. This skill is pure instruction.

## Examples

### Example 1: Simple prompt optimization (Alex)

**User:** Optimize this prompt: "Write a blog post about AI"

**EDWIN:**
> **Your Optimized Prompt:**
>
> You are an experienced technical blogger writing for software engineers. Write a 1,000-word blog post that explains how transformer models work, focusing on practical applications and avoiding marketing hype. Include concrete examples and a clear thesis statement. Target audience: mid-level engineers with basic ML knowledge.
>
> **What Changed:** Added role, audience, length, tone, and specificity. Original was too vague — "about AI" could mean anything. Now the AI knows what to write, for whom, and how.

### Example 2: Complex prompt optimization (Sam)

**User:** I need a prompt to help me analyze customer feedback and prioritize feature requests. It should be data-driven and consider business impact.

**EDWIN:**
> DETAIL mode — I'll ask a few questions to optimize this properly.
>
> 1. What format is the feedback in? (structured survey data, free-text support tickets, feature request forms?)
> 2. What does "business impact" mean for you? (revenue potential, user retention, strategic alignment?)
> 3. What's your output goal — a ranked list, a decision matrix, a report?

**User:** Free-text support tickets. Business impact means user retention — we're worried about churn. Output should be a ranked list with justification.

**EDWIN:**
> **Your Optimized Prompt:**
>
> You are a product analyst specializing in customer retention. I will provide free-text support tickets containing feature requests and feedback. Your task:
>
> 1. Extract distinct feature requests from the tickets
> 2. Group similar requests and count frequency
> 3. Assess each request's impact on user retention using these signals:
>    - Frequency of the request (high repetition = high churn risk)
>    - Severity of user frustration in the language used
>    - Whether the request relates to a core workflow vs. edge case
> 4. Output a ranked list (highest to lowest retention impact) with:
>    - Feature name
>    - Retention impact score (1-10)
>    - Supporting evidence (ticket excerpts and frequency count)
>
> Format: Markdown table for easy sharing with the product team.
>
> **Key Improvements:**
> • Defined the analysis framework (frequency, frustration, core vs. edge) so the AI doesn't guess
> • Specified output format and structure for decision-making
> • Anchored "business impact" to retention with concrete signals
>
> **Techniques Applied:** Task decomposition, output specification, constraint optimization
>
> **Pro Tip:** Feed this prompt 10-15 tickets at a time to avoid overwhelming the context window. Aggregate results across batches.
