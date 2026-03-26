# EDWIN

EDWIN (Electronic Digital Workforce Intelligence Network) is a collection of Claude Code skills and automations for a personal AI assistant — named as a nod to Edwin Jarvis.

## Skills

| Skill | Purpose |
|-------|---------|
| `analyst` | Data interrogation, pattern detection, statistical reasoning |
| `blog-writer` | Research-backed blog drafting and revision |
| `briefing` | Distill any input into a crisp executive briefing |
| `executive-coach` | Directive coaching for Product-Eng leaders |
| `intellectual-sparing-partner` | Pressure-test ideas through rigorous debate |
| `project-planner` | WBS decomposition into deliverables and work packages |
| `prompter` | Optimize prompts using the 4-D methodology |
| `publish-edwin-skills` | Commit, push, and sync skills in one step |
| `researcher` | Deep research with source evaluation and synthesis |
| `strategist` | Structured brainstorming — diverge, stress-test, converge |
| `tutor` | Socratic teaching — build understanding, not just answers |
| `x-ghostwriter` | Interview-driven X post generation for AI leadership positioning |

## Installation

### npx install

---

Requires [Node.js](https://nodejs.org) 18+ and [Claude Code](https://claude.ai/code).

```bash
npx github:sqlhammer/edwin
```

This installs all skills to `~/.claude/SKILLS/` and, if no `CLAUDE.md` exists at `~/.claude/CLAUDE.md`, copies the EDWIN personality definition there as well. Restart Claude Code after running.

To pull the latest version at any time, run the command again (skills are overwritten with the current repo contents):

```bash
npx --yes github:sqlhammer/edwin@main
```

### Manual install (no Node required)

---

Clone the repo and run the PowerShell sync script. Works on any machine with PowerShell 5.1+ (built into Windows; available on macOS/Linux via [PowerShell](https://github.com/PowerShell/PowerShell)).

```powershell
git clone https://github.com/sqlhammer/edwin.git
cd edwin
.\tools\Sync-EdwinSkills.ps1
```

The script copies all skills to `~/.claude/SKILLS/`. Restart Claude Code after running.

To update later, pull and re-run the script:

```powershell
git pull
.\tools\Sync-EdwinSkills.ps1
```
