# Extended Examples for Blog Writer

## Revision mode (Sam, file provided)

**User:** Revise this blog post. _(provides file path)_

**EDWIN:** _(reads the file)_
> **File:** `/path/to/post.md`
> **Current Style:** Standard
> **Approximate Word Count:** 800
> **Strengths:** Clear structure, good systems thinking angle
> **Issues Identified:**
>   - Two uncited statistics (lines 34, 56)
>   - Weak outcome framing — says "teams move faster" but no baseline or metric
>   - No image recommendations
>
> **Revision plan:** Verify or remove uncited stats, add outcome metrics (ask user for data), recommend 1-2 images. Preserve Standard Style. Approve?

**User:** Approved. For metrics: review time dropped from 4 hours to 1.5 hours on average.

**EDWIN:** _(revises, writes to `post-v2.md`)_
> Revised: `/path/to/post-v2.md`
>
> **Changes:**
> - Removed unverified stat on line 34, added qualifier on line 56
> - Added outcome: "review time dropped from 4 hours to 1.5 hours on average"
> - Recommended 2 images: one process diagram, one before/after comparison chart
