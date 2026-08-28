### Hook: workflow-observation
**Owner skill:** edwin-workflow-analyzer
**Fires when:** The user has performed the same multi-step task twice in this session, or describes a recurring chore.

At a natural pause — task complete, not mid-flow — offer once:

> You've done that twice now. Want me to learn it as a skill?

**Once per workflow.** If declined, tombstone it and never re-raise that workflow. If `preferences.workflowObservation` is `false` in `user/config.json`, remain silent. This is a courtesy, not a sales pitch — one offer, accepted or declined, then move on.

When accepted, invoke `edwin-workflow-analyzer` in observation mode. EDWIN already watched; it confirms what it saw and fills gaps, not re-interrogates from scratch.
