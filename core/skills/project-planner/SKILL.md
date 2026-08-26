---
name: project-planner
description: Work Breakdown Structure decomposition into deliverables, work packages, and tasks. Use when the user says "plan this project", "break down this work", "how do I structure", or provides an ambiguous goal that needs decomposition into sequenced, actionable tasks with milestones.
contexts: [Work]
version: 1.0.0
requires: []
author: edwin-core
---

# Project Planner

## Purpose

Take an ambiguous goal and decompose it into a clear, actionable structure — from high-level deliverables down to individual tasks. Favor clarity and completeness over optimism.

## When to use

- "Plan this project" / "Break down this work" / "How do I structure X"
- User provides a goal but no execution plan
- "What are the deliverables" / "What's the critical path"

Not for:
- Brainstorming options (use `strategist`)
- Workflow documentation (use `edwin-workflow-analyzer`)
- Task tracking (outside EDWIN's scope)

## Instructions

### 1. Charter

Define the objective:

> What does "done" look like? What's the clear success statement?

Identify constraints: timeline, budget, team size, dependencies, technology choices, regulatory requirements.

Identify stakeholders: who needs to be consulted, informed, or has approval authority?

Confirm scope by restating the project boundary — what's in and what's explicitly out:

```
**Objective:** [Clear success statement]
**Constraints:** [Key limitations]
**Scope — In:** [What's included]
**Scope — Out:** [What's excluded]
```

Wait for confirmation.

### 2. Decompose (WBS)

Break the project into a Work Breakdown Structure:

1. **Deliverables** — The major outputs (Level 1)
2. **Work Packages** — Groupings of related work within each deliverable (Level 2)
3. **Tasks** — Individual actions within each work package (Level 3)

Rules:
- Every task should be concrete and completable by one person/team
- Use verb-noun format for tasks: "Design database schema", "Write API integration tests"
- If a task feels too large to estimate, decompose it further
- Flag tasks with external dependencies or high uncertainty

Output: Indented hierarchical list or table.

### 3. Sequence

Identify dependencies. Mark as:
- **FS** (Finish-to-Start) — A must finish before B starts
- **FF** (Finish-to-Finish) — A and B must finish together
- **Parallel** — No dependency, can run concurrently

Identify the **critical path** — the longest chain of dependent tasks — this determines minimum project duration.

Define 3-5 milestones where progress can be verified.

### 4. Package

Deliver the final plan in a structured format:

```
## Project Plan: [Name]

### Milestones
| # | Milestone | Target | Depends On |
|---|-----------|--------|------------|
| 1 | ...       | ...    | ...        |

### Work Breakdown
#### Deliverable 1: [Name]
**Work Package 1.1: [Name]**
- [ ] Task 1.1.1 — [Description] — [Estimate] — [Owner slot]
- [ ] Task 1.1.2 — ...

#### Deliverable 2: [Name]
...

### Dependencies & Critical Path
[Visual or textual representation]

### Risks & Assumptions
- [Key risks with mitigation notes]
```

Estimates are optional — include them if the user provides enough context to estimate meaningfully. Do not fabricate time estimates.

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| File tools | Scan repository for technical context | Work from user-provided context only |
| Web search | Research similar project structures or validate assumptions | Work from general knowledge |

No scripts required. This skill is pure instruction.

## Examples

### Example 1: Customer onboarding portal (Alex)

**User:** Plan a project to build a customer onboarding portal.

**EDWIN:**
> What does "done" look like? What's the clear success statement?

**User:** New customers can sign up, verify email, complete a profile, and access their dashboard. No payment yet.

**EDWIN:**
> **Objective:** New customers can self-serve through signup, email verification, profile completion, and dashboard access.
> **Constraints:** Timeline? Team size? Tech stack?

**User:** 6 weeks. 2 engineers, 1 designer. Rails backend, React frontend.

**EDWIN:**
> **Objective:** Self-serve onboarding portal (signup → email verification → profile → dashboard access)
> **Constraints:** 6 weeks, 2 engineers, 1 designer, Rails + React
> **Scope — In:** Signup, email verification, profile form, dashboard landing page
> **Scope — Out:** Payment integration, admin user management, analytics dashboard
>
> Confirm?

**User:** Confirmed.

**EDWIN:**
> ## Project Plan: Customer Onboarding Portal
>
> ### Milestones
> | # | Milestone | Target | Depends On |
> |---|-----------|--------|------------|
> | 1 | Signup + email flow functional | Week 2 | Backend + frontend work packages 1.1, 1.2 |
> | 2 | Profile creation complete | Week 4 | Work packages 2.1, 2.2 |
> | 3 | Dashboard access live | Week 5 | Work package 3.1 |
> | 4 | QA + polish complete | Week 6 | All prior milestones |
>
> ### Work Breakdown
> #### Deliverable 1: Signup & Email Verification
> **Work Package 1.1: Backend**
> - [ ] Task 1.1.1 — Design user schema (users table, auth fields) — 1 day — Backend Eng
> - [ ] Task 1.1.2 — Build signup API endpoint — 2 days — Backend Eng
> - [ ] Task 1.1.3 — Implement email verification token flow — 2 days — Backend Eng
> - [ ] Task 1.1.4 — Write integration tests for signup/verification — 1 day — Backend Eng
>
> **Work Package 1.2: Frontend**
> - [ ] Task 1.2.1 — Design signup form UI (Figma) — 2 days — Designer
> - [ ] Task 1.2.2 — Build signup form component — 2 days — Frontend Eng
> - [ ] Task 1.2.3 — Build email verification landing page — 1 day — Frontend Eng
>
> #### Deliverable 2: Profile Creation
> **Work Package 2.1: Backend**
> - [ ] Task 2.1.1 — Extend user schema for profile fields — 1 day — Backend Eng
> - [ ] Task 2.1.2 — Build profile update API endpoint — 2 days — Backend Eng
> - [ ] Task 2.1.3 — Write tests for profile updates — 1 day — Backend Eng
>
> **Work Package 2.2: Frontend**
> - [ ] Task 2.2.1 — Design profile form UI — 2 days — Designer
> - [ ] Task 2.2.2 — Build profile form component — 2 days — Frontend Eng
> - [ ] Task 2.2.3 — Wire profile form to backend API — 1 day — Frontend Eng
>
> #### Deliverable 3: Dashboard Access
> **Work Package 3.1: Frontend**
> - [ ] Task 3.1.1 — Design dashboard landing page — 2 days — Designer
> - [ ] Task 3.1.2 — Build dashboard component — 2 days — Frontend Eng
> - [ ] Task 3.1.3 — Implement auth-gated routing — 1 day — Frontend Eng
>
> #### Deliverable 4: QA & Polish
> **Work Package 4.1: Testing & Refinement**
> - [ ] Task 4.1.1 — End-to-end manual QA pass — 2 days — All
> - [ ] Task 4.1.2 — Fix critical bugs — 2 days — Engineers
> - [ ] Task 4.1.3 — UI polish (spacing, error messages, loading states) — 1 day — Designer + Frontend Eng
>
> ### Dependencies & Critical Path
> - **Critical path:** 1.1.1 → 1.1.2 → 1.2.2 → 2.1.2 → 2.2.3 → 3.1.2 → 4.1.2 (23 days)
> - Designer work (1.2.1, 2.2.1, 3.1.1) can run in parallel with backend tasks
> - QA (4.1.1) blocks final polish (4.1.3)
>
> ### Risks & Assumptions
> - **Risk:** Email deliverability issues may surface late (no SMTP testing in scope). **Mitigation:** Test with SendGrid sandbox in week 1.
> - **Assumption:** No complex profile validation rules beyond required fields.
> - **Assumption:** Auth is handled by existing Rails session logic (no OAuth/SSO in scope).

### Example 2: No context available (Sam)

**User:** Plan a project to migrate our infrastructure to Kubernetes.

**EDWIN:**
> What does "done" look like? What's in scope — all services, or a subset? What's the timeline and team size? What are you migrating from?
