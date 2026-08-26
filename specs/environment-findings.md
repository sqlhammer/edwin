# Verified environment findings

Four specs (WU-06, WU-08, WU-12, WU-13) say "research current conventions at build time". This document
records what was **verified on a real machine** so each work unit does not re-research and disagree.

**Verified:** 2026-08-26, macOS 25.6.0, Claude Code `2.1.223`, Claude Desktop with Cowork enabled, Node
`v22.23.2`.

Treat everything here as a *finding with an expiry date*. Every consumer must isolate these facts behind a
single module or constant (`tools/sync/targets.mjs`, a `SCHEDULE_CMD` constant, `portal-limits.json`) so a
harness change is a one-file fix. Where a fact is unverified, it is labelled as such — do not launder it
into certainty.

---

## 1. Claude Code install targets — VERIFIED

| Path | Contents |
|---|---|
| `~/.claude/` | Root of all user-level Claude Code state |
| `~/.claude/skills/<skill-name>/SKILL.md` | **The live user-level skills directory.** Lowercase `skills`. |
| `~/.claude/CLAUDE.md` | User-level instructions loaded into every session |
| `~/.claude/settings.json` | User settings |
| `~/.claude/plugins/` | `installed_plugins.json`, `known_marketplaces.json`, `marketplaces/<name>/` |

**v0.1 bug to fix in WU-06:** v0.1 installed to `~/.claude/SKILLS/` (uppercase). The real directory is
lowercase `~/.claude/skills/`. On a case-insensitive macOS volume this happened to work; on Linux and in
some Windows tooling it does not. WU-06 must install to lowercase `skills/` and should detect and clean up
a legacy uppercase `SKILLS/` directory left by v0.1 — but only the skill folders EDWIN itself installed.

## 2. Claude Desktop and Cowork — VERIFIED, and it simplifies things

Claude Desktop ships a **bundled Claude Code binary**:

```
~/Library/Application Support/Claude/claude-code/<version>/claude.app
~/Library/Application Support/Claude/cowork-enabled-cli-ops.json   (present when Cowork is enabled)
```

Everything else in `~/Library/Application Support/Claude/` is Electron state (caches, IndexedDB, session
storage) plus `claude_desktop_config.json` (MCP servers only). **There is no separate Desktop skills
directory on disk.**

**Consequences:**
- **Cowork reads the same `~/.claude/` tree as Claude Code.** Installing to `~/.claude/skills/` serves
  both. WU-06's `--target desktop` is therefore the same filesystem target as `--target code`; the engine
  should say so rather than pretending to install twice, and use the presence of
  `cowork-enabled-cli-ops.json` (macOS) or the equivalent Windows path only to *report* that Cowork will
  pick the skills up.
