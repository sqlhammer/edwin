# EDWIN v0.2 Test Suite

Automated and manual testing infrastructure for WU-16.

## Automated Tests

**Script:** `run-e2e.mjs`

**Safety:** Never touches real user data. All tests run in temporary directories. Verifies at completion that the repo's `user/` directory was not modified.

### What It Tests (macOS)

✓ **Validation**
- edwin-doctor validates repo structure (handles plugin-skills-drift)

✓ **Sync Engine**
- Installs to temp home: CLAUDE.md, skills, manifest
- Idempotency: second sync reports no changes
- Managed markers: user content outside markers survives re-sync
- CLAUDE.md without markers: gets block appended rather than replaced
- Pruning: removed skills are deleted from installed location

✓ **Context Operations**
- Create, remove contexts
- Global context cannot be removed

✓ **Memory & Brags** (with `--root` flag)
- Memory: append entries
- Brags: add category, append, list, month heading format

✓ **Bundle & Plugin**
- Bundle export dry-run
- Plugin build: `npm run build-plugin` produces `skills/` matching `core/skills/`
- Optional: claude CLI lists plugin skills (if `claude` binary available)

✓ **Installers & Scheduler**
- Scheduler: dry-run produces valid plist (validated with `plutil`)
- Line endings *as stored in git*, per interpreter — CRLF for `.cmd`/`.ps1`, LF for `.command`/`.sh` — since
  a raw download serves the stored bytes verbatim
- macOS installer: full install over `file://`, requires repo URL, `--skip-deps` and no-console refusals
- Windows installer (PowerShell, run via `pwsh`): every `.ps1` parses, full install over `file://`, the
  updater over the result including its refusal on changes outside `user/`, non-empty target, URL
  resolution, missing Git, Node.js 16, no-console decline
- The two `.cmd` launchers stay thin and point at a `.ps1` that exists

✓ **Personal Data Audit**
- Greps tracked files for patterns in denylist.txt and common leaks
- Excludes `user/`, `specs/`, and `docs/testing/` from scan

### What It Does NOT Test (See Manual Script)

- Windows-specific functionality (this runs on macOS)
- Real Claude Desktop / Cowork UI interactions
- Browser portal paste workflow
- The double-click gesture itself, UAC, winget, and MSI installs (the installer logic *is* tested)
- Non-technical user following HTML guides
- Uninstall-clean verification on real install

### Running

```bash
# Run all tests
node tools/test/run-e2e.mjs

# JSON output for tooling
node tools/test/run-e2e.mjs --json

# Help
node tools/test/run-e2e.mjs --help
```

### Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed
- `2` - Bad usage

### Output Format

Standard mode prints:
- `✓` for passing tests
- `✗` for failures with reason
- `⊘` for skipped tests with reason
- Summary table at end

JSON mode (`--json`) outputs:
```json
{
  "ok": true,
  "passed": 15,
  "failed": 0,
  "skipped": 2,
  "total": 17,
  "tests": [...]
}
```

## Manual Tests

**Script:** `../../docs/testing/manual-test-script.md`

Numbered step-by-step script for human testers. Covers:
- Windows-only paths
- Real UI interactions
- Double-click installer flow
- Non-technical tester acceptance
- Uninstall verification

Each step has:
- Clear instruction
- Expected result
- Pass/Fail checkbox

## Adding Tests

To extend the automated harness:

1. Add test function in `run-e2e.mjs`
2. Use helper functions:
   - `pass(name, details)` - record success
   - `fail(name, reason)` - record failure
   - `skip(name, reason)` - record skip
3. Use `run(cmd, cwd)` to execute commands
4. Use `assertInTempDir(path, tempRoot)` before destructive operations
5. Never touch paths outside `TEMP_ROOT`

## Safety Guarantees

The harness:
- Creates all test data in `os.tmpdir()/edwin-test-<timestamp>`
- Hashes `user/` directory before tests
- Verifies hash unchanged after tests
- Aborts if any resolved path escapes temp root
- Cleans up temp directory on completion

If the final safety check fails, **the test run itself is a failure** (exit 1), regardless of individual test results.

## Known Limitations

- **macOS only**: Windows paths, Task Scheduler, UAC, winget/MSI installs, and the double-click experience
  cannot be tested on this machine. The Windows installer's *logic* can be, and is: it is PowerShell, `pwsh`
  runs here, and the suite drives a full install, the updater, and the refusal paths by execution. The `.cmd`
  files are launchers, checked only for staying thin (no `for /f`, no multi-line block, under 60 lines) and
  for pointing at a `.ps1` that exists.
- **`pwsh` required for the Windows checks**: they skip, loudly, if it is not installed —
  `brew install powershell/tap/powershell`
- **No real UI**: Cannot test Claude Desktop/Cowork/web portal interactions
- **No remote clone**: Both installers accept `file://`, so the full install is tested against a local
  fixture built from the tracked working tree. No network, and no GitHub remote needed.
- **No real scheduling**: Tests only `--dry-run` mode and plist validation

These are covered in the manual test script.

## Test Matrix Coverage

| Scenario | Automated | Manual | Notes |
|---|---|---|---|
| edwin-doctor validation | ✓ | | Including plugin-skills-drift handling |
| Sync to temp home | ✓ | | |
| Idempotency | ✓ | | |
| Managed markers | ✓ | | Includes no-markers case |
| Pruning | ✓ | | |
| Context operations | ✓ | | Create, remove, Global protection |
| Memory operations | ✓ | | With --root flag |
| Brags operations | ✓ | | With --root flag, TZ handling |
| Bundle export | ✓ | | Dry-run mode |
| Plugin build | ✓ | | Includes claude CLI test if available |
| Scheduler scripts | ✓ | | Dry-run + plist validation |
| Installer validation | ✓ | Partial | Full install over `file://` on both platforms, plus refusals; winget/MSI/UAC manual |
| Personal data audit | ✓ | | |
| Double-click install | Partial | ✓ | Installer logic automated against a `file://` fixture; the double-click itself is manual |
| Onboarding flow | | ✓ | Requires real UI |
| Windows paths | | ✓ | This is macOS |
| Skill trigger/routing | | ✓ | Requires real harness |
| Scheduled task fires | | ✓ | Requires OS scheduler |
| Bundle paste to portal | | ✓ | Requires web browser |
| Update preserves user/ | ✓ | Partial | Windows updater automated over an installed fixture; macOS is manual |
| Uninstall clean | | ✓ | Requires real install |
