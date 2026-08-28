# WU-13 Portal Bundle Testing Checklist

**Acceptance criteria:** Each portal bundle for a sample Work context is generated within its size limits and, pasted into a real portal, produces an assistant that self-identifies as EDWIN, lists its skills, and executes two skills correctly.

## Mechanical Verification (Automated)

- [x] Script exists at correct path: `tools/bundle/build-bundle.mjs`
- [x] Script supports `--help` flag
- [x] Portal limits file exists: `tools/bundle/portal-limits.json`
- [x] Limits marked as estimates with verification dates and sources
- [x] `npm run bundle` command wired to script
- [x] Bad usage exits with code 2
- [x] Expected failures exit with code 1
- [x] Unknown context produces clear error message
- [x] Bundles generated under `dist/bundles/<portal>/<context>/`
- [x] `dist/` directory in .gitignore
- [x] Instruction files within portal character limits
- [x] Knowledge files generated for Claude (supports them)
- [x] Truncation manifests generated when oversized
- [x] `--diff` mode detects stale bundles correctly
- [x] Idempotent: second run with no changes produces no regeneration
- [x] Single skill edit flags only affected bundles as stale
- [x] Degradation rewrites applied to skills with script hooks

## Manual Portal Testing (PENDING)

These tests require logging into real portals and cannot be automated. Each should be tested by a human before WU-13 is considered fully accepted.

### Claude Projects (claude.ai)

- [ ] **PENDING:** Create new Project named "EDWIN Work Test"
- [ ] **PENDING:** Paste `dist/bundles/claude/Work/instructions.txt` into Project custom instructions
- [ ] **PENDING:** Upload all files from `dist/bundles/claude/Work/knowledge/` to Project knowledge
- [ ] **PENDING:** Start conversation, ask "Who are you?" — assistant self-identifies as EDWIN
- [ ] **PENDING:** Ask "List my skills" — assistant lists Work context skills
- [ ] **PENDING:** Execute `briefing` skill: provide a sample report and ask for a brief
- [ ] **PENDING:** Execute `edwin-context` skill: ask "What context am I in?" — responds "Work"
- [ ] **PENDING:** Verify skills with script hooks show degraded behavior (no shell commands attempted)

### Gemini Gems

- [ ] **PENDING:** Create new Gem named "EDWIN Work Test"
- [ ] **PENDING:** Paste `dist/bundles/gemini/Work/instructions.txt` into Gem instructions
- [ ] **PENDING:** Start conversation, ask "Who are you?" — assistant self-identifies as EDWIN
- [ ] **PENDING:** Ask "List my skills" — assistant lists Work context skills
- [ ] **PENDING:** Execute `briefing` skill: provide a sample report and ask for a brief
- [ ] **PENDING:** Execute `edwin-context` skill: ask "What context am I in?" — responds "Work"
- [ ] **PENDING:** Verify truncation manifest exists if bundle exceeded 20,000 chars
- [ ] **PENDING:** Verify skills with script hooks show degraded behavior

### Microsoft Copilot

- [ ] **PENDING:** Navigate to Copilot custom instructions
- [ ] **PENDING:** Paste `dist/bundles/copilot/Work/instructions.txt` into custom instructions
- [ ] **PENDING:** Start conversation, ask "Who are you?" — assistant self-identifies as EDWIN
- [ ] **PENDING:** Ask "List my skills" — assistant lists Work context skills
- [ ] **PENDING:** Execute `briefing` skill: provide a sample report and ask for a brief
- [ ] **PENDING:** Execute `edwin-context` skill: ask "What context am I in?" — responds "Work"
- [ ] **PENDING:** Verify truncation manifest exists if bundle exceeded 10,000 chars
- [ ] **PENDING:** Verify skills with script hooks show degraded behavior

## Personal Data Flags

- [ ] **PENDING:** Generate bundle with `--include-memory`, verify watermark present
- [ ] **PENDING:** Verify memory digest appended to instructions
- [ ] **PENDING:** Generate bundle with `--include-brags`, verify watermark present
- [ ] **PENDING:** Verify achievements appended to instructions (when WU-18 exists)

## Degradation Verification

These verify that skills with script hooks have their harness-only instructions rewritten to web-appropriate behavior:

### edwin-context skill (has script hooks)

- [x] **AUTOMATED:** Original skill contains "Shell available:" instructions
- [x] **AUTOMATED:** Bundle version removes script hooks section
- [x] **AUTOMATED:** Bundle version rewrites shell invocations to file-tools fallback
- [ ] **PENDING:** In real portal, skill falls back gracefully when attempting context operations

### blog-writer skill (if has script hooks)

- [ ] **AUTOMATED:** Check if skill has script hooks
- [ ] **AUTOMATED:** If yes, verify script hooks section removed in bundle
- [ ] **AUTOMATED:** If yes, verify shell instructions rewritten
- [ ] **PENDING:** In real portal, skill falls back gracefully

## Notes

- All PENDING items require human portal access and should be tested before release
- Automated checks verify file structure, sizes, and text transformations
- Manual checks verify actual AI behavior in production portals
- Portal limits in `tools/bundle/portal-limits.json` are ESTIMATES and should be updated when real limits are discovered through testing