- **The Claude Code plugin format works for Cowork too** (WU-08's compatibility question resolved).
- Claude Desktop's *own* non-Cowork skills (the claude.ai Capabilities surface) are **server-side** — they
  are uploaded through the web UI, not written to disk. That surface is served by WU-13's bundles, not by
  the sync engine. Do not invent a local path for it.

Windows equivalents — **UNVERIFIED, no Windows machine available.** Expected:
`%USERPROFILE%\.claude\` for Claude Code (same layout), `%APPDATA%\Claude\` for Desktop Electron state.
Code defensively: probe for existence, never assume, and degrade to "target not found" with a clear message.

## 3. Plugin and marketplace format — VERIFIED against the official marketplace

Plugin package layout:

```
<plugin-root>/
├── .claude-plugin/
│   └── plugin.json
├── skills/<skill-name>/SKILL.md
├── commands/*.md
├── agents/*.md
├── hooks/
├── README.md
└── LICENSE
```

`plugin.json` — only `name` and `description` are universally present; the rest are optional:

```json
{
  "name": "edwin",
  "description": "…",
  "author": { "name": "…", "email": "…" },
  "version": "0.2.0",
  "license": "MIT",
  "keywords": ["…"]
}
```

`marketplace.json` lives at `<repo>/.claude-plugin/marketplace.json`:

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "edwin",
  "description": "…",
  "owner": { "name": "…" },
  "plugins": [
    { "name": "edwin", "description": "…", "author": {"name": "…"},
      "category": "productivity", "source": "./plugins/edwin" }
  ]
}
```

`source` is a relative path string for an in-repo plugin, or an object
`{ "source": "git-subdir", "url": …, "path": …, "ref": …, "sha": … }` for an external one. **An in-repo
marketplace is the right choice for EDWIN** — one repo, one `/plugin marketplace add <owner>/edwin`.

**No plugin in the official marketplace ships a plugin-level `CLAUDE.md`.** There is no verified mechanism
for a plugin to contribute persistent persona instructions. So WU-08 takes the fallback its spec names: the
plugin ships an `edwin-activate` skill that writes the persona into `~/.claude/CLAUDE.md` via the WU-06
engine on first invocation.

## 4. Skill frontmatter — VERIFIED

Across 26 installed skills, the keys in real use are `name`, `description`, `version`, `license`, `tools`,
`allowed-tools`, `user-invocable`, `disable-model-invocation`, `argument-hint`.

**Unrecognised frontmatter keys are tolerated** — no plugin skill was rejected for carrying extra keys.
EDWIN's custom keys (`contexts`, `requires`, `author`, `type`) are therefore safe. `name`, `description`,
and `version` are the ones the harness actually consumes, which is exactly why conventions §3.1 treats
`description` as the routing contract.

Descriptions in Anthropic's own skills follow the shape conventions §3.1 mandates: what it does plus an
explicit "use this when the user asks…" clause naming real trigger phrases. Migrated skills should match
that register.

## 5. Headless `claude` invocation — VERIFIED (`claude --version` 2.1.223)

For WU-12's OS-level scheduled jobs:

| Flag | Purpose |
|---|---|
| `-p`, `--print` | Non-interactive: print the response and exit. **The core flag.** |
| `--output-format <text\|json\|stream-json>` | `--print` only. Use `text` for logs, `json` when a script must parse the result. |
| `--permission-mode <acceptEdits\|auto\|bypassPermissions\|manual\|dontAsk\|plan>` | A scheduled job has no one to answer prompts. Prefer `dontAsk` or `acceptEdits`; reserve `bypassPermissions` for jobs the user explicitly accepted, and never default to it. |
| `--model <alias\|full-name>` | `opus`, `sonnet`, `fable`, or a full id. Omit to use the user's default. |
| `--add-dir <dirs...>` | Grant the job access to the EDWIN clone. |
| `--append-system-prompt <text>` | Inject extra instruction without replacing the system prompt. |
| `--settings <path>` | Point the job at explicit settings. |

Canonical scheduled invocation to isolate in one constant:

```
claude -p "<prompt>" --output-format text --permission-mode dontAsk
```

**Quoting is the classic failure point.** `schtasks` and `launchd` disagree about escaping, and prompts
contain apostrophes and newlines. **Do not embed the prompt in the scheduler command line.** Write the
prompt to a file under `user/` and have the scheduled command read it — `claude -p "$(cat <file>)"` on
macOS, or a small `.cmd`/`.ps1` shim on Windows that does the same. This removes the entire escaping
problem instead of trying to win it.

Scheduling mechanisms:
- **macOS:** launchd plist in `~/Library/LaunchAgents/`, loaded with
  `launchctl bootstrap gui/$(id -u) <plist>` (modern) or `launchctl load` (legacy — still works, deprecated).
  Use `StartCalendarInterval`. Redirect `StandardOutPath`/`StandardErrorPath` into `user/schedule-logs/`.
  Verified as available; specific plist behaviour is **untested by this document**.
- **Windows:** `schtasks /Create /SC DAILY /ST 08:00 /TN "EDWIN\<name>" /TR "<command>"`. Namespacing task
  names under an `EDWIN\` folder makes `--list` and `--remove` reliable. **UNVERIFIED — no Windows machine.**
- **Cowork / Desktop native scheduling:** the spec's preferred first rung. **UNVERIFIED** — cannot confirm
  a native scheduled-task tool from this environment. WU-12 must detect it at runtime (tool availability
  check) rather than assume it, and fall through to the OS rung when absent.

## 6. Web-portal limits — UNVERIFIED, treat as configuration not fact

WU-13 stores these in `tools/bundle/portal-limits.json` with a `verifiedOn` date per portal and a comment
saying they are best-effort. The generator must **read the file, never hardcode**, and must report actual
output size against the configured limit so a stale number produces a visible warning rather than a
silently oversized bundle. When a limit is unknown, the conservative move is a smaller bundle plus a
manifest of what was cut — which WU-13's spec already requires for Gemini.

Do not present any specific character limit in user-facing documentation as authoritative. Say "if the
portal rejects it as too long, run the export again with a narrower context" — that advice survives the
numbers changing.
