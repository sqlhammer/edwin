# EDWIN v0.2 Development Plan

**EDWIN** — Electronic Digital Workforce Intelligence Network. A self-contained, portable AI personal assistant framework for non-technical users, built for Claude harnesses (Claude Code terminal, Claude Desktop/Cowork) with export support for web AI portals (claude.ai, Gemini, Copilot).

This plan feeds development agents. Each work unit (WU) has a self-contained spec in `specs/`. Give an agent one spec plus this file for context.

---

## Locked architectural decisions

| Decision | Choice |
|---|---|
| Architecture | **Markdown-first + thin scripts.** Skills, personas, meta-skills are markdown. Small deterministic helper scripts (Node + PowerShell) exist only for install, sync, validation, context state, scheduling, and bundle export. No feature may *require* code to function — scripts are accelerators the AI invokes when shell access exists. |
| Multi-user portability | Nothing user-specific in the framework. All personal data lives in a gitignored `user/` config created by an onboarding conversation. |
| Distribution | All three: (1) Claude Code plugin/marketplace package, (2) npx one-liner, (3) double-clickable guided installers for Windows and Mac. All share one sync engine. |
| Web portals | Bundle generator flattens persona + a context's skills into paste-able instructions and uploadable knowledge files for claude.ai Projects, Gemini Gems, and Copilot, plus per-portal HTML guides. |
| Contexts | Grouping + active-context hint + a **Global** context that exposes everything. All skills always available in every context; contexts bias navigation and reasoning. |
| Workflow analyzer | Interview + observation. Watches for repeated patterns in conversation and runs guided interviews; outputs structured workflow breakdowns consumed by the skill creator. |
| Scheduled tasks | Harness-native (Cowork/Desktop) where available; OS-level fallback (Task Scheduler / launchd / cron invoking headless `claude`) in terminal; documented-as-unavailable for web portals. |
| Memory | Harness-independent (no MEMORY.md reliance). Stored in `user/memory/`; observe → propose → confirm capture flow; compact digest stamped into CLAUDE.md rides into every session; global across contexts with context tags. |
| Brag/wins tracking | `edwin-brag` skill reusing the memory capture pattern; auto-detected or explicit entries; auto-categorized (defaults seeded from contexts, user-extensible categories); brag-doc generation for reviews/retrospectives. |
| Communication style | **Hyper-concise and direct by default.** EDWIN answers what was asked and stops; detail is offered ("Want the full breakdown?"), not delivered — users ask follow-ups. Applies to all skills' conversational output; long-form only for explicit deliverables. Per-user verbosity preference can relax the default, never remove it. Every WU that writes skill dialogue or examples must conform. |
| Baseline skills | v0.1's 12 skills migrate into the v0.2 format. Derik authors most new baseline skills post-framework; the plan only builds the framework + migration. |

## Target repository layout

```
edwin/
├── README.md
├── CLAUDE.md                  # EDWIN persona + bootstrap (generated/synced)
├── core/                     # Framework source (persona, skills, contexts, templates)
│   ├── persona/               # Core identity, tone, operating rules (markdown)
│   ├── skills/<skill-name>/SKILL.md
│   ├── contexts/contexts.json # Context definitions + skill→context tags
│   └── templates/             # Skill/persona/workflow templates for meta-skills
├── user/                      # Gitignored. Config, active context, memory/, brags/, workflows/
├── tools/
│   ├── sync/                  # Shared sync engine (Node) + PS1 port
│   ├── installers/            # npx entry, EDWIN-Install.cmd, EDWIN-Install.command
│   ├── validate/              # edwin-doctor structure validator
│   ├── schedule/              # OS scheduler helpers
│   └── bundle/                # Web-portal bundle generator
├── docs/                      # HTML user guides + assets
└── specs/                     # These work-unit specs
```

## Work units

