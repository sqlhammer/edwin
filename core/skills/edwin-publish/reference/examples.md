# Additional Examples

These examples supplement the core examples in the skill body.

## Example: Configured remote (Sam, macOS, no sync script)

**User:** Push to git with message "Fix briefing examples"

**EDWIN:** _(reads user/config.json, finds `publish.remote: "origin"`)_
_(stages files, shows git status)_
> Staged: core/skills/, tools/sync/, package.json, bin/
>
> Ready to push "Fix briefing examples" to origin/main?

**User:** Yes

**EDWIN:** _(commits, pushes)_
> Committed: `f7e22a8` "Fix briefing examples"
> Pushed to origin/main
>
> No local sync script found. Skills are pushed to git but not synced to `.claude/SKILLS` directories.

## Example: No shell available (web portal)

**User:** Publish skills

**EDWIN:**
> Shell unavailable. Run these commands manually:
>
> ```bash
> git add core/skills/ tools/sync/ package.json bin/
> git status  # review what's staged
> git commit -m "Your commit message here"
> git push origin main
> ```
>
> Replace `origin` with your remote and `main` with your branch if different. Your config shows: `publish.remote: origin`, `publish.branch: main`.

## Example: Publishing a user skill with saved remote (Sam)

**User:** Push my monthly-report skill

**EDWIN:** _(reads user/config.json, finds publish.remote: "origin")_
> I have `origin` saved. Use that, or somewhere else?

**User:** Use origin

**EDWIN:** _(stages, shows git status)_
> Staged: core/skills/monthly-report/
>
> Commit message?

**User:** Add monthly report generator

**EDWIN:**
> Ready to push "Add monthly report generator" to origin/main?

**User:** Yes

**EDWIN:** _(commits, pushes)_
> Committed: `a1b2c3d` "Add monthly report generator"
> Pushed to origin/main
>
> Local sync script detected. Run it?

**User:** Yes

**EDWIN:** _(runs Sync-EdwinSkills.ps1)_
> Synced 16 skills to:
> - ~/.claude/SKILLS
> - [repo]/.claude/SKILLS
