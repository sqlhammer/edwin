# WU-06: Sync engine + npx installer

**Phase:** 2 · **Size:** M · **Depends on:** WU-01 · **Blocks:** WU-07, WU-12

## Objective
One cross-platform sync engine (Node) that installs/updates EDWIN into the right places for each Claude harness, replacing v0.1's ad-hoc copy scripts. npx remains the developer-friendly entry point.

## Deliverables
1. `tools/sync/engine.mjs` responsibilities:
   - Detect targets: Claude Code (`~/.claude/`), Claude Desktop/Cowork skill locations (research current paths; support both if present).
   - Compose CLAUDE.md from `core/persona/*` + `core/templates/CLAUDE.md.tmpl` + generated skill index (name, description, contexts) + active-context stamp from `user/state.json` if present. Never overwrite a user-customized CLAUDE.md without `--force`; merge EDWIN block via managed markers (`<!-- EDWIN:BEGIN -->`/`END`).
   - Copy skills into harness skill dirs; prune skills EDWIN previously installed but that no longer exist (track via manifest `~/.edwin/installed.json`).
   - Never touch `user/` beyond creating it; never sync it anywhere.
   - `--dry-run`, `--target <code|desktop|all>`, `--uninstall`.
2. npx entry (`bin/edwin-install.mjs`, package.json `bin`): `npx github:sqlhammer/edwin` → clones/updates cached copy, runs engine, prints friendly summary + "restart Claude" reminder. Keep v0.1 command compatibility.
3. `tools/sync/init-user.mjs` and `tools/sync/context.mjs` helper hooks (contracts defined in WU-02/WU-03) live here.
4. `tools/sync/Sync-Edwin.ps1` — PowerShell port of core copy+compose for the no-Node manual path (feature-reduced is acceptable: skills copy + CLAUDE.md compose).

## Implementation notes
- Research current Claude Desktop/Cowork skill directory conventions at build time; isolate paths in one `targets.mjs` module so harness changes are one-file fixes.
- Idempotent: running twice changes nothing the second time.

## Acceptance criteria
- Fresh machine (or clean home dir) → npx command → skills + CLAUDE.md present for Claude Code; re-run is a no-op; `--uninstall` removes only EDWIN-managed files.
- User edits outside EDWIN markers in CLAUDE.md survive re-sync.
- Works on Windows 11 and macOS (CI or manual matrix noted in PR).