| WU | Title | Phase | Size | Depends on |
|---|---|---|---|---|
| 01 | Framework specification & repo scaffold | 0 | M | — |
| 02 | EDWIN core persona, bootstrap & onboarding | 0 | M | 01 |
| 03 | Context system (Global/Work/Home, manifest, switching) | 1 | M | 01, 02 |
| 04 | Migrate v0.1 skills to v0.2 format | 1 | S | 01, 03 |
| 05 | edwin-doctor validator | 1 | S | 01 |
| 06 | Sync engine + npx installer | 2 | M | 01 |
| 07 | Guided double-click installers (Win/Mac) | 2 | S | 06 |
| 08 | Claude plugin/marketplace packaging | 2 | M | 01, 04 |
| 09 | Workflow analyzer meta-skill | 3 | M | 02 |
| 10 | Skill creator meta-skill | 3 | M | 05, 09 |
| 11 | Persona/agent creator meta-skill | 3 | S | 10 |
| 12 | Scheduled tasks (harness-native + OS fallback) | 4 | M | 02, 06 |
| 13 | Web-portal bundle generator | 5 | L | 03, 04, 17 (digest export) |
| 14 | README & repo documentation | 6 | S | 01–13, 17–18 substantially done |
| 15 | HTML user guides | 6 | L | 01–13, 17–18 substantially done |
| 16 | End-to-end QA & v0.2 release | 7 | M | all |
| 17 | Memory system | 3 | M | 02, 06 |
| 18 | Brag skill (wins tracker) | 3 | M | 17, 03 |

**Sizes** — S: one focused agent session (~1–2 hrs equivalent). M: one long session or two sessions (~half day). L: split across 2–3 sessions; the spec defines internal checkpoints. Keep every chunk small enough that a single agent can hold the whole spec plus relevant files in context; never assign two WUs to one session.

## Sequencing

```
Phase 0 (serial):        WU-01 → WU-02
Phase 1 (parallel):      WU-03, WU-05   then WU-04
Phase 2 (parallel lane): WU-06 → WU-07;  WU-08
Phase 3 (serial lane):   WU-09 → WU-10 → WU-11
Phase 3b (lane):         WU-17 → WU-18   (needs WU-06 for digest stamping)
Phase 4 (lane):          WU-12
Phase 5 (lane):          WU-13 (checkpoint with WU-17 digest export)
Phase 6 (after lanes):   WU-14, WU-15 (parallel)
Phase 7:                 WU-16
```

Phases 2, 3, 3b, 4, 5 are independent lanes that can run in parallel once Phase 1 completes (3b's digest-stamping piece waits on WU-06). If running agents concurrently, one lane per agent; WU-01's conventions document is the shared contract that prevents drift.

## Ground rules for dev agents

1. Read `specs/WU-XX-*.md` fully, plus `specs/conventions.md` (produced by WU-01) before writing anything.
2. Markdown-first: if a feature can work through instructions alone, the script is optional sugar and the skill must degrade gracefully without it.
3. Nothing user-specific committed. Test with a fictional user ("Alex") — never hardcode any real person's name, paths, or accounts.
4. Both OSes always: any script ships Node (cross-platform) or paired PS1/shell variants, tested logic for Windows paths (backslashes, `%USERPROFILE%`) and Mac (`~`, permissions).
5. Every WU ends by updating `CHANGELOG.md` and passing `edwin-doctor` (once WU-05 exists).
6. Acceptance criteria in the spec are the definition of done. Do not expand scope; log discovered gaps as notes for WU-16.

## Requirement traceability

| Must-have | Covered by |
|---|---|
| Self-contained, easy install for non-technical users | 06, 07, 08, 15 |
| Multi-user portability, nothing Derik-specific | 01, 02 (onboarding), enforced everywhere |
| Windows + Mac + web portals | 06, 07 (OS), 13 (portals) |
| Extensible via chat (no hand-crafted markdown) | 09, 10, 11 |
| Scheduled tasks where harness supports | 12 |
| Works with Claude desktop + terminal | 01, 02, 06, 08 |
| Out-of-the-box skills | 04 |
| Context grouping (Work/Home/Global) | 03 |
| Memory: learns preferences over time, confirm-before-keep, no harness MEMORY.md | 17 |
| Brag/wins tracking, auto-detected + categorized, custom categories | 18 |
| Git repo tracking | 01 |
| Populated README | 14 |
| HTML user guides | 15 |
| Could-have: Copilot/Gemini portability | 13 (bundles), deeper adapters deferred to v0.3 |
