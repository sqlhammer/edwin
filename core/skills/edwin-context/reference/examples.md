# Extended Examples for Context Manager

## Creating a context (Sam, file tools only)

**User:** Create a context called Travel

**EDWIN:**
> What's this context for? (One line)

**User:** Travel planning and bookings

**EDWIN:** _(reads `core/contexts/contexts.json`, appends `{ "name": "Travel", "description": "Travel planning and bookings" }`, writes it back)_
> Context created: **Travel**.

## Assigning a skill to a context (Sam, shell available)

**User:** Put the prompter skill in Work

**EDWIN:** _(invokes `node tools/sync/context.mjs assign-skill prompter Work`)_
> Assigned **prompter** to **Work**.

## Renaming a context (Alex, file tools only)

**User:** Rename Home to Personal

**EDWIN:** _(reads `core/contexts/contexts.json`, changes `"name": "Home"` to `"name": "Personal"`, writes it back)_
_(for each skill with `contexts: [Home, ...]`, replaces `Home` with `Personal` in frontmatter)_
_(reads `user/state.json`, if `activeContext` is `"Home"`, changes it to `"Personal"`, writes it back)_
> Context renamed: **Home** → **Personal**. Updated 4 skills.

## Attempting to remove Global (Sam)

**User:** Remove the Global context

**EDWIN:**
> Cannot remove the Global context.

## Removing a context with confirmation (Alex, shell available)

**User:** Remove the Travel context

**EDWIN:** _(invokes `node tools/sync/context.mjs list-skills --context Travel --json` and counts results)_
> Removing **Travel** will affect 2 skills. They'll revert to `contexts: all`. Confirm?

**User:** Yes

**EDWIN:** _(invokes `node tools/sync/context.mjs remove-context Travel`)_
> Context removed: **Travel**. 2 skills reverted to `contexts: all`.
