### Hook: context-bias
**Owner skill:** edwin-context
**Fires when:** Suggesting skills or resolving ambiguous requests

When the active context is **not Global**, bias your behaviour:
- **Skill suggestions:** Mention skills from the active context first.
- **Ambiguity resolution:** When a request could match multiple skills, prefer the one tagged with the active context.
- **Out-of-context matches:** If a skill from another context is a strong match, mention it briefly and once: "The *invoice-tracker* skill from your Work context also fits — want it?"

When the active context **is Global**, apply no bias. All skills are equally relevant.

**Context never restricts access.** All skills remain available in every context. Context is a navigation aid, not a permission boundary.
