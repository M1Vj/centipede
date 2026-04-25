# 08 - Competition Wizard

- Feature branch: `feature/competition-wizard`
- Requirement mapping: UR7, UR7a, UR7b, part of UR8 — competition creation, schedule and format setup, publish safety, anti-cheat configuration, and organizer lifecycle controls
- Priority: 8
- **Assigned to:** Mabansag, Vj

## Mission

Build the end-to-end competition creation and lifecycle system for organizers. This includes draft creation, schedule and format configuration, problem selection, scoring and anti-cheat configuration, publish safety, and organizer controls for open and scheduled competitions.

This branch exists because the wizard is the structural center of the product. It owns publish rules, snapshots, defensive validation, and the lifecycle that live monitoring, registration, and leaderboards depend on.

Depends on: `06-problem-bank`, `07-scoring-system`.

Unblocks: team registration, discovery, arena, monitoring, leaderboard publication.

## Full Context

- Business context: organizers need a safe way to create high-stakes competitions without accidental publish or invalid configuration.
- User roles: organizers as authors, admins as overseers, mathletes as downstream consumers of published output.
- UI flow: overview page, schedule page, format page, problems and scoring page, anti-cheat page, review and publish page.
- Backend flow: draft persistence, snapshotting competition problems, publish transition, lifecycle events, deletion rules, and lifecycle state guards that later live controls reuse.
- Related tables/functions: `competitions`, `competition_problems`, `competition_events`, grading rule helpers, problem snapshots.
- Edge cases: duplicate competition names, invalid registration windows, open competition with scheduled-only options, deleting active open competition, editing a published competition.
- Security concerns: draft mutation ownership is organizer-only for organizer-owned drafts; admin moderation controls are outside this branch boundary and belong to branch `16`; publish must be a trusted action; snapshots must be immutable.
- Performance concerns: with a 2,000-problem reference bank, problem selection/filtering should remain at p95 <= 400 ms and draft autosave at p95 <= 800 ms without full-page invalidation.
- Accessibility/mobile: multi-step wizard needs explicit step navigation, save states, summary affordances, and mobile-safe actions.
- External process-flow references are intent guidance only. This branch defines canonical wizard behavior for the rebuild and must not copy outdated step text when it conflicts with current contracts.

## Research Findings / Implementation Direction

- Save competition drafts incrementally so organizers can leave and resume without losing work.
- Snapshot problem content at publish time, not at authoring time, so drafts stay editable while published competitions stay immutable.
- Model competition lifecycle with explicit `status` values and event logs rather than boolean-only fields.
- Keep live pause, resume, extend, and disconnect-reset UI ownership in branch 16 while making branch 08 the source of truth for the lifecycle states and defensive guards those actions depend on.
- Put destructive controls behind eligibility checks and confirmations so organizers cannot accidentally publish or delete invalid state.

### Competition Constants and Lifecycle Contract (Deterministic)

- `competition_type`: `scheduled`, `open`.
- `competition_format`: `individual` (each mathlete has their own attempt), `team` (team shares a single collective attempt and answers collaboratively).
- `competition_status`: `draft`, `published`, `live`, `paused`, `ended`, `archived`.
- `answer_key_visibility`: `after_end`, `hidden` (independent from `leaderboard_published`).
- FR14.5 default contract: draft creation initializes `answer_key_visibility = after_end`.
- `hidden` is explicit organizer override only; if unchanged, publish preserves `after_end` behavior.
- Attempt limits:
  - Scheduled competitions allow exactly 1 attempt.
  - Open competitions allow 1 to 3 attempts.
- Capacity limits:
  - Individual competitions allow 3 to 100 participants.
  - Scheduled team competitions allow 2 to 5 participants per team and 3 to 50 teams.
- Problem count limits: publish requires 10 to 100 selected problems.
- Overview contract: the wizard overview step must persist organizer-authored `competitions.instructions` that mathletes acknowledge before entering the arena.

