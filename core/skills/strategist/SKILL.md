---
name: strategist
description: Structured brainstorming that diverges, stress-tests, and converges to a decision. Use when the user says "help me think through", "brainstorm", "what are my options", "how should I approach", or needs to generate ideas and pressure-test them to make a strategic decision.
contexts: [Work]
version: 1.0.0
requires: []
author: edwin-core
---

# Strategist

## Purpose

Expand the option space, then ruthlessly narrow it to the best path forward. Pressure-test ideas with steel-manning and counter-arguments, always in service of arriving at a decision.

## When to use

- "Help me think through X" / "Brainstorm Y" / "What are my options for Z"
- "How should I approach this" / "What's the best strategy"
- User needs to generate ideas and evaluate them rigorously before deciding

Not for:
- Intellectual debate without a decision goal (use `intellectual-sparing-partner`)
- Project decomposition (use `project-planner`)
- Pure research (use `researcher`)

## Instructions

### 1. Scope

Clarify the challenge:

> What decision, opportunity, or problem are we brainstorming on?

If the user provides it upfront, proceed directly.

Scan the repository or working directory for relevant context. Identify constraints, stakeholders, and success criteria. Restate the challenge as a crisp problem statement:

> Challenge: [one-line problem statement]. Constraints: [list]. Success looks like: [criteria]. Confirm?

Wait for confirmation.

### 2. Diverge

Generate options using multiple lenses. Apply whichever frameworks fit the problem — do not force all of them:

- **First Principles:** Strip to fundamentals. What must be true? What's assumed?
- **Inversion:** What would guarantee failure? Avoid those paths.
- **Analogy:** Who has solved a similar problem in a different domain?
- **SCAMPER:** Substitute, Combine, Adapt, Modify, Put to other use, Eliminate, Reverse.
- **Constraint Removal:** If budget/time/resources were unlimited, what changes?

Rules:
- Generate at least 5 distinct options. Quantity before quality at this stage.
- Include at least one "wild card" — an unconventional or counterintuitive option.
- Present options as a numbered list with a one-line description each.

### 3. Stress-test

For the most promising options (top 3-4), apply rigorous evaluation:

1. **Steel-man each option.** Articulate its strongest case — fill in implicit strengths the user may not have stated.
2. **Counter-argue each option.** Identify:
   - Systemic risks or unintended consequences
   - Flawed underlying assumptions
   - Scalability and sustainability concerns
3. **Compare.** Evaluate options against the success criteria from Phase 1 using a simple scoring table.

Do not concede easily. If the user favours an option, probe for secondary vulnerabilities before agreeing.

### 4. Converge & commit

Recommend the top option(s) with clear reasoning. Deliver a concrete next-step recommendation — not vague advice, but a specific action the user can take now. Briefly note the best fallback if the primary path hits obstacles.

```
**Recommendation:** [Top option]
**Why:** [2-3 sentences]
**Next step:** [Specific action]
**Fallback:** [Alternative if blocked]
```

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| File tools | Scan repository for context | Work from user-provided context only |
| Web search | Research analogous solutions or validate assumptions | Work from general knowledge and user's domain expertise |

No scripts required. This skill is pure instruction.

## Examples

### Example 1: SaaS pricing strategy (Alex)

**User:** How should I approach pricing for my new SaaS product?

**EDWIN:**
> Challenge: Determine pricing model and tiers for a new SaaS product. Constraints: Need to capture value without deterring early adopters. Success looks like: Clear pricing that converts trials to paid users and scales revenue as usage grows. Confirm?

**User:** Yes. It's a developer tool. Current audience is small teams and individual devs, but we want to grow into enterprise.

**EDWIN:**
> **Option 1:** Freemium with usage-based paid tier (free up to X API calls/month, pay per call after)
> **Option 2:** Seat-based pricing ($10/user/month small teams, custom for enterprise)
> **Option 3:** Flat tier pricing ($49/mo starter, $199/mo pro, custom enterprise)
> **Option 4:** Pay-per-success (charge based on outcomes the tool enables, e.g., deploys completed)
> **Option 5 (wild card):** Free forever with support revenue (charge for onboarding, training, SLAs)
>
> Top 3 for stress-test: Options 1, 2, 3. Which feels closest to your intuition, or shall I evaluate all three?

**User:** Evaluate 1, 2, and 3.

**EDWIN:**
> **Option 1 — Freemium + usage-based:**
> - **Steel-man:** Low barrier to entry. Devs try it risk-free. Revenue scales naturally with usage — high-value users pay more.
> - **Counter:** Hard to predict revenue. Freeloaders may never convert. Usage-based pricing can surprise users with bills they didn't expect, causing churn.
> - **Verdict:** Best for tools with clear, measurable usage. Risky if usage doesn't correlate with value.
>
> **Option 2 — Seat-based:**
> - **Steel-man:** Predictable revenue. Easy to understand. Aligns with how devs buy tools (Slack, GitHub, etc.).
> - **Counter:** Penalizes growth — teams hesitate to add seats. Doesn't capture value from power users vs. light users on the same team.
> - **Verdict:** Solid default. Safe, but may leave money on the table if usage varies widely per user.
>
> **Option 3 — Flat tiers:**
> - **Steel-man:** Simple. No usage tracking needed. Easier to sell ("$49/mo gets you everything in Starter").
> - **Counter:** One-size-fits-all rarely fits all. Small teams may find $49 steep; power users may outgrow $199 quickly and need custom pricing.
> - **Verdict:** Works if feature differentiation between tiers is clear and usage doesn't vary dramatically.
>
> **Recommendation:** Option 2 (seat-based) with a generous free tier for solo devs.
> **Why:** Predictable revenue, familiar model for your audience, and enterprise-friendly (they're used to per-seat licensing). Free tier de-risks trial for individuals and captures word-of-mouth.
> **Next step:** Define 3 tiers: Free (1 user, limited features), Team ($10/user/mo, 5-user minimum), Enterprise (custom, volume discounts + support SLA). Test messaging with 5 early users before launch.
> **Fallback:** If per-seat feels wrong after testing, pivot to Option 1 (usage-based) but cap monthly charges to avoid bill shock.

### Example 2: No context files available (Sam)

**User:** Help me think through whether to pivot my startup's product direction.

**EDWIN:**
> Challenge: Decide whether to pivot the product. I don't have access to your repo or background. Tell me:
> 1. What's not working about the current direction?
> 2. What would the pivot be — different market, different feature set, different customer?
> 3. What constraints matter (runway, team skills, existing customers)?
