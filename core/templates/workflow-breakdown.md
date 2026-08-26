<!--
HANDOFF CONTRACT TO edwin-skill-creator (WU-10)

This template documents a user's workflow in their own words. The skill creator reads it to generate a SKILL.md file.

REQUIRED FIELDS (frontmatter):
- name: kebab-case skill name, used verbatim as the skill directory and frontmatter `name`
- proposedDescription: trigger-optimized description per conventions §3.1 — lift this directly into the skill frontmatter with minimal editing
- proposedContexts: array of context names or "all" — confirms with user before finalizing

REQUIRED SECTIONS (body):
- What this workflow does: single paragraph, used to generate the skill's ## Purpose
- When I use it: bulleted trigger phrases in the user's own words — becomes ## When to use
- What I need before I start: inputs and prerequisites — informs the skill's ## Instructions opening
- The steps: numbered procedure, including decision points — becomes the core of ## Instructions
- What it produces: outputs and deliverables — mentioned in ## Purpose or ## Instructions closing

OPTIONAL SECTIONS (body, may be absent):
- Tools and integrations: if present, informs skill's `requires:` frontmatter and ## Optional script hooks
- How I know it worked: quality checks — folded into ## Instructions if substantive
- What can go wrong: exceptions and edge cases — may become a subsection or handled inline in ## Instructions

ASSUMPTIONS:
1. The file is prose written in the user's voice, NOT framework jargon. The skill creator must preserve this register.
2. Trigger phrases are literal — the words the user would actually say. Use them to generate the skill's trigger-optimized description.
3. Steps may include conditionals ("If X, then Y") — these become conditional instructions in the skill.
4. If "Tools and integrations" mentions a specific script, file, or API, the skill creator notes it in `requires:` but designs graceful degradation per conventions §6.

This contract is the source of truth. Any field or section the skill creator needs must be listed above.

See workflow-breakdown.example.md in this folder for a filled-in breakdown.
-->

---
name: example-workflow
proposedDescription: Brief description of what this workflow does. Second sentence names when to use it, using the trigger phrases the user would actually say.
proposedContexts: [Work]
---

# Example Workflow Breakdown

## What this workflow does

A single paragraph describing the goal and outcome of this workflow, written as the user would describe it to a colleague.

## When I use it

- "trigger phrase one"
- "another way I'd say it"
- "or this phrasing"

## What I need before I start

- Input or prerequisite one
- Input or prerequisite two
- Any accounts, files, or context needed

## The steps

1. First step of the workflow.
2. Second step. If [condition], then [alternative action].
3. Third step, including what to look for or verify.
4. Continue until the workflow is complete.

## What it produces

- Primary deliverable or outcome
- Secondary outputs, if any

## Tools and integrations

- Tool or system touched (e.g., "Slack API", "Google Sheets", "the project tracker")
- Script or command used, if applicable

## How I know it worked

- Success indicator one
- Success indicator two

## What can go wrong

- Exception or edge case: how to handle it
- Another failure mode: recovery steps
