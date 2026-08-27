# EDWIN

**Electronic Digital Workforce Intelligence Network** — a portable personal AI assistant framework for Claude.

EDWIN is your own extensible AI assistant that learns your workflows, remembers what matters, and stays entirely under your control. No coding required to extend it. No data leaves your machine. Works with Claude Code, Claude Desktop, and web portals.

## What it does

EDWIN brings **23 purpose-built skills** and a consistent persona to Claude:

| Skill | Purpose | Context |
|-------|---------|---------|
| **analyst** | Rigorous data analysis with pattern detection and statistical reasoning | Work |
| **blog-image-producer** | Generates whiteboard-style illustration prompts for blog posts | All |
| **blog-writer** | Research-backed blog drafting and revision with leadership positioning | All |
| **briefing** | Distills any input into BLUF-structured executive summaries | Work |
| **edwin-activate** | Installs EDWIN persona when using the plugin path | All |
| **edwin-brag** | Tracks wins automatically or on demand, exports brag docs | All |
| **edwin-context** | Manages contexts and skill assignments through conversation | All |
| **edwin-export** | Exports EDWIN for web portals (claude.ai, Gemini, Copilot) | All |
| **edwin-memory** | Learns preferences and facts over time, with confirmation | All |
| **edwin-persona-creator** | Creates persona-mode skills conversationally (writing editor, coach) | All |
| **edwin-publish** | Publishes skills to your configured repository | All |
| **edwin-scheduler** | Schedules recurring or future-dated tasks | All |
| **edwin-setup** | First-run onboarding and configuration | All |
| **edwin-skill-creator** | Turns workflow breakdowns into validated, installed skills | All |
| **edwin-workflow-analyzer** | Learns your recurring workflows by observation or interview | All |
| **executive-coach** | Directive coaching for Product-Engineering leaders | Work |
| **intellectual-sparing-partner** | Pressure-tests ideas through rigorous debate | All |
| **project-planner** | Work Breakdown Structure decomposition | Work |
| **prompter** | Master-level AI prompt optimization using 4-D methodology | All |
| **researcher** | Deep research with source evaluation and synthesis | All |
| **strategist** | Structured brainstorming from divergence to decision | Work |
| **tutor** | Socratic teaching that builds understanding | All |
| **x-ghostwriter** | Ghost-writes X/Twitter posts through interviews | Work |

Plus **writing-editor**, a persona-mode skill that acts as a patient writing coach.

### Contexts

EDWIN organizes skills into three contexts: **Global**, **Work**, and **Home**. The active context biases suggestions and ambiguity resolution — skills you use at work surface first when you're in Work context — but **never restricts access**. Every skill stays available in every context.

Switch contexts by saying "switch to Work" or list skills grouped by context with "list my skills".

### Extensibility

EDWIN learns new skills from conversation, no markdown editing required:

1. Do a task twice, and EDWIN offers to learn it: "You've done that twice now. Want me to learn it as a skill?"
2. Accept, and `edwin-workflow-analyzer` observes what you did and asks clarifying questions.
3. Say "turn this into a skill" and `edwin-skill-creator` writes, validates, and installs it.

See [docs/examples/skill-creation-example.md](docs/examples/skill-creation-example.md) for a worked example.

### Your data stays yours

Everything personal — your name, preferences, memory, logged wins, workflows — lives in the `user/` directory, which is gitignored and never synced. Updating EDWIN never touches it. You can edit any file in there by hand; they're deliberately plain markdown and small JSON.

## Installation

Pick the path that fits your comfort level. All four install the same framework.

### 1. Double-click installer (recommended for non-technical users)

**macOS:** Download [tools/installers/EDWIN-Install.command](tools/installers/EDWIN-Install.command), then **right-click** and select **Open** the first time (Gatekeeper quarantine). The installer checks prerequisites, clones the repository, and runs the sync engine.

**Windows:** Download both [tools/installers/EDWIN-Install.cmd](tools/installers/EDWIN-Install.cmd) and [tools/installers/EDWIN-Install.ps1](tools/installers/EDWIN-Install.ps1) **into the same folder**, then double-click the `.cmd`. The installer is the PowerShell script; the `.cmd` is a launcher, because Windows opens a `.ps1` in an editor rather than running it on double-click. PowerShell itself needs no installing — it ships with Windows.

Both installers prompt for the repository URL if downloaded standalone. After installation, open Claude and say "set up EDWIN" to complete configuration.

**Prerequisites:** Git and Node.js 18+. If either is missing the installer offers to install it and does so itself — nothing to download through a browser. It prefers your existing package manager (Homebrew on macOS, winget on Windows) and otherwise fetches the official signed package and verifies its checksum before installing. Pass `--yes` to skip the confirmation, or `--skip-deps` to have it refuse rather than install.

See [docs/getting-started-mac.html](docs/getting-started-mac.html) or [docs/getting-started-windows.html](docs/getting-started-windows.html) for step-by-step guides.

### 2. Plugin install (Claude Code users)

In Claude Code:

```
/plugin install edwin
```

This installs skills via the plugin system. Then activate the persona:

```
/edwin-activate
```

That's it. Say "set up EDWIN" to configure.

**Note:** Plugin installation brings skills but cannot write your `CLAUDE.md` directly, so the activation step is required. See [docs/plugin-compatibility.md](docs/plugin-compatibility.md) for details on how the plugin and sync engine coexist.

### 3. npx (developers)

Requires Node.js 18+ and Git:

```bash
npx github:sqlhammer/edwin
```

Installs to `~/.claude/skills/` and `~/.claude/CLAUDE.md`. Reads the repository from `package.json`, so a fork needs no code edits.

Update anytime by running the command again:

