# Learned Rules

This file stores project-specific rules learned during planning and implementation. Append new rules instead of rewriting old ones unless a rule is clearly obsolete.

## 1. Documentation Rules

### 1.1

`.agent/` is the active planning folder. `.agents/` is legacy content kept only for historical reference until the rename is fully reconciled.

### 1.2

Keep the weekly/date bucket structure under `.agent/features/`. Branch names come from the feature file itself, not the bucket folder name.

### 1.3

When backend behavior changes, update `.agent/DATABASE-EDR-RLS.md` in the same branch. Do not defer schema-documentation updates to a cleanup branch.

### 1.4

When a new project constraint or correction is learned, append it here immediately so later branches do not repeat the same mistake.

### 1.5

`.agent/` must remain executable by a blank-slate implementation AI using only the current repository, `.agent/`, the live Figma link, and current internet research. Do not require inaccessible local files. If a critical requirement is learned from outside those sources, rewrite it directly into `.agent/` before relying on it.

### 1.6

Do not use raw requirement IDs as standalone meaning in feature headers or execution instructions. If internal requirement codes are mentioned, pair them with plain-language requirement coverage so a blank-slate implementer can understand scope without a separate requirement index.

### 1.7

`.agent/PROCESS-FLOW.md` is the repo-local workflow source of truth. When role behavior, notifications, arena steps, approvals, publication rules, disputes, or post-competition flows are implemented or revised, update that file in the same branch if the flow contract changes.

### 1.8

Feature-guide `**Assigned to:**` fields are the only ownership signal that implementation agents should rely on. Do not create or maintain a separate ownership source-of-truth document unless the user explicitly asks for one.

## 2. Product Rules

### 2.1

This project is a greenfield rebuild of the Mathwiz product. Implementation decisions must come from `.agent/`, repo-local files, the live Figma view, and current research rather than legacy-code assumptions.

### 2.2

The platform has exactly three first-class roles in release one: `mathlete`, `organizer`, and `admin`.

### 2.3

Mathematical authoring and answering must use a visual editor workflow. Raw LaTeX-only entry is not an acceptable primary UX.

### 2.4

Organizer and admin workspaces are data-heavy and must be planned for mobile responsiveness, keyboard access, and table-heavy workflows from the start.

## 3. Technical Rules

### 3.1

Use Next.js App Router, React 19, and Supabase SSR patterns as the baseline architecture for the rebuild.

### 3.2

Service-role access belongs only in server-only utilities, server actions, route handlers, or trusted background jobs.

### 3.3

Auth, redirects, and profile completion are platform concerns. They are not isolated UI tasks and must be handled with trusted server-aware routing.

### 3.4

Realtime is valuable for notifications, announcements, leaderboards, and monitoring, but broad subscriptions on hot tables are a scalability risk and must be scoped tightly.

## 4. Workflow Rules

### 4.1

Use Gemini CLI at meaningful checkpoints when it is available. If repeated `MODEL_CAPACITY_EXHAUSTED` errors block review, continue with local analysis and record that limitation in the handoff.

### 4.2

Do not claim a branch is complete until lint, relevant tests, local dev checks, and a manual UI pass have been done.

### 4.3

If implementation uncovers cross-cutting work that should have been planned earlier, fix the feature guide instead of leaving the knowledge implicit.