Allowed status transitions:
- `draft` -> `published` (trusted publish action only).
- `published` -> `live` (trusted start transition: scheduled competitions start at trusted server boundary, open competitions start through organizer-owned trusted controls).
- `live` -> `paused` (organizer path is open-only; admin incident force-pause may target any live competition type) and `paused` -> `live` (organizer-owned resume on organizer-owned competitions, including recovery after admin force-pause).
- `live` or `paused` -> `ended` (trusted lifecycle transition only; never direct client-side table mutation).
- `paused` (open only, no active attempts) -> `archived` (trusted retire action).
- `ended` -> `archived`.

End transition ownership and trigger policy:
- Scheduled competitions: the `live/paused -> ended` transition is system-owned and server-time-driven when trusted time reaches `scheduled_competition_end_cap_at` (`transition_source = 'system_timer'` only).
- Open competitions: the `live/paused -> ended` transition is organizer-owned through trusted lifecycle controls, must use `transition_source = 'trusted_manual_action'`, requires non-empty reason plus `request_idempotency_token`, must be idempotent, and must emit one deterministic end event.

Mutation guards by status:
- Full configuration edits allowed only in `draft`.
- Publish snapshot fields become immutable once status is `published` or later.
- Safe delete allowed only for `draft` competitions with no active registrations or attempts.
- Archive/retire is the organizer-owned path for non-draft historically significant competitions. Open competitions may be archived only after active attempts have finished; archive replaces destructive delete for published/live/ended history-bearing records.
- Duplicate name guard is explicit: for a single organizer, block duplicate `competitions.name` when `is_deleted = false` and status is one of `draft`, `published`, `live`, `paused`, or `ended`; allow reuse only when prior records are `archived` or soft-deleted.

### Publish-Time Snapshot Semantics (Non-Negotiable)

- `publish_competition(competition_id, request_idempotency_token)` is the single trusted publish entry point.
- `start_competition(competition_id, request_idempotency_token)` is the trusted start entry point that promotes `published` competitions to `live` idempotently; scheduled competitions use server-authoritative start boundary and open competitions use organizer-owned trusted control invocation.
- `archive_competition(competition_id, request_idempotency_token)` is the trusted retirement entry point for non-draft competitions and must record an archive event idempotently.
- End transition policy is split and canonical: scheduled end is server-boundary driven with `transition_source = 'system_timer'` only, while open end is organizer-triggered through trusted lifecycle controls with required non-empty reason and `request_idempotency_token`; both paths must be idempotent and event-audited.
- Publish runs as one transaction-level contract:
  1. Validate all wizard constraints and required confirmations.
  2. Persist immutable `competitions.scoring_snapshot_json`.
  3. Call `snapshot_competition_problems(competition_id)`.
  4. `snapshot_competition_problems(competition_id)` performs the `competition_problems` inserts (including frozen `points` and snapshot columns) and returns deterministic insert counts; callers must not perform separate duplicate inserts.
  5. Set `competitions.status = 'published'` and `published_at`.
  6. Record `competition_events` publish event.
- After publish:
  - edits to `problem_banks` or `problems` never mutate `competition_problems` snapshots.
  - grading, answer-key visibility checks, and participant review surfaces must read snapshot rows, not mutable authoring rows.
  - per-problem base points source of truth is `competition_problems.points`; recalculation and grading must use strict precedence of active trusted `points_override` correction artifact value when present, else `competition_problems.points`; `scoring_snapshot_json` stores scoring rules and anti-cheat policy, not row-level mutable points state.
  - accepted disputes must use trusted correction artifacts consumed by recalculation; immutable publish snapshots remain unchanged.
  - snapshot math fields remain canonical LaTeX; static render surfaces use KaTeX, and editable math input remains MathLive-only in authoring or arena flows.
  - scoring and anti-cheat evaluation must read the frozen `scoring_snapshot_json`.

## Requirements

