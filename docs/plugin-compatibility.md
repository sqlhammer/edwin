# Plugin and Sync Engine Compatibility

This document describes how EDWIN's two installation paths — the Claude Code plugin and the sync engine — coexist without conflict.

## Two Installation Paths

EDWIN can be installed in two ways:

1. **Plugin path** (`/plugin install edwin`): Installs skills via the Claude Code plugin system. Skills appear in `~/.claude/plugins/<marketplace>/edwin/skills/`.

2. **Sync engine path** (`npx github:sqlhammer/edwin`): Installs skills directly to `~/.claude/skills/` and persona to `~/.claude/CLAUDE.md` via the sync engine (`tools/sync/engine.mjs`).

## How They Coexist

### Different Skill Directories

- **Plugin skills**: Read from the plugin installation directory, managed by Claude Code's plugin system.
- **Sync engine skills**: Copied to `~/.claude/skills/`, managed by the sync engine.

These are physically separate directories, so skills from one path do not overwrite skills from the other at the filesystem level.

### Persona Installation

The plugin does **not** automatically install the EDWIN persona into `~/.claude/CLAUDE.md`. Users must:

1. Install the plugin: `/plugin install edwin`
2. Activate the persona: `/edwin-activate` (invokes the sync engine from the plugin directory)

The `edwin-activate` skill checks for an existing sync-engine installation before proceeding.

## Double-Management Prevention

The sync engine maintains a manifest at `~/.edwin/installed.json` that tracks which skills it has installed:

```json
{
  "schemaVersion": 1,
  "version": "0.2.0",
  "lastSync": "2026-08-26T...",
  "targets": ["code"],
  "skills": {
    "analyst": { "hash": "abc123..." },
    "briefing": { "hash": "def456..." }
  }
}
```

### Detection Logic

The `edwin-activate` skill (shipped with the plugin) checks this manifest before installing the persona:

- **If `~/.edwin/installed.json` exists and lists skills**: The sync engine has already installed EDWIN. The `edwin-activate` skill aborts with a message: "You already have EDWIN installed via the sync engine. The persona is active. No activation needed."

- **If the manifest does not exist or is empty**: No sync-engine installation detected. The `edwin-activate` skill proceeds to install the persona.

This prevents the following failure modes:

1. **Duplicate skills**: Both installation paths manage their own skill copies. Claude Code loads both, but they are in separate directories and do not overwrite each other.

2. **Persona conflict**: The persona is installed only once, by whichever path the user explicitly invokes first (via `edwin-activate` for plugin users, or automatically for `npx` users).

3. **Update collisions**: The sync engine only updates skills it installed (tracked in the manifest). Plugin updates are managed by the plugin system.

## What Happens If Both Are Used

### Scenario 1: Plugin Installed First

1. User runs `/plugin install edwin` → Skills available via plugin
2. User runs `/edwin-activate` → Persona installed to `~/.claude/CLAUDE.md`
3. Result: ✓ Skills from plugin, persona active, no duplicates

### Scenario 2: Sync Engine Installed First

1. User runs `npx github:sqlhammer/edwin` → Skills copied to `~/.claude/skills/`, persona installed, manifest created
2. User runs `/plugin install edwin` → Plugin skills available, but separate from sync engine skills
3. User runs `/edwin-activate` → **Aborts** with message: "Already installed via sync engine"
4. Result: ⚠️ Two copies of skills (plugin + sync), but only one persona. Skills are duplicated but functional.

To resolve scenario 2, the user should:

- **Option A**: Uninstall the plugin (`/plugin uninstall edwin`) and rely on the sync engine.
- **Option B**: Uninstall via sync engine (`npx github:sqlhammer/edwin -- --uninstall`) and rely on the plugin.

### Scenario 3: Sync Engine Installed, Then Plugin Activated

This is scenario 2. The `edwin-activate` skill detects the existing installation and refuses to proceed, preventing persona duplication but leaving duplicate skills.

## Recommendation

**Choose one installation path.** The plugin path is recommended for most users (simpler discovery and updates). The sync engine path is for users who need:

- Installation on harnesses without plugin support
- Customization of the sync process
- Integration with CI/CD or scheduled updates

## Technical Details

### Manifest Location

`~/.edwin/installed.json` — created by the sync engine, read by `edwin-activate`.

### Skill Hash Tracking

The manifest stores a SHA-256 hash of each installed skill directory. This allows the sync engine to detect changes and update only modified skills, even when the version number hasn't changed.

### Plugin Directory Structure

The plugin root is the **repository root** (marketplace.json specifies `"source": "."`). Skills must live at `<repo-root>/skills/`:

```
edwin/                   # Repository root = Plugin root
├── .claude-plugin/
│   ├── plugin.json      # Plugin manifest
│   └── marketplace.json # Marketplace manifest
├── skills/              # Plugin skills (generated from core/skills/)
│   ├── analyst/
│   ├── briefing/
│   └── ...
├── core/                # Framework source (includes persona)
├── tools/               # Sync engine and scripts
└── ...
```

**CRITICAL:** Skills are at `<repo-root>/skills/`, NOT `.claude-plugin/skills/`. The `.claude-plugin/` directory contains ONLY the two JSON manifests. When installed via `/plugin install`, Claude Code clones the repository, so all repo-root files (including `skills/`) are present.

The `skills/` directory is generated by `npm run build-plugin` from `core/skills/` and committed to the repository.

## Validation

### Plugin Validation Does Not Verify Skills

**Important:** `claude plugin validate` checks manifest syntax and plugin structure, but **does NOT verify that skills actually resolve**. A plugin can pass validation while exposing zero skills.

To truly verify the plugin works, run from the repository root:

```bash
claude --plugin-dir . -p "List the names of every skill you can see" --output-format text
```

This command:
- Loads the plugin from the current directory
- Asks Claude to list all visible skills
- Outputs as plain text

If skills are correctly exposed, you'll see them listed. If the output is empty or doesn't mention any skills, the plugin structure is incorrect.

### Build Verification

After running `npm run build-plugin`, verify:

1. **Idempotency**: Run `npm run build-plugin` twice — second run should report "No changes"
2. **Structure**: `.claude-plugin/` should contain ONLY `plugin.json` and `marketplace.json`
3. **Skills location**: Skills should be at `<repo-root>/skills/`, not `.claude-plugin/skills/`
4. **Drift detection**: Run `npm run doctor` — should show 0 errors
5. **Real verification**: Run the `claude --plugin-dir` command above and confirm skills are listed

## Testing

To verify compatibility:

1. **Clean state**: Ensure `~/.claude/skills/` and `~/.edwin/installed.json` do not exist
2. **Install via plugin**: `/plugin install edwin`, then `/edwin-activate`
3. **Verify**: Skills work, persona is active, manifest does NOT exist (plugin activation does not create it)
4. **Uninstall plugin**: `/plugin uninstall edwin`
5. **Install via sync**: `npx github:sqlhammer/edwin`
6. **Verify**: Skills work, persona active, manifest EXISTS
7. **Reinstall plugin**: `/plugin install edwin`
8. **Try to activate**: `/edwin-activate` → Should refuse with "already installed" message

## Future Considerations

If Claude Code introduces a plugin-level persona mechanism (plugin-wide `CLAUDE.md` or equivalent), WU-16 will:

- Update the plugin to use that mechanism instead of `edwin-activate`
- Deprecate `edwin-activate` or repurpose it as a migration tool
- Update this document accordingly

Until then, persona delivery via `edwin-activate` invoking the sync engine is the verified, working solution.
