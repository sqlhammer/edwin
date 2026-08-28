# WU-08: Claude plugin/marketplace packaging

**Phase:** 2 · **Size:** M · **Depends on:** WU-01, WU-04

## Objective
Package EDWIN as a proper Claude Code plugin (installable via plugin marketplace mechanics) so users on Claude Code and Cowork get native install, discovery, and updates.

## Deliverables
1. Plugin manifest per current Anthropic plugin spec (research at build time: `.claude-plugin/plugin.json`, marketplace.json conventions) exposing:
   - All `core/skills/*` as plugin skills.
   - EDWIN persona delivered via the plugin's supported mechanism (plugin-level CLAUDE.md/instructions if supported; otherwise the plugin ships an `edwin-activate` skill that installs the persona via the WU-06 engine).
2. Marketplace repo structure (either in-repo marketplace or separate `sqlhammer/edwin-marketplace`) so users run a single `/plugin marketplace add sqlhammer/edwin` + `/plugin install edwin` flow.
3. Build script `tools/bundle/build-plugin.mjs` that generates the plugin layout from `core/` sources — single source of truth, no hand-maintained duplicates.
4. Compatibility statement documented: plugin path (Code/Cowork) vs. sync path (WU-06) can coexist; installed.json manifest prevents double-management.

## Implementation notes
- The plugin ecosystem is evolving; pin what's verified today and isolate assumptions in the build script.
- Confirm Cowork consumes the same plugin format; if not, document the delta and fall back to sync-engine install for Cowork.

## Acceptance criteria
- `/plugin install` on a clean Claude Code yields working EDWIN skills; skill descriptions render in discovery.
- Generated plugin passes any available plugin validation tooling.
- Build script regenerates the package deterministically from source.
