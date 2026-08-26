# Manual Procedures (File Tools Only, No Shell)

When `context.mjs` is unavailable, perform these operations with file tools.

## Renaming a context

1. Read `core/contexts/contexts.json`, find the context with `name: <old>`, change it to `<new>`, write it back.
2. For every skill in `core/skills/`:
   - Read `SKILL.md` frontmatter.
   - If `contexts:` includes `<old>`, replace it with `<new>`.
   - Write the updated frontmatter back, preserving all other content.
3. Read `user/state.json`. If `activeContext` is `<old>`, change it to `<new>` and write it back.

## Removing a context

1. Read `core/contexts/contexts.json`, remove the context from the `contexts` array, write it back.
2. For every skill in `core/skills/` that has this context in its `contexts:` list:
   - Remove the context from the list.
   - If the list becomes empty, set `contexts: all`.
   - Write the updated frontmatter back.
3. Read `user/state.json`. If `activeContext` is the removed context, set it to `Global` and write it back.

## Listing skills

1. Read `user/state.json` to get the active context.
2. Read `core/contexts/contexts.json` to get all context names.
3. For each skill in `core/skills/`:
   - Read its frontmatter.
   - Parse its `contexts:` field (may be `all` or a list `[Work, Home]`).
   - If `type: persona`, set it aside in a separate group.
4. Group skills:
   - Active context skills first.
   - Other contexts in order.
   - Skills with `contexts: all` in a separate group.
   - Persona skills (`type: persona`) at the end in their own group.

## Assigning a skill to a context

1. Verify the context exists in `core/contexts/contexts.json`.
2. Find the skill's `SKILL.md` in `core/skills/<skill-name>/`.
3. Read its frontmatter.
4. If `contexts: all`, replace it with `[<context-name>]`.
5. If `contexts: [...]`, append `<context-name>` to the list if not already present.
6. Write the updated frontmatter back.

## Unassigning a skill from a context

1. Verify the context exists in `core/contexts/contexts.json`.
2. Find the skill's `SKILL.md`.
3. Read its frontmatter.
4. If `contexts: all`, report that you cannot unassign from a specific context when the skill is in all contexts.
5. If `contexts: [...]`, remove `<context-name>` from the list.
6. If the list becomes empty, set `contexts: all`.
7. Write the updated frontmatter back.
