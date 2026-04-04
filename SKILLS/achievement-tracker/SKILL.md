---
name: achievement-tracker
description: Run the Achievement Tracker to collect wins from Todoist, GitHub, blog, and Obsidian and generate 1:1 briefs and annual self-eval notes.
---

# Achievement Tracker Skill

Run the Achievement Tracker Python CLI to collect and summarize the user's recent achievements.

## Default invocation

Run the tracker in live mode for the current week:

```bash
cd C:\repos\achievement-tracker && uv run achievement-tracker
```

## Options the user may request

- **Test mode:** Add `--mode test` to write output to a temp directory instead of the Obsidian vault
- **Custom lookback:** Add `--lookback-days N` to change the window (default: 7)
- **Backfill a past week:** Add `--reference-date YYYY-MM-DD`
- **Dry run:** Add `--dry-run` to preview without writing files
- **Verbose:** Add `--verbose` for debug output

## After running

1. Report the summary: how many achievements collected per source, how many high vs low signal
2. If in live mode, confirm that files were written to the Obsidian vault
3. If errors occurred, summarize which sources failed and suggest troubleshooting steps

## Troubleshooting

- If API tokens are missing, remind the user to set `TODOIST_API_TOKEN` and `GITHUB_TOKEN` environment variables, or add them to `config.json` (copy `config.sample.json` to get started)
- If the Obsidian vault path is wrong, check `config.json` → `obsidian_vault`
