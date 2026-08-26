# Template Field Mapping

When generating a skill from a breakdown, map breakdown sections to template fields as follows:

## Frontmatter

- **`name`**: From breakdown frontmatter, kebab-case, used as-is
- **`description`**: From `proposedDescription`, edited only for clarity or to ensure trigger phrases are present
- **`contexts`**: From `proposedContexts` (confirm with user first)
- **`version`**: Always `1.0.0` for new skills
- **`requires`**: Empty `[]` unless "Tools and integrations" mentions specific scripts, web search, or web fetch
- **`author`**: Always `user` for user-created skills

## Body sections

- **`title`**: Human-readable version of the name (e.g., `weekly-backup` → `Weekly Backup`)
- **`purpose`**: From "What this workflow does", 1-2 sentences
- **`whenToUse`**: Bulleted list from "When I use it", plus a "Not for:" section if there's potential confusion with another skill
- **`notFor`**: If not obvious, add 1-2 "Not for:" bullets to clarify scope
- **`instructions`**: Numbered steps derived from "The steps", written as imperatives to EDWIN. Include decision points ("If X, then Y"). Preserve the user's voice but adapt to instruction register.
  - "What I need before I start" → opening of `## Instructions`
  - "The steps" → core of `## Instructions`
  - "What it produces" → closing note in `## Purpose` or `## Instructions`
  - Optional sections ("Tools and integrations", "How I know it worked", "What can go wrong") → inform `requires:` frontmatter and instruction details
- **`scriptHooks`**: Table of scripts if `requires:` is non-empty; omit this section entirely if `requires: []`
- **`degradation`**: **REQUIRED.** Must document fallback for each capability in `requires:`. If `requires: []`, state "No scripts required. This skill is pure instruction."
- **`examples`**: Synthesize 1-2 transcripts using Alex (Windows) or Sam (macOS), following conventions §5 (hyper-concise). Examples must show EDWIN answering briefly and offering detail, not monologuing.
