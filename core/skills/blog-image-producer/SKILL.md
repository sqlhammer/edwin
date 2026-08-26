---
name: blog-image-producer
description: Generates prompts for hand-drawn whiteboard diagram illustrations in a corporate training style. Use when the user says "create a blog image", "generate an illustration prompt", "I need a whiteboard-style diagram", or is working with the blog-writer skill and needs visual assets.
contexts: all
version: 1.0.0
requires: []
author: edwin-core
---

# Blog Image Producer

## Purpose

Generate detailed prompts for hand-drawn educational whiteboard diagram illustrations, optimized for use with image generation models. Produces prompts in a specific visual style: corporate training manual meets editorial illustration.

## When to use

- "Create a blog image for X" / "Generate an illustration prompt"
- "I need a whiteboard-style diagram" / "Make me a visual for this post"
- User is working with `blog-writer` and needs visual assets
- User wants a specific corporate-friendly illustration style

Not for:
- Photographs or realistic images
- Other illustration styles (this skill produces one specific aesthetic)

## Instructions

### 1. Scene definition

If the user has not described the scene to illustrate, ask:

> What scene or concept should this illustrate? Describe the key elements, message, or relationship you want to visualize.

Wait for their description before proceeding.

### 2. Generate the prompt

Produce a detailed image generation prompt following this structure and style specification.

#### Visual style characteristics

- **Canvas:** White background simulating a physical whiteboard, with a subtle gray border/frame and colored marker trays at the bottom edge
- **Characters:** Friendly, rounded cartoon figures with chunky black outlines, minimal shading, and flat fill colors — think corporate training manual meets editorial illustration. Characters have simple facial expressions conveying warmth and approachability
- **Typography:** Bold, uppercase sans-serif text in black for headings; mixed weight text for supporting points. Key phrases use blue or dark navy for emphasis. Bullet points use standard round dots
- **Layout:** Structured like a conceptual diagram — labels, arrows, and callout boxes connect elements spatially. Speech bubbles with rounded corners and thin black outlines carry dialogue or key statements
- **Color palette:** Predominantly white/off-white background; accents in sky blue, grass green (behind character figures as color-blocked halos), warm tan/brown for props. No gradients — flat, solid fills only
- **Line style:** Clean, consistent black outlines throughout. Arrows are simple with filled arrowheads. Overall feel is polished but deliberately "hand-crafted"

#### Prompt format

```
Create an image in the style of a hand-drawn educational whiteboard diagram illustration.

Visual style:
- White background simulating a physical whiteboard with subtle gray border and colored marker trays at bottom
- Friendly, rounded cartoon figures with chunky black outlines and flat fill colors
- Bold, uppercase sans-serif text in black for headings; blue/navy for emphasis
- Structured conceptual diagram with labels, arrows, callout boxes
- Color palette: white background, sky blue, grass green, warm tan/brown — no gradients
- Clean black outlines throughout; polished but hand-crafted feel

The scene to illustrate:
[Insert user's scene description here]

Maintain the whiteboard diagram aesthetic throughout. The image should feel like a slide from a high-quality explainer video or a published LinkedIn carousel post.
```

### 3. Deliver

Present the full prompt to the user. If image generation tools are available, offer to generate the image directly. If not, provide the prompt for the user to paste into their preferred image generation tool.

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| Image generation | Generate the image directly using available tools | Provide the prompt for manual use in an external image generator |

This skill produces prompts; image generation is optional enhancement, not a requirement.

## Examples

### Example 1: Blog post illustration (Alex)

**User:** Create a blog image for a post about AI code review workflows.

**EDWIN:**
> What scene or concept should this illustrate? Describe the key elements, message, or relationship you want to visualize.

**User:** Show a developer at a laptop, AI assistant represented as a friendly bot pointing at code on a screen, with arrows showing "code submission" → "AI analysis" → "feedback loop."

**EDWIN:**
> Here's your image generation prompt:
>
> ```
> Create an image in the style of a hand-drawn educational whiteboard diagram illustration.
>
> Visual style:
> - White background simulating a physical whiteboard with subtle gray border and colored marker trays at bottom
> - Friendly, rounded cartoon figures with chunky black outlines and flat fill colors
> - Bold, uppercase sans-serif text in black for headings; blue/navy for emphasis
> - Structured conceptual diagram with labels, arrows, callout boxes
> - Color palette: white background, sky blue, grass green, warm tan/brown — no gradients
> - Clean black outlines throughout; polished but hand-crafted feel
>
> The scene to illustrate:
> A developer (friendly cartoon figure with chunky black outline) sits at a laptop on the left side. To the right, an AI assistant is represented as a friendly robot character with a speech bubble. The robot is pointing at a code snippet displayed on a floating screen between them. Three arrows flow across the diagram: "Code Submission" (arrow from laptop to screen), "AI Analysis" (arrow from screen to robot), and "Feedback Loop" (arrow from robot back to developer). Label each arrow clearly in bold uppercase sans-serif. Use sky blue for the robot, grass green halo behind the developer, warm tan for the laptop.
>
> Maintain the whiteboard diagram aesthetic throughout. The image should feel like a slide from a high-quality explainer video or a published LinkedIn carousel post.
> ```
>
> Want me to generate this now, or will you use this prompt elsewhere?

**User:** Generate it now.

**EDWIN:** _(attempts image generation with available tools)_

### Example 2: No image generation available (Sam)

**User:** I need a whiteboard-style diagram showing the three phases of onboarding.

**EDWIN:**
> What scene or concept should this illustrate? Describe the key elements for each phase.

**User:** Phase 1 is "Welcome" with a handshake. Phase 2 is "Training" with a person at a desk with books. Phase 3 is "Launch" with a person holding a flag at the finish line.

**EDWIN:**
> Here's your image generation prompt:
>
> ```
> Create an image in the style of a hand-drawn educational whiteboard diagram illustration.
>
> Visual style:
> - White background simulating a physical whiteboard with subtle gray border and colored marker trays at bottom
> - Friendly, rounded cartoon figures with chunky black outlines and flat fill colors
> - Bold, uppercase sans-serif text in black for headings; blue/navy for emphasis
> - Structured conceptual diagram with labels, arrows, callout boxes
> - Color palette: white background, sky blue, grass green, warm tan/brown — no gradients
> - Clean black outlines throughout; polished but hand-crafted feel
>
> The scene to illustrate:
> Three sequential phases arranged horizontally from left to right. Phase 1 (left): Two cartoon figures shaking hands, labeled "WELCOME" in bold uppercase above. Phase 2 (center): One figure sitting at a desk with books, labeled "TRAINING" above. Phase 3 (right): One figure holding a flag at a finish line, labeled "LAUNCH" above. Connect the three phases with arrows flowing left to right. Use sky blue for Phase 1 figures, grass green for Phase 2, warm tan for Phase 3.
>
> Maintain the whiteboard diagram aesthetic throughout. The image should feel like a slide from a high-quality explainer video or a published LinkedIn carousel post.
> ```
>
> Image generation unavailable in this session. Use this prompt in your preferred image generation tool (DALL-E, Midjourney, Stable Diffusion, etc.).
