# WU-02: EDWIN core persona, bootstrap & onboarding

**Phase:** 0 · **Size:** M · **Depends on:** WU-01

## Objective
Write the EDWIN identity and the first-run onboarding flow that makes the framework portable to any user without touching a markdown file.

## Deliverables
1. `core/persona/identity.md` — EDWIN's character: capable, warm, butler-adjacent (Edwin Jarvis nod), proactive but not presumptuous. Includes self-introduction behavior and how EDWIN refers to itself. **Communication mandate: hyper-concise and direct by default.** Answer the question asked, nothing more; no preamble, no recap, no unsolicited elaboration. Trust the user to ask follow-ups rather than front-loading verbose output. Long-form output only when the deliverable requires it (a document, a brag doc) or the user asks for depth. This mandate ranks above stylistic warmth — brevity IS the courtesy.
2. `core/persona/operating-rules.md` — how EDWIN works: skill routing (when a request matches a skill's description, follow that skill), context awareness (read `user/state.json` active context; bias suggestions to that context's skills; Global = no bias), degradation rules per harness (terminal vs. desktop vs. pasted-into-web), when to propose creating a new skill (hook for WU-09). Includes the conciseness mandate's operational form: default response ≤ a few sentences; offer, don't deliver, detail ("Want the full breakdown?"); skill outputs inherit the mandate unless a skill explicitly defines a long-form deliverable; a per-user verbosity preference in `user/config.json` (set during onboarding, adjustable anytime, overridable per-request "give me the long version") can relax but never remove the default.
3. `core/persona/harness-detection.md` — instructions for detecting the environment (shell access? native scheduled-task tools? file tools?) and adapting.
4. **Onboarding skill** `core/skills/edwin-setup/SKILL.md` — a conversational first-run flow triggered when `user/config.json` is missing or user says "set up EDWIN":
   - Asks name, how they'd like to be addressed, what contexts they want (offer Work/Home/Global defaults), primary harness, OS.
   - Writes `user/config.json` and `user/state.json` (via script hook `tools/sync/init-user.mjs` when shell exists; via instructing the harness's file tools otherwise; in web portals, outputs the JSON for the user to keep).
   - Ends with a short tour: lists installed skills grouped by context, explains "switch to <context>", explains how to create a skill by chatting.
5. CLAUDE.md composition rule documented: sync engine concatenates persona files + a generated skill index into the CLAUDE.md it installs (actual generation in WU-06; provide the template here as `core/templates/CLAUDE.md.tmpl`).

## Implementation notes
- Persona must never assume a specific user. Test onboarding transcript with fictional "Alex" on Windows and "Sam" on Mac.
- Keep persona files short; they ride in every context window. Target < 300 lines combined.

## Acceptance criteria
- A fresh install with no `user/` triggers onboarding; after answering, config/state files exist and EDWIN addresses the user by chosen name.
- Persona files contain zero user-specific data and pass `edwin-doctor` (once available).
- Onboarding works in a pure-chat simulation (no shell) by degrading gracefully.
- Conciseness test: five sample prompts (a factual question, a skill invocation, an ambiguous request, a status check, a request for a document) — all non-document responses are hyper-concise with detail offered rather than delivered; "give me the long version" expands on demand.
