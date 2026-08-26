# Roadmap — v0.3

Everything deliberately left out of v0.2. Each item records *why* it was deferred, so the decision does not
have to be reconstructed later. Nothing here is a defect; defects are in the CHANGELOG.

## Portal adapters

**Deeper Gemini and Copilot support.** v0.2 exports a single instructions file per portal and, for portals
that cannot take knowledge files, a condensed variant. That is the lowest common denominator.

- Gemini Gems and Copilot both have their own file-attachment and instruction models that a purpose-built
  adapter could use properly rather than approximating.
- `tools/bundle/portal-limits.json` records Claude Projects' and Gemini's instruction limits as unknown
  because neither is published. EDWIN reports the size and says so rather than guessing. If those limits
  become documented, set `verified: true` and the truncation path becomes usable for them.
- No portal has a refresh mechanism, so a bundle goes stale the moment skills change. A "what changed since
  your last export" diff would make re-uploading cheap enough to actually do.

## Observation-mode enrichment

`edwin-workflow-analyzer` can learn a workflow either by interview or by watching the current conversation.
Observation mode currently confirms what it saw and fills gaps; it does not yet:

- Persist partial observations across sessions, so a workflow spread over two days must be re-described.
- Distinguish the steps that varied between two runs from the steps that were identical — which is exactly
  where the decision points in a workflow live.
- Notice a workflow that spans skills rather than living inside one.

## Additional baseline skills

v0.2 ships 23 skills plus one persona. The gaps that came up during the rebuild and were not in scope:

- A meeting-notes-to-actions skill (adjacent to `briefing`, but the output is a task list, not a summary).
- A code-review persona, distinct from `intellectual-sparing-partner`.
- A decision-log skill that pairs with `edwin-memory` — recording *why* something was chosen, which is the
  thing nobody writes down and everybody later needs.

## Testing

- The v0.2 matrix has 19 manual cells (see [testing/manual-test-script.md](testing/manual-test-script.md)).
  Windows behaviour, Gatekeeper double-click, and web-portal upload are the three that most want automating,
  and all three need CI on a second OS rather than cleverness.
- Conversational behaviour — does EDWIN actually route to the right skill, does it actually stay concise —
  is asserted by a human reading transcripts. A prompt-level eval suite would turn the persona's
  conciseness mandate into something enforceable instead of aspirational.
- No test yet covers a real update over a real prior install; `6.1` in the manual script does it by hand.

## Framework

- Skills carry `requires:` in frontmatter but nothing enforces it at install time. A skill that needs Node
  should refuse to install into a harness without it, or install in degraded form and say so.
- Memory consolidation is manual. It should offer itself when the digest approaches its budget rather than
  waiting to be asked.
- The persona is composed at sync time, so a persona change requires a re-sync. Users will forget. Either
  detect drift on session start or make the sync cheap enough to run unconditionally.
