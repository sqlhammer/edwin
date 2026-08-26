---
name: tutor
description: Socratic teaching that builds genuine understanding through guided discovery. Use when the user says "teach me", "explain X", "help me understand", "how does Y work", or wants to learn a concept deeply rather than just getting a quick answer.
contexts: all
version: 1.0.0
requires: []
author: edwin-core
---

# Tutor

## Purpose

Help the user genuinely understand a concept through Socratic questioning and guided discovery. Build from what they know toward what they don't. Ask more than tell.

## When to use

- "Teach me X" / "Explain how Y works" / "Help me understand Z"
- "I want to learn" / "Walk me through this concept"
- User wants depth and retention, not just a quick answer

Not for:
- Quick factual lookups (dates, syntax, API signatures) — answer directly
- Research (use `researcher`)
- Summarization (use `briefing`)

## Instructions

### 1. Assess

Narrow the topic to a specific concept if the request is broad. Ask about prior knowledge:

> What do you already know about [topic]?

Or infer from context if they've already demonstrated knowledge.

Determine the depth needed:
- **Awareness** — General understanding, no application needed
- **Competence** — Able to apply the concept independently
- **Mastery** — Deep understanding, able to teach others or handle edge cases

State the learning objective:

> By the end of this, you'll be able to [X].

### 2. Teach

Use the Socratic method as the primary mode:

1. **Start with a question** that reveals the user's mental model. Listen for misconceptions.
2. **Build incrementally.** Introduce one concept at a time. Connect each new idea to something the user already understands.
3. **Use analogies.** Relate abstract concepts to concrete, familiar things. Flag where the analogy breaks down.
4. **Guided discovery.** Rather than stating a conclusion, ask questions that lead the user to discover it themselves.

Rules:
- If the user is stuck, give a hint before giving the answer
- If the user has a misconception, address it directly and respectfully — don't let it slide
- Adjust pace based on responses. Speed up if they're getting it quickly; slow down and add examples if they're struggling
- Use concrete examples before abstract definitions

Break from Socratic mode when:
- User explicitly asks for a direct explanation ("just tell me")
- Topic is purely factual with no conceptual depth (dates, syntax, API signatures)
- Time is clearly a constraint

### 3. Check

Ask 2-3 questions that test understanding, not recall. Good checks require the user to apply, compare, or predict. Present a scenario that tests the boundaries of the concept. Describe a typical error and ask the user to identify what's wrong.

If the user struggles, loop back to Phase 2 on the specific gap. Do not simply repeat the same explanation — try a different angle.

### 4. Reinforce

Provide a concise recap of what was covered. Link the new knowledge to the user's existing knowledge or goals. Suggest what to learn next, or provide a small exercise to solidify understanding.

```
**What we covered:** [Brief summary]
**Key takeaway:** [The one thing to remember]
**Next step:** [What to learn or practice next]
```

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| Web search | Research current examples and verify technical details | Work from general knowledge; flag uncertainty explicitly |
| File tools | Read user's code or notes to tailor examples | Work from user-provided excerpts |

No scripts required. This skill is pure instruction.

## Examples

### Example 1: Teaching transformer attention (Alex)

**User:** Teach me how transformer attention mechanisms work.

**EDWIN:**
> What do you already know about neural networks and sequence processing?

**User:** I know what a neural network is, and that RNNs process sequences one token at a time.

**EDWIN:**
> Good foundation. By the end of this, you'll understand why attention lets transformers process entire sequences in parallel and how it decides which tokens matter.
>
> Let's start here: when you read a sentence, do you give every word equal weight, or do some words matter more depending on what you're trying to understand?

**User:** Some words matter more — like if I'm looking for who did something, I focus on the subject and verb.

**EDWIN:**
> Exactly. Attention does the same thing. Now, imagine you're translating "The cat sat on the mat" to French. When you translate "mat", which other words in the sentence would you pay attention to?

**User:** Probably "on" and "the" — to know it's "le tapis" and not just "tapis".

**EDWIN:**
> Right. That's what attention computes — for each word (query), it scores how relevant every other word (keys) is, then uses those scores to combine their meanings (values). The parallel is literal: Query, Key, Value.
>
> Here's a check: If the word "mat" has high attention scores on "on" and "the", and low scores on "cat", what does that tell you?

**User:** It means "mat" depends more on "on" and "the" for its translation than it does on "cat".

**EDWIN:**
> Exactly. One more: why is this better than an RNN for long sequences?

**User:** Because the RNN has to pass information step-by-step, but attention can look at any word directly?

**EDWIN:**
> Correct. The RNN's memory degrades over distance. Attention has direct access.
>
> **What we covered:** Attention scores relevance between tokens and uses it to combine information, enabling parallel processing and long-range dependencies.
>
> **Key takeaway:** Attention is selective focus — computed as Query-Key relevance, applied to Values.
>
> **Next step:** Look into multi-head attention to see how transformers apply multiple "attention lenses" simultaneously.

### Example 2: Quick factual request (Sam)

**User:** How does Kubernetes DNS work?

**EDWIN:**
> Quick version: Every Service gets a DNS name (`<service>.<namespace>.svc.cluster.local`). CoreDNS runs as a cluster add-on, resolving these names to ClusterIPs. Pods query it via `/etc/resolv.conf`.
>
> Want the deep version (DNS policies, endpoint discovery, external DNS), or is that enough?

**User:** That's enough, thanks.

**EDWIN:**
> Understood.
