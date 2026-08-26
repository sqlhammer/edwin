# Blog Draft File Structure

## Folder structure

When writing to `user/config.json` `paths.blogDrafts`:

```
[paths.blogDrafts]/
  YYYY-MM/
    {post-slug}/
      {post-slug}.md
```

- Each post gets its own folder named `{post-slug}` — images for the post live alongside the draft in this folder
- `post-slug` = kebab-case title (e.g., `engineering-teams-in-an-ai-world`)
- `YYYY-MM` = current year and month

## Frontmatter template

```yaml
---
title: [Post Title]
date: [YYYY-MM-DD]
status: draft
style: [standard / narrative]
audience: [target audience]
platform: [target platform]
tags: [relevant tags derived from topic and notes]
sources:
  - [source 1 — format: "Title — URL or file path"]
  - [source 2]
---
```
