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
Feature-guide `**Assigned to:**` fields are the implementation-assignment signal for branch execution. The ownership matrix in `.agent/PROCESS-FLOW.md` defines domain-event producer/consumer boundaries only and does not replace assignee ownership. Do not create or maintain another assignee source-of-truth document.

### 1.9
The current `.agent/` numbering is the canonical execution numbering. Preserve traceability through `.agent/ALL-BRANCHES-QUICK-REFERENCE.md` and `.agent/checklist.md` instead of mixing numbering systems.

### 1.10
If `.agent/` intentionally changes product behavior from earlier requirement references, record that change explicitly in the affected guide and in the relevant shared contract file. Silent behavior changes are not allowed.

### 1.11
External process-flow and schema artifacts are reference context only; resolve implementation text against current `.agent/` docs and current repository boundaries.

### 1.12
When integrating UI from Figma, document the exact design URL, node IDs, and the implemented pattern mapping in `.agent/PROJECT-OVERVIEW.md` during the same task so design-to-code provenance is auditable.

### 1.13
When writing PL/pgSQL functions that `RETURNS TABLE` or otherwise expose output parameters, qualify table references inside DML and counts with table aliases whenever output-column names match table columns. Unqualified `where competition_id = ...` style predicates can bind to function output parameters first and trigger 42702 ambiguity.

## 2. Product Rules

### 2.1
This project is a greenfield rebuild of the Mathwiz product. Implementation decisions must come from `.agent/`, repo-local files, the live Figma view, and current research rather than assumptions from previous implementations.

### 2.2
The platform has exactly three first-class roles in release one: `mathlete`, `organizer`, and `admin`.

### 2.3
Mathematical authoring and answering must use a visual editor workflow. Raw LaTeX-only entry is not an acceptable primary UX.

### 2.4
Organizer and admin workspaces are data-heavy and must be planned for mobile responsiveness, keyboard access, and table-heavy workflows from the start.

### 2.5
Answer-key visibility initializes as `after_end` default-on. Participant visibility requires trusted server end-time and context ownership checks. The `hidden` state is an explicit organizer override, and `leaderboard_published` must not control answer-key access.

## 3. Technical Rules

### 3.1
Use Next.js App Router, React 19, and Supabase SSR patterns as the baseline architecture for the rebuild.

### 3.2
Service-role access belongs only in server-only utilities, server actions, route handlers, or trusted background jobs.

### 3.3
Auth, redirects, and profile completion are platform concerns handled with trusted server-aware routing.

### 3.4
Use an open-source-first implementation policy for complex features. Prefer maintained, documented libraries instead of custom-building equivalents, unless a concrete blocker is documented.

### 3.5
Realtime functionality is valuable for leaderboards and monitoring, but broad subscriptions on hot tables are a scalability risk and must be scoped tightly.

### 3.6
Organizer lifecycle handlers must tolerate under-migrated databases gracefully. Prefer fallback reads/writes or user-friendly unavailability messages instead of raw DB errors or 500s when schema columns/RPCs drift.

### 3.7
**MathLive Architecture Boundaries**  
Math input and rendering are locked: MathLive is the only editable math-input component, KaTeX is the static renderer, and LaTeX is the canonical persisted format.

### 3.8
**MathLive Configuration & Spacing Conflicts**  
MathLive spacebar behavior in math mode must be mapped using native overrides (`mathModeSpace = "\\:"`) to prevent it from dropping users into pure text mode randomly. Avoid custom DOM keydown spacebar handlers that try to arbitrarily construct and insert `\text{ }` wrappers manually.

### 3.9
**MathLive Styling Constraints**  
Do not apply custom selection-color overrides to MathLive text mode; keep native styling so text/math modes remain visually consistent. Only apply a subtle light-blue custom tint for MathLive text-token vs math-token differentiation.

### 3.10
**MathLive Focus Management & DOM Interactions**  
- **Scope Blur/Focus:** Document-level pointer/Escape handlers must be scoped to the active field to prevent cross-instance focus toggles.
- **Clear Stale Context:** When switching fields, explicitly clear stale `.ML__focused` markers to avoid visual dual-caret artifacts.
- **Preserve Selections:** Defer blur until `pointerup` and skip blur when a non-collapsed selection is dragged so outside text selection remains functional.
- **Click-Targets:** Mode/symbol controls (like UI buttons outside the canvas) must not steal DOM focus from their owning field. Because clicks on complex sibling DOM trees may miss `.composedPath()` detection, append routing wrappers via `data-mathlive-root-for` element lookups as fallback checks.

