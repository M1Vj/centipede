# Learned Rules

This file stores project-specific rules learned during planning and implementation. Append new rules instead of rewriting old ones unless a rule is clearly obsolete.

## 1. Documentation Rules

### 1.1

`.agent/` is the active planning folder and must be used for execution decisions.

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

Feature-guide `**Assigned to:**` fields are the implementation-assignment signal for branch execution. The ownership matrix in `.agent/PROCESS-FLOW.md` defines domain-event producer/consumer boundaries only and does not replace assignee ownership. Do not create or maintain another assignee source-of-truth document unless the user explicitly asks for one.

### 1.9

The current `.agent/` numbering is the canonical execution numbering. Preserve traceability through `.agent/ALL-BRANCHES-QUICK-REFERENCE.md` and `.agent/checklist.md` instead of mixing numbering systems.

### 1.10

If `.agent/` intentionally changes product behavior from earlier requirement references, record that change explicitly in the affected guide and in the relevant shared contract file. Silent behavior changes are not allowed.

### 1.11

External process-flow and schema artifacts are reference context only. They are not copy sources for current contracts. Resolve implementation text against current `.agent/` docs and current repository boundaries.

## 2. Product Rules

### 2.1

This project is a greenfield rebuild of the Mathwiz product. Implementation decisions must come from `.agent/`, repo-local files, the live Figma view, and current research rather than assumptions from previous implementations.

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

### 3.5

Use an open-source-first implementation policy for complex features. Prefer maintained, documented libraries and services instead of custom-building equivalents unless a concrete blocker is documented in the active feature guide.

### 3.6

Math input and rendering are locked in release one: MathLive is the only editable math-input component, KaTeX is the static renderer, and LaTeX is the canonical persisted format. Do not introduce MathQuill or alternate editor stacks in implementation branches.

### 3.7

Do not report documentation edits as complete until they are confirmed by direct file reads or `git diff` output from the current workspace.

### 3.8

FR14.5 answer-key contract is default-on: new competitions must initialize `answer_key_visibility = after_end`. Participant answer-key visibility requires trusted server end-time and participant-context ownership checks. `hidden` is explicit organizer override, and `leaderboard_published` must not control answer-key access.

### 3.9

Organizer lifecycle handlers must tolerate under-migrated databases where branch-05 RPCs or organizer intake/status columns are missing. Prefer trusted fallback reads or writes when safe, and otherwise return non-disclosing lookup outcomes or user-friendly temporary-unavailable messages instead of raw DB errors or 500s.

## 4. Workflow Rules

### 4.1

Use Gemini CLI at fixed checkpoints on substantial work: before risky architecture refactors, after core implementation and before final verification, and before final handoff. If repeated `MODEL_CAPACITY_EXHAUSTED` errors block review after three headless/interactive attempts, continue with local analysis and record that limitation in the handoff.

### 4.2

Do not claim a branch is complete until `npm run lint`, `npm run test`, `npm run build`, local dev checks, and a manual UI pass have been done.

### 4.3

If implementation uncovers cross-cutting work that should have been planned earlier, fix the feature guide instead of leaving the knowledge implicit.

### 4.4

Admin approval and organizer activation are separate ownership concerns in the rebuilt plan. Branch `04-admin-user-management` owns the admin review and moderation shell plus organizer-application decision writes, while branch `05-organizer-registration` owns applicant-facing intake and status visibility, organizer activation/provisioning, organizer workspace onboarding, and the applicant-facing lifecycle handoff after approved or rejected decisions.

### 4.5

Migration execution is timestamp-ordered and append-only. Apply migrations in ascending filename timestamp order, never edit or reorder applied migration files, and deliver corrections as new higher-timestamp migrations. Before claiming completion on migration branches, pass verification gates: `npm run supabase:status`, `npm run supabase:db:reset`, `npm run lint`, `npm run test`, and `npm run build`.

### 4.6

For this project, use subagents by default for audits, reviews, and structured edit planning. Validate subagent findings with direct file evidence before applying patches.

### 4.7

Tooling commands can be unavailable in constrained shells (for example `rg`, `find`, or `xargs`). When that happens, switch to workspace-native file search and read tools instead of assuming command availability.

### 4.8

Applied migration history on a remote Supabase project is not sufficient proof that required schema objects exist. Before relying on a previously applied migration during bug-fix or QA work, verify the concrete columns, functions, or policies needed by the live path and ship a new forward correction migration if drift is found.

### 4.9

Branches `01` through `05` are considered done and locked for continuous development planning. Do not introduce new cross-cutting contract hardening edits in those feature guides unless the user explicitly requests reopening them; place new global rules in shared `.agent` contracts or in later branch guides.