- support scheduled and open competition types
- support individual and team formats with their validation rules, including team mode as scheduled-only
- require an overview-step Rules & Instructions box that is persisted to `competitions.instructions` and later acknowledged in the arena
- validate registration timing mode (`default` open-until-start vs `manual` explicit window), start time, duration, and attempt rules
- enforce open-competition attempt count between one and three
- enforce individual competitions at 3 to 100 participants
- enforce scheduled team competitions at 2 to 5 participants per team and 3 to 50 teams
- allow organizer problem selection with whole-bank and filtered pick strategies
- require between 10 and 100 selected problems before publish
- configure scoring, penalties, shuffling, anti-cheat, and multiple-attempt grading
- configure answer-key visibility using `after_end` or `hidden`, independently from leaderboard publication, with default `after_end` at draft creation and trusted server-time enforcement at reveal time
- enforce lifecycle transitions with `competition_status` constants and trusted status guards
- assign trusted owner/trigger paths for scheduled start (`published -> live`, system-owned server boundary), open start (`published -> live`, organizer-owned trusted control), scheduled server-time end (`live/paused -> ended`), open trusted end control (`live/paused -> ended`) with required reason plus `request_idempotency_token`, and archive or retirement (`ended -> archived`, plus paused open retirements with no active attempts)
- require a summary review and defensive confirmation before publish
- block duplicate competition names for the same organizer when status is one of `draft`, `published`, `live`, `paused`, or `ended`, with reuse allowed only for `archived` or soft-deleted records
- block invalid edits or deletes for live and historically significant competitions

## Atomic Steps

1. Build the organizer competition list and draft-create entry point.
2. Implement the multi-step wizard with persistent draft state.
3. Add the overview and schedule steps with strong date/time validation, scheduled registration timing mode (`default` or `manual`), computed end-time behavior (`start + duration`), plus the required Rules & Instructions field persisted to `competitions.instructions`.
4. Add the format step with individual vs team and scheduled vs open rules, including scheduled-only team enforcement, open-attempt limits, and the exact participant or team-count constraints.
5. Add the problem selection step with bank browsing, filter/search, selected problem ordering, and the 10-to-100 problem guardrail.
6. Add scoring and anti-cheat configuration steps using the rules from branch 07.
7. Add the review and publish step with full validation summary, edit jump-links, and explicit confirmation.
8. Snapshot selected problems into `competition_problems` at publish time with frozen snapshot columns and immutable post-publish behavior.
9. Implement organizer controls for draft edit, publish, open trusted start, safe draft delete, open trusted end control (required reason plus `request_idempotency_token`), archive/retire, and lifecycle state guards that enforce the allowed `competition_status` transitions; scheduled start remains system-owned at trusted server boundary.
10. Record baseline `competition_events` for publish, start, end, and archive lifecycle actions in branch 08, with end events emitted only by the canonical scheduled-system or open-organizer trusted paths; defer pause, resume, extend, and reset producer event writes to branch 16 control actions.

## Key Files

- `app/organizer/competition/page.tsx`
- `app/organizer/competition/create/page.tsx`
- `app/organizer/competition/[competitionId]/page.tsx`
- `components/competition-wizard/*`
- `lib/competition/*`
- `supabase/migrations/*`
- `tests/competitions/*` (planned suite; create before enforcing suite-specific verification)

## Verification

- Manual QA: create both scheduled and open competitions, switch formats, verify the exact participant and team constraints, publish valid drafts, reject invalid drafts, and test safe-delete plus lifecycle-guard behavior.
- Automated: extracted validation helpers and snapshot logic tests.
- Accessibility: step navigation, summary review, error messaging, and confirmation dialogs are keyboard-safe.
- Performance: with a 2,000-problem bank, filter/search interactions stay at p95 <= 400 ms and draft autosave stays at p95 <= 800 ms without full-page reload.
- Edge cases: duplicate names, invalid time windows, format switching after selected problems, deleting active open competitions.

## Security and Reliability Addendum (2026-04)

- require draft-write concurrency guards to prevent stale multi-tab overwrite (`draft_write_conflict` on stale revisions)
- require deterministic token-source policy for lifecycle transitions, including canonical system token behavior for scheduled system-timer end
- require publish transaction evidence artifact (snapshot counts/hashes and lifecycle event linkage) for forensic traceability
- require trusted transition helper enforcement for actor, state, and transition-source validation across publish/start/end/archive paths
- require immutable scoring/anti-cheat snapshot usage in downstream runtime and grading paths only

### Additional Verification Gates