### 3.11
**MathLive Hydration Preservation**  
`ProblemForm` hydration for legacy MathLive formulas must only unwrap top-level wrappers (e.g., `\text{...}`) and must never strip purely canonical balanced `$...$` delimiters from imported LaTeX content.

### 3.12
**React Rendering Constraints**  
When rendering lists of items containing user-editable ID fields, never use the editable field itself as the React `key`. This triggers forceful component remounts and destroys internal DOM state (caret positions, focus, MathLive modes). Use stable monotonic counters or UUID-based generation instead.

### 3.13
Competition create and post-save refresh paths must apply the same legacy-column fallback used by organizer competition reads. Under-migrated environments can fail on modern `competitions` select lists even when insert/save succeeds, so create flows must retry with legacy select columns before surfacing a generic 500.

### 3.14
Competition mutation routes must use the same legacy competition-read fallback as organizer pages, not just create flow. Publish/save/delete can succeed or partially succeed on older schemas while the follow-up modern read fails; compatibility reads and delete fallbacks must turn those cases into deterministic success or explicit `service_unavailable`, never generic `operation_failed`.

### 3.15
Organizer competition create and save paths must serialize scoring, penalty, and tie-breaker values to database enum tokens before hitting insert/update RPCs. UI/domain tokens remain the API contract, but raw `difficulty`, `fixed_deduction`, and `lowest_total_time` values cannot be sent directly to lifecycle SQL that still casts legacy enum names.

### 3.16
`save_competition_draft` still reads `customPoints`, so `buildCompetitionDraftRpcPayload` must forward `customPoints: customPointsByProblemId` alongside the existing field shape. Dropping that alias regresses draft save compatibility even when UI state is valid.

### 3.17
Lifecycle RPC normalization must not invent `operation_failed` when payload lacks explicit `machine_code` / `machineCode`. Treat unshaped objects as unknown so organizer routes can fall back to readback success instead of surfacing false failure states.

## 4. Workflow Rules

### 4.1
Use Gemini CLI at fixed checkpoints on substantial work: before risky architecture refactors, after core implementation, and before final handoff.

### 4.2
Use subagents by default for audits, reviews, and structured edit planning. Validate subagent findings with direct file evidence before applying patches.

### 4.3
Do not report a branch as complete until `npm run lint`, `npm run test`, `npm run build`, local dev checks, and a manual UI pass have all succeeded. Documentation outputs must be verified by `git diff`.

### 4.4
If implementation uncovers cross-cutting work that should have been planned earlier, correct the feature guide directly instead of leaving knowledge implicit.

### 4.5
Applied migration history on remote Supabase instances is not sufficient proof for local validation. Execute migrations strictly in ascending timestamp order. Instead of trusting migration logs, verify concrete column dependencies inside live logic and push corrections as *new* forward migrations if drift exists. Before declaring migration branches done, pass: `npm run supabase:status`, `npm run supabase:db:reset`, and standard unit checks.

### 4.6
Branch `04` owns admin review and moderation shell features. Branch `05` owns applicant-facing intake, status queries, activation processes, and workspace onboarding. Maintain this separation of concerns.

### 4.7
Branches `01` through `05` are considered locked. Do not inject new cross-cutting contract changes directly back into those legacy guides; use shared `.agent` contracts or new sequential branches.

### 4.8
When executing tooling commands in constrained interactive shells where tools like `rg` or `find` might be missing, pivot seamlessly to workspace-native searches or code reading instead of breaking execution logic over command unavailability.

### 4.9
Always use sub-agents for tasks whenever possible. Prefer combined end-to-end delegations that include audit + edit + validation context in one prompt. The primary agent must still verify sub-agent output with direct file evidence before finalizing.

### 4.10
If user explicitly forbids sub-agents for current task, execute directly in main session and do not delegate until user lifts that constraint.
