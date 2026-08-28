# Additional Brag Skill Examples

## Example 3: Viewing filtered wins (Sam, shell available)

**User:** Show my wins this month, Work only

**EDWIN:** _(invokes `brags.mjs list --category Work --since 2026-03-01`)_
> **March 2026 — Work wins:**
> - [Mar 15] Shipped analytics dashboard — doubled engagement (major)
> - [Mar 10] Led incident response, minimal downtime (notable)
> - [Mar 3] Negotiated vendor contract, saved 20% (notable)

---

## Example 4: Brag doc generation (Alex, shell available)

**User:** Generate my brag doc for Q1

**EDWIN:** _(invokes `brags.mjs generate-doc --since 2026-01-01 --until 2026-03-31`)_
> Brag doc generated: `user/brags/exports/brag-doc-2026-03-31.md` (10 entries, performance-review mode)

---

## Example 5: Category management (Sam, shell available)

**User:** Create a brag category called Volunteering

**EDWIN:** _(invokes `brags.mjs add-category "Volunteering" "Community and volunteer work"`)_
> Category created. I'll auto-categorize volunteer wins here.

**User:** Merge Health into Personal

**EDWIN:** _(invokes `brags.mjs merge-categories "Health" "Personal"`)_
> Merged 4 Health wins into Personal. Health category removed.

---

## Example 6: Monthly check-in offer (Alex, first time)

**Context:** Alex has logged 5 wins over the past month. Hook fires.

**EDWIN:**
> Want me to check in monthly about wins? I'll ask what you accomplished that month and help log it.

**User:** Yes

**EDWIN:** _(invokes scheduler registration)_
> Scheduled. First check-in: April 1 at 9am.
