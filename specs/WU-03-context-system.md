# WU-03: Context system

**Phase:** 1 · **Size:** M · **Depends on:** WU-01, WU-02

## Objective
Implement contexts: named groupings of skills (e.g., Work, Home) plus a Global context that exposes everything. All skills remain available in all contexts; the active context biases navigation, suggestions, and reasoning.

## Deliverables
1. `core/contexts/contexts.json` schema + defaults:
   ```json
   {
     "contexts": [
       {"name": "Global", "builtin": true, "description": "Everything at once"},
       {"name": "Work", "description": "..."},
       {"name": "Home", "description": "..."}
     ]
   }
   ```
   Skill→context mapping lives in each skill's frontmatter `contexts:` list (single source of truth); `contexts.json` defines the contexts themselves. Users may add/rename/remove contexts (Global cannot be removed).
2. **Context manager skill** `core/skills/edwin-context/SKILL.md` handling, via chat: "switch to Work", "what context am I in", "create a context called Travel", "put the researcher skill in Home", "list my skills" (grouped by context, active context first). Writes `user/state.json` and skill frontmatter/context file through script hook `tools/sync/context.mjs` when shell exists; via harness file tools otherwise.
3. Persona integration: extend `operating-rules.md` (from WU-02) with the concrete bias behavior — in a non-Global context, when suggesting skills or resolving ambiguous requests, prefer the active context's skills; mention out-of-context matches briefly ("the *invoice-tracker* skill from your Work context also fits — want it?"). In Global, no bias.
4. Bundle/export awareness: contexts are the unit of export for web portals (consumed by WU-13) — document this in `contexts.json` comments.

## Implementation notes
- Active context must survive restarts: it's in `user/state.json`, and the generated CLAUDE.md instructs EDWIN to read it at session start (or the sync engine stamps it in).
- Renaming a context must update all skill frontmatter tags — that's why the script hook matters; define the manual fallback steps too.

## Acceptance criteria
- Switching contexts via chat updates state and demonstrably changes skill listing order/bias in a test conversation.
- Global context lists every skill; deleting Global is refused.
- Creating a context and assigning skills works end-to-end via chat only.
