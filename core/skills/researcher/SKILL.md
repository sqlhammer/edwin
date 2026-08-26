---
name: researcher
description: Deep research with source evaluation and synthesis. Use when the user says "research X", "investigate Y", "what's known about", "find information on", or needs thorough investigation of a topic with credibility assessment and confidence levels on findings.
contexts: all
version: 1.0.0
requires: [web-search, web-fetch]
author: edwin-core
---

# Researcher

## Purpose

Investigate thoroughly, evaluate sources critically, and synthesize findings into clear, actionable intelligence. Never present speculation as fact.

## When to use

- "Research X" / "Investigate this topic" / "What's known about Y"
- "Find information on" / "Look into" / "What does the literature say"
- User needs thorough investigation with source credibility and confidence levels

Not for:
- Analyzing provided data (use `analyst`)
- Summarizing known material (use `briefing`)
- Teaching a concept (use `tutor`)

## Instructions

### 1. Brief

Define or clarify the research question. Determine scope: breadth vs. depth, time horizon, domain boundaries. Restate the research brief:

> I'll investigate: [research question]. Scope: [parameters]. Confirm?

Wait for confirmation before proceeding.

### 2. Gather

Search broadly using web search, file reads, and any available tools to collect relevant information.

Evaluate each source:
- **Credibility:** Who authored it? What's their authority?
- **Recency:** How current is this information?
- **Corroboration:** Do other sources agree?

Flag gaps: identify areas where information is thin, contradictory, or missing entirely.

Rules:
- Prefer primary sources over secondary
- When sources conflict, present both positions rather than picking one silently
- Never fabricate citations. If working from training knowledge, say "Based on general knowledge" explicitly

### 3. Synthesize

Cross-reference findings to identify consensus and conflicts. Extract themes, trends, or causal relationships. Assign confidence levels to each key finding:
- **High** — Multiple credible sources agree
- **Medium** — Limited sources or some ambiguity
- **Low** — Single source, indirect evidence, or significant uncertainty

### 4. Deliver

Present findings in this format:

```
**Research Question:** [The question]

**BLUF:** [Bottom Line Up Front — 1-2 sentences]

**Key Findings:**
1. [Finding] — Confidence: [High/Medium/Low]
2. [Finding] — Confidence: [High/Medium/Low]
3. ...

**Open Questions:** [What remains unclear or unresolved]

**Sources:** [List of sources used, with brief credibility notes]
```

Keep the briefing tight. Expand only if the user asks for more detail on a specific finding.

## Optional script hooks

None. This skill uses web search and web fetch capabilities directly via the harness.

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| Web search | Research live sources | Work from file-based sources and general knowledge; flag all findings as "unverified — no search available" |
| Web fetch | Retrieve full articles and documents | Work from search snippets and general knowledge |
| File tools | Read local documents and notes | Work from user-provided excerpts |

## Examples

### Example 1: LLM fine-tuning research (Alex, web search available)

**User:** Research the current best practices for fine-tuning LLMs on domain-specific data.

**EDWIN:**
> I'll investigate: What are the current best practices for fine-tuning LLMs on domain-specific data? Scope: Technical approaches, data requirements, common pitfalls. Confirm?

**User:** Yes.

**EDWIN:** _(searches and evaluates sources)_
> **Research Question:** What are the current best practices for fine-tuning LLMs on domain-specific data?
>
> **BLUF:** Quality over quantity — curated datasets of 1K-10K examples outperform larger noisy sets. Parameter-efficient methods (LoRA, QLoRA) dominate due to cost and speed.
>
> **Key Findings:**
> 1. LoRA and QLoRA reduce training costs by 60-90% with minimal accuracy trade-off (Confidence: High — multiple papers + industry adoption)
> 2. Dataset quality trumps size: 5K curated examples often beat 100K scraped examples (Confidence: High — Anthropic, OpenAI guidance agrees)
> 3. Instruction tuning format (prompt + completion pairs) outperforms completion-only for task-specific fine-tuning (Confidence: High)
> 4. Validation on held-out data critical — overfitting occurs rapidly with small domain datasets (Confidence: High)
> 5. Recommended split: 70/15/15 train/val/test for datasets under 10K examples (Confidence: Medium — varies by source)
>
> **Open Questions:** Optimal learning rates for different model sizes remain empirical; no unified guidance.
>
> **Sources:**
> - Hu et al. (2021) "LoRA: Low-Rank Adaptation" (original paper, widely cited)
> - Dettmers et al. (2023) "QLoRA" (NIPS paper, high credibility)
> - Anthropic Claude fine-tuning docs (official, current)
> - OpenAI fine-tuning guide (official, current)

### Example 2: No web search available (Sam, web portal)

**User:** Research the latest trends in edge computing.

**EDWIN:**
> I'll investigate: Latest trends in edge computing. Scope: Current approaches, adoption drivers, key challenges. Confirm?

**User:** Yes.

**EDWIN:**
> **Research Question:** Latest trends in edge computing
>
> **BLUF:** Web search unavailable — working from general knowledge only. All findings unverified.
>
> **Key Findings:**
> 1. Edge AI inference growing due to latency and privacy requirements (Confidence: Low — based on general knowledge, unverified)
> 2. 5G enabling denser edge deployments (Confidence: Low — unverified)
> 3. Kubernetes at the edge gaining adoption for orchestration (Confidence: Low — unverified)
>
> **Open Questions:** Unable to verify current adoption rates, vendor landscape, or recent case studies without search.
>
> **Sources:** General knowledge only. Recommend running this research with web access for credible, current findings.
