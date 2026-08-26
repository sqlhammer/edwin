# Your EDWIN folder

Everything in this folder is **yours** and stays on this machine.

EDWIN keeps your settings, your memory, your logged wins, and anything else personal in here. None of it
is ever committed to the repository, uploaded, or copied anywhere else. The only file in this folder that
is part of EDWIN itself is the one you are reading.

## What lives here

| File or folder | What it holds |
|---|---|
| `config.json` | Your name, how you like to be addressed, your contexts, your preferences |
| `state.json` | Which context you're currently in |
| `memory/` | What EDWIN has learned about you, and things it has noticed but not yet asked about |
| `brags/` | Your logged wins, your categories, and any brag documents you've generated |
| `workflows/` | Descriptions of how you do recurring tasks, used to build new skills |
| `schedule.json` | A record of anything EDWIN has scheduled for you |
| `schedule-logs/` | Output from scheduled runs |

The folder starts empty. EDWIN fills it in as you use it — the first conversation creates `config.json`
and `state.json`.

## Things worth knowing

**Updating EDWIN never touches this folder.** Pull a new version, run the installer again, reinstall from
scratch — your data stays exactly as it was.

**You can edit any of these files by hand.** They are deliberately plain: readable markdown and small JSON.
If something is wrong, open it and fix it. EDWIN will cope.

**Back it up if it matters to you.** This folder is excluded from the repository on purpose, which also
means git is not backing it up. If you have months of memory and logged wins in here, copy the folder
somewhere safe now and then.

**To start over,** delete the folder's contents (keep this file) and tell EDWIN "set up EDWIN".
