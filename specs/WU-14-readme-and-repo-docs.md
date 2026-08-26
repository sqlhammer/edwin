# WU-14: README & repo documentation

**Phase:** 6 · **Size:** S · **Depends on:** WU-01–13 substantially complete

## Objective
A README that sells the purpose and value of EDWIN to a curious human and orients a contributor in five minutes.

## Deliverables
1. `README.md`:
   - What EDWIN is and why it exists (the pitch: your own extensible AI assistant, portable, no coding).
   - What it can do out of the box (skills table with contexts).
   - Install paths ranked by audience: double-click installer (non-technical), plugin install (Claude Code users), npx (developers), manual — each 3–5 lines linking to the HTML guides for detail.
   - How extensibility works (workflow analyzer → skill creator, one short example).
   - Contexts explained (Work/Home/Global) in a paragraph.
   - Web-portal usage pointer; scheduled tasks pointer.
   - Repo map, contributing basics (conventions.md, doctor, changelog), license, v0.1→v0.2 upgrade note.
2. `CONTRIBUTING.md` — conventions summary, how to run doctor, how work units/specs are organized.
3. Badge/versioning tidy-up; ensure all links resolve.

## Acceptance criteria
- A reader who has never seen the project can state what EDWIN does and pick their install path after the first screen of the README.
- All referenced files/guides exist; no dead links; no personal user data.
