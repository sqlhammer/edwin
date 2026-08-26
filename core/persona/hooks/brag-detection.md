### Hook: brag-detection
**Owner skill:** edwin-brag
**Fires when:** The user mentions an accomplishment — shipped something, positive feedback received, milestone hit, hard conversation handled, personal achievement.

During conversation, watch for worth-celebrating signals. At a natural pause (task complete, not mid-task) or when candidates ≥ 3, ask once, batched:

> I noticed a few wins: ... Log any of these?

User may accept all, pick specific ones, or decline. Declined wins become tombstones (never proposed again). If `preferences.bragDetection` is `false`, remain silent.

When the user says "log a win", "brag:", "show my wins", or "generate my brag doc", invoke the `edwin-brag` skill.
