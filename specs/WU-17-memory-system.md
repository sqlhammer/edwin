# WU-17: Memory system

**Phase:** 3 (parallel lane) · **Size:** M · **Depends on:** WU-02, WU-06 · **Blocks:** WU-18

## Objective
EDWIN learns about the user over time like a human assistant — noticing preferences, facts, and patterns worth remembering, confirming before committing them, and recalling them in future sessions. Harness-independent: no reliance on any harness MEMORY.md or built-in memory feature.

## Storage design
All memory lives in `user/memory/` (gitignored, survives updates, never synced off-machine):
- `user/memory/memory.md` — the long-term store. Markdown organized by section (Preferences, People, Work patterns, Facts, Dislikes/never-do). Each entry: one line + metadata comment (date learned, context tag, source: confirmed).
- `user/memory/digest.md` — auto-maintained compact summary (target < 60 lines) of the highest-value entries. This is what rides into every session.
- `user/memory/pending.md` — candidates noticed but not yet confirmed (see capture flow).

## Deliverables
1. **Memory skill** `core/skills/edwin-memory/SKILL.md`:
   - **Capture (observe → propose → confirm):** persona hook (extends `operating-rules.md`) — during conversation EDWIN watches for durable signals: stated preferences ("I hate bullet points"), corrections to EDWIN's behavior, recurring people/projects, stable facts (role, tools, family names *only if volunteered*). Candidates go to `pending.md`. At a natural pause — end of a task, or when pending count ≥ 3 — EDWIN asks once, batched: "I noticed a few things worth remembering: … Keep any of these?" Never mid-task interruptions; never re-proposes a rejected item (rejections logged with a tombstone).
   - **Explicit triggers:** "remember that …", "what do you remember about me / about X?", "forget …", "update: I've changed teams". Forget removes the entry and adds a tombstone.
   - **Recall:** digest is always in context (see #3); for deeper recall the skill instructs reading `memory.md` when a question touches a known section.
   - **Consolidation:** "tidy your memory" (and a suggested monthly cadence via WU-12 scheduler) — merge duplicates, drop stale entries (confirm before deleting), regenerate digest by value ranking (recently used + explicitly confirmed rank highest).
   - **Privacy rules baked into the skill:** never store credentials, health/financial details, or anything about third parties beyond names/roles unless the user explicitly says "remember this"; user can say "go off the record" to suppress capture for the rest of the session.
2. **Script hooks** `tools/memory/memory.mjs` — append/edit/tombstone entries and regenerate digest deterministically when shell exists; documented manual fallback (EDWIN edits the files via harness file tools; in web portals, memory is read-only from the exported digest and EDWIN tells the user to record new memories in their installed EDWIN).
3. **Session injection:** extend the WU-06 sync engine — CLAUDE.md EDWIN block gains a `<!-- EDWIN:MEMORY -->` managed section containing `digest.md`. Re-sync (or the skill's post-update hook) refreshes it. Persona instructs: treat memory as background knowledge, don't recite it unprompted.
4. `core/templates/memory.md.tmpl` + empty-state behavior (fresh user: memory skill explains itself the first time it proposes anything).

## Implementation notes
- Memory is global across contexts; entries carry a context tag used for relevance ranking, not access control.
- Digest size budget is a hard rule — memory must not bloat every context window. Doctor (WU-05) gains a check: digest < 60 lines, memory files parse.
- Onboarding (WU-02) seeds initial entries (name, address-as, contexts) — coordinate the format.

## Acceptance criteria
- Simulated multi-session test: preference stated in session 1 → proposed → confirmed → EDWIN honors it unprompted in session 2 (via stamped digest).
- Rejected candidate is never proposed again; "forget" removes and tombstones; "what do you remember" renders a readable summary grouped by section.
- Digest regeneration keeps under budget with 100+ entries in memory.md.
- Zero memory function depends on harness memory features; works in Claude Code and Cowork; web-portal degradation documented and exported digest works (WU-13 integration).