- concurrency QA: same-token retries are idempotent; competing lifecycle requests produce deterministic conflict behavior
- lifecycle QA: prohibited transitions are blocked with deterministic machine-code outcomes
- audit QA: publish/start/end/archive writes produce expected lifecycle events and metadata

### Execution Update (2026-04-15)

- Verified branch-quality gates after lifecycle hardening: `npm run lint`, `npm run test` (45 files / 222 tests), and `npm run build` all pass.
- Added legacy-schema compatibility fallback for organizer lifecycle start/end/archive routes when RPCs are missing in under-migrated environments (`PGRST202`/signature drift), returning deterministic JSON results instead of raw 500 failures.
- Added regression coverage in `tests/competition/lifecycle-route-fallback.test.ts` for start/end/archive compatibility behavior.
- Updated lifecycle fallback behavior to persist status updates through compatibility writes when RPCs are unavailable; when compatibility writes cannot persist canonical status (for example missing status column), routes now return deterministic `service_unavailable` instead of synthetic success payloads.
- Removed route-level start-status short-circuit so idempotent replay responses remain owned by `start_competition` RPC semantics.
- Completed manual organizer lifecycle click-through in UI on real route handlers: save draft -> publish (200) -> start (200) -> end (200) -> archive (200), with visible status progression `Published -> Live -> Ended -> Archived`.
- Responsive QA spot-check completed on competition detail/create pages at mobile (`390x844`) and tablet (`768x1024`) viewports; core wizard controls and lifecycle status/action surfaces remain accessible.
- Publish action guard hardened to draft-only in wizard UI so non-draft states cannot trigger invalid publish attempts.
- Hardened draft creation for under-migrated competition schemas: create-route insert fallback now retries with legacy competition select columns, and post-save refresh uses the same legacy read fallback instead of returning a generic 500 after successful draft persistence.
- Added regression coverage in `tests/competition/create-route.test.ts` for both legacy insert-response fallback and legacy post-save refresh fallback.
- Hardened organizer mutation compatibility beyond create flow: shared competition reads now retry with legacy competition select columns even when the primary read returns `data = null`, draft save fallback now reads legacy rows after compatibility updates, and draft delete now has a legacy soft-delete fallback when `delete_draft_competition` RPC is unavailable.
- Added regression coverage in `tests/competition/edit-route.test.ts` and extended `tests/competition/publish-route.test.ts` so save, delete, and publish paths no longer regress into generic operation-failed responses on under-migrated schemas.

### UI Fidelity Update (2026-04-18)

- Organizer competition UI now traces directly to Figma source `https://www.figma.com/design/cBQPJi1UVMFzrHlfsNPbsx/Mathwiz?node-id=1-125&t=wi7iD40k8rPMSyLH-1`.
- Inspected organizer competition reference nodes:
  - `83:2772` for format/schedule wizard framing
  - `93:701` for review layout framing
- Organizer-facing route wrappers aligned to the Figma shell while preserving existing wizard behavior:
  - `app/organizer/competition/page.tsx`
  - `app/organizer/competition/create/page.tsx`
  - `app/organizer/competition/[competitionId]/page.tsx`
- Scope boundary: wrapper/layout parity was refreshed in branch-local UI only; `components/competition-wizard/competition-wizard.tsx` behavior contract stayed intact.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(competition): add organizer competition workspace and drafts`
  - `feat(competition): implement wizard schedule and format steps`
  - `feat(competition): add problem selection scoring and anti-cheat steps`
  - `feat(competition): add review publish and lifecycle controls`
- PR title template: `UR7-UR8: competition wizard, snapshots, and lifecycle controls`
- PR description template:
  - Summary: competition drafts, wizard steps, snapshotting, publish safety, lifecycle actions
  - Testing: lint, validation tests, manual scheduled/open competition flows
  - Docs: DB doc updated for competition lifecycle and snapshot rules

## Definition of Done

- organizers can create valid competitions without unsafe manual workarounds
- published competitions carry immutable problem snapshots
- lifecycle state guards are defined before later live-control UI is added
- lifecycle actions are explicit, audited, and compatible with future live monitoring
