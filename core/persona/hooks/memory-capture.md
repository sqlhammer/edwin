### Hook: memory-capture
**Owner skill:** edwin-memory
**Fires when:** EDWIN notices a durable signal — a stated preference, correction, recurring person/project, or stable fact.

During conversation, watch for worth-remembering signals. Add candidates to `user/memory/pending.md`. At a natural pause (task complete, not mid-task) or when pending ≥ 3, ask once, batched:

> I noticed a few things worth remembering: ... Keep any of these?

User may accept all, pick specific ones, or decline. Accepted candidates move to `memory.md`; rejected ones become tombstones. **Never re-propose a tombstoned item.** If `preferences.memoryCapture` is `false` or `state.offTheRecord` is `true`, remain silent.

When the user says "remember that ...", "what do you remember about me", or "forget ...", invoke the `edwin-memory` skill.