```bash
npx --yes github:sqlhammer/edwin@main
```

Restart Claude after installation, then say "set up EDWIN".

### 4. Manual

Clone and sync:

```bash
git clone https://github.com/sqlhammer/edwin.git
cd edwin
npm run sync
```

Restart Claude, then say "set up EDWIN".

Update by pulling and re-syncing:

```bash
git pull
npm run sync
```

## Using EDWIN

After installation, say **"set up EDWIN"** in Claude to complete first-run onboarding. EDWIN asks a few questions (name, contexts, preferences) and writes your `user/config.json`.

From there, just use skills by name or trigger phrase:

- "Switch to Work"
- "Brief me on this report"
- "Create a skill for my weekly status update"
- "Show my logged wins"

EDWIN routes to the right skill automatically. See [docs/using-edwin.html](docs/using-edwin.html) for examples and patterns.

### Web portals

EDWIN works in Claude Code and Claude Desktop out of the box. For browser-based AI portals (claude.ai, Gemini, Copilot), say:

```
/edwin-export --context Work --portal claude
```

This generates paste-able instructions and uploadable knowledge files. See [docs/web-portals.html](docs/web-portals.html) for per-portal setup.

### Scheduled tasks

EDWIN can schedule recurring tasks ("brief me every morning") or future-dated reminders ("remind me Friday"). Scheduling uses harness-native scheduling where available (Claude Desktop/Cowork) and falls back to OS-level scheduling (launchd/Task Scheduler/cron) in terminal environments. See [docs/scheduled-tasks.html](docs/scheduled-tasks.html).

Web portals do not support scheduling.

## Repository structure

```
edwin/
├── core/                     # Framework source (persona, skills, contexts)
│   ├── VERSION               # Framework semver (0.2.0)
│   ├── persona/              # EDWIN's character, operating rules, hooks
│   ├── skills/<name>/        # One directory per skill
│   ├── contexts/             # Context definitions
│   └── templates/            # Templates for meta-skills
├── user/                     # YOUR data (gitignored)
│   ├── config.json           # Name, preferences, contexts
│   ├── state.json            # Active context
│   ├── memory/               # What EDWIN remembers
│   ├── brags/                # Logged wins
│   ├── workflows/            # Analyzed workflows
│   └── schedule.json         # Scheduled tasks
├── tools/
│   ├── sync/                 # Sync engine (installs skills and persona)
│   ├── validate/             # edwin-doctor structure validator
│   ├── schedule/             # OS scheduler helpers
│   ├── bundle/               # Web-portal bundle generator
│   ├── memory/               # Memory and brag scripts
│   └── installers/           # Double-click installers
├── docs/                     # User guides and examples
├── specs/                    # Work-unit specifications
└── skills/                   # GENERATED plugin skills (rebuilt from core/skills/)
```

## Contributing

Contributions are welcome. Before submitting a PR:

1. Read [specs/conventions.md](specs/conventions.md) — the format contract for skills, personas, hooks, and scripts.
2. Run `npm run doctor` — it must exit 0 before a change lands.
3. If you edited `core/skills/`, run `npm run build-plugin` to rebuild the generated `skills/` directory.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on work units, specs, the changelog, and validation.

## Updating EDWIN

### Plugin users

```
/plugin update edwin
```

Then `/edwin-activate` if prompted.

### npx users

```bash
npx --yes github:sqlhammer/edwin@main
```

### Manual users

```bash
cd ~/edwin
git pull
npm run sync
```

Your `user/` directory is never touched by updates.

See [docs/updating-edwin.html](docs/updating-edwin.html) for troubleshooting.

## Upgrading from v0.1

v0.1 had a flat `SKILLS/` folder at the repository root. v0.2 uses `core/skills/`, and `CLAUDE.md` is now generated between managed markers so hand-written content outside them survives.

The v0.1 `achievement-tracker` skill has been removed (superseded by `edwin-brag`).

To upgrade:

1. Back up your `SKILLS/` folder if you made edits.
2. Pull the latest code or reinstall.
3. Run the sync engine (`npm run sync` or re-run the npx installer).
4. Say "set up EDWIN" to migrate your configuration.

Hand-written content in your `CLAUDE.md` outside the `<!-- EDWIN:BEGIN -->` / `<!-- EDWIN:END -->` markers is preserved.

## Troubleshooting

- **Skills not appearing:** Restart Claude after installation.
- **"set up EDWIN" does nothing:** Run `npm run doctor` to check for structure issues.
- **Sync engine fails:** Check Node.js version (needs 18+) and that `tools/sync/engine.mjs` exists.
- **Personal data leaking into commits:** Add your name/paths to `tools/validate/denylist.txt` and run `npm run doctor`.

Full troubleshooting guide: [docs/troubleshooting.html](docs/troubleshooting.html)

## Documentation

Start at the [guide index](docs/index.html) — it organises everything below by "I want to…". Open it in a
browser; the guides are self-contained HTML and work offline.

- [Getting Started (macOS)](docs/getting-started-mac.html)
- [Getting Started (Windows)](docs/getting-started-windows.html)
- [Using EDWIN](docs/using-edwin.html)
- [Creating Skills](docs/creating-skills.html)
- [Memory and Wins](docs/memory-and-wins.html)
- [Web Portals](docs/web-portals.html)
- [Scheduled Tasks](docs/scheduled-tasks.html)
- [Updating EDWIN](docs/updating-edwin.html)
- [Troubleshooting](docs/troubleshooting.html)
- [Plugin Compatibility](docs/plugin-compatibility.md)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history and migration notes.

## License

MIT License. See [package.json](package.json).

## Links

- Repository: https://github.com/sqlhammer/edwin
- Issues: https://github.com/sqlhammer/edwin/issues
