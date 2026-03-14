# Mathwiz Arena – Project Overview

## Detailed Project Description

Mathwiz Arena is a full–stack web application that enables high‑school mathletes, their
teachers and coaches, and competition organizers to create, host, and participate in
mathematics competitions.  The platform supports three primary roles:

* **Mathletes** (students) register using Google OAuth or email/password, complete a
  profile, browse upcoming competitions, register as individuals or as part of a
  team, take part in live or open competitions with LaTeX‑friendly inputs, and
  review their results afterwards.  Strict single‑session enforcement and
  anti‑cheat logging discourage misuse.
* **Organizers** apply for eligibility through an application workflow.  Once
  approved by an administrator they can create reusable problem banks,
  import problems in bulk, configure scoring and tie‑breaking rules,
  schedule competitions (scheduled or open), configure team size limits,
  manage registrants, monitor live attempts, and publish final leaderboards.
* **Administrators** oversee the entire platform.  They manage user
  accounts, approve or reject organizer applications, moderate content and
  competitions, access problem banks in read‑only mode, inspect system logs
  (including tab‑switch events), and adjust platform‑wide settings.

Under the hood the application uses a relational schema (PostgreSQL) to
store users, teams, problems, competitions, attempts, answers and tab‑switch
logs.  Business logic is split between a Next.js front‑end (App Router
architecture) and Supabase functions and row‑level security (RLS) policies.
The UI is responsive and mobile‑first, supporting both light and dark
modes.  KaTeX renders mathematical notation in problems and solutions.

## Tech Stack

| Layer           | Technology & Version |
|-----------------|----------------------|
| **Framework**   | Next.js 14 (App Router) with TypeScript |
| **Database**    | Supabase (PostgreSQL 15) |
| **Authentication** | Supabase Auth with Google OAuth and email/password flow |
| **Styling**     | Tailwind CSS with Shadcn/ui component library |
| **Math Rendering** | KaTeX (latest) for LaTeX notation |
| **Math Input Editor** | MathQuill or MathLive (open‑source WYSIWYG editor) |
| **Icons**       | Lucide React icon set |
| **Deployment**  | Vercel |

**Important note:** the project is initialized from the official
[Next.js + Supabase template](https://vercel.com/templates/next.js/supabase).  All
subsequent work should build upon this scaffold rather than starting from
scratch.  Environment variables (`NEXT_PUBLIC_SUPABASE_URL` and either
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
must be configured in `.env.local` for local development.

## Design System

The design system mirrors the existing Mathwiz prototype in the Figma
file and the previous repository.  Key characteristics include:

* **Dark‑Mode–First Approach:**  The application defines CSS variables for
  `--background`, `--foreground`, `--primary`, etc., with dark values set
  when the `.dark` class is applied.  Light mode defaults to a clean
  white background and dark text.  Dark mode inverts the palette for
  high contrast.
* **Neutral Palette with Blue Accent:**  Base colours are neutral greys
  derived from Tailwind’s slate palette.  A deep blue (`#25346A` on
  light backgrounds and Tailwind’s `blue‑400` on dark) is used for
  primary actions and section titles.  Accent colours for alerts and destructive
  actions come from the `red` and `yellow` hues defined in the CSS
  variables.
* **Component Libraries:**  The core of the UI uses Shadcn’s unstyled
  component primitives (e.g. Button, Input, Dialog, Accordion).
  However, early in the project we conduct a survey of modern React
  UI libraries (Radix UI, Material UI, etc.) to determine whether
  additional components could improve accessibility, performance and
  consistency.  Selected components from these libraries may be
  integrated alongside Shadcn, styled with Tailwind and our CSS
  variables.  Complex UI elements such as the multi‑step competition
  wizard reuse Shadcn’s Accordion and Tabs or a more robust stepper
  component discovered during research.
* **Responsive & Mobile‑First:**  Containers are centered with a maximum
  width of 1400 px and 2 rem padding.  Components flex
  vertically on small screens and transform into grids on large screens.
* **Animations:**  Subtle animations (e.g. slide‑in, fade‑in, accordion
  expansion) are defined in `globals.css` to make state changes
  clear without distracting users.
* **Interaction Feedback:**  Shared UI feedback patterns should exist
  across the application: top‑of‑page loading indicators during route
  changes, pending states for buttons and form submissions, reusable
  loading/empty/error data states, and confirmation dialogs for
  destructive actions.  These patterns must be accessible, visually
  consistent, and responsive on mobile and desktop.

* **Mathematical Input:**  To make entering equations easy for users who
  are not familiar with raw LaTeX, the platform integrates a
  WYSIWYG math editor such as MathQuill or MathLive.  This editor
  provides a palette of common symbols (fractions, roots, exponents,
  integrals) and renders a live preview of the formula as users type.
  The math editor is used in problem creation forms and in the arena
  for numeric and identification answers.  It is fully responsive and
  touch‑friendly.

Typography should follow system sans‑serif fonts (Inter or similar)
with clear hierarchy: headings use larger sizes and bold weights;
body text remains regular and comfortable to read.  All interactive
elements must be accessible via keyboard and include appropriate aria
attributes.

## Core Features

The functional requirements are derived from the attached
`ProcessFlow.md` document.  They are grouped below by user role to
highlight who benefits from each feature.  Each user requirement (UR)
is mapped to one or more functional requirements (FR) in the original
specification.

### Mathletes (UR1, UR3, UR9–UR16)

* **Account Registration & Single‑Session Login (UR1, UR3):**  Mathletes
  sign up with Google OAuth or email/password.  Once logged in they
  must complete their profile (school, grade level, display name).
  Signing into a second device automatically logs out any other
  sessions.
* **Dashboard & Calendar (UR10–UR12):**  The home page lists upcoming
  competitions and displays them on a calendar localized to the
  user’s timezone.  Search and filter controls allow quick discovery.
* **Team Management (UR9):**  Mathletes can create teams, invite
  classmates via unique codes or usernames, accept/decline invitations,
  remove members, and transfer leadership automatically when the leader
  leaves.
* **Competition Registration & Withdrawal (UR11):**  Individuals or
  team leaders register for competitions.  The system validates team
  size and capacity.  Registrants may withdraw before a competition
  begins and receive notifications on schedule changes.
* **Competition Arena (UR14):**  At the scheduled start time the
  “Enter Arena” button becomes active.  Mathletes acknowledge rules
  (no switching tabs, etc.) before starting.  Problems display with
  LaTeX support; numeric and identification answers use a
  WYSIWYG math editor (e.g. MathQuill) with a symbol palette so
  mathletes can build formulas visually without memorising LaTeX.
  Answers auto‑save and can be flagged as solved or reset.  A
  server‑side timer counts down; losing focus triggers penalty
  warnings and logs.
* **Review & Submission (UR14d–UR14e):**  Before submission, Mathletes
  see a summary of answers and confirm.  After the competition ends
  they can view the answer key and track their scores on the
  leaderboard.
* **History & Notifications (UR15–UR16):**  The history tab records past
  competitions, results, and disputes.  Notifications inform users
  about team invites, registration statuses, and score recalculations.

### Organizers (UR2, UR4–UR8, UR13–UR16)

* **Eligibility Application (UR2):**  Prospective organizers complete a
  detailed form and agree to the platform’s terms.  Applications enter
  an admin queue for approval or rejection.
* **Problem Bank Management (UR6):**  Organizers create problem banks
  with names and descriptions, add problems manually or via CSV
  import, assign difficulty and topics, upload images, and maintain
  CRUD operations.  The problem editor includes a WYSIWYG math
  input component so organizers can write formulas visually with a
  symbol palette, reducing the need to memorise LaTeX.  Problems
  can be deleted from draft competitions but remain immutable once a
  competition is published.
* **Competition Creation Wizard (UR7):**  A five‑page wizard guides
  organizers through naming the competition, setting schedules
  (scheduled or open), defining formats (individual or team) with
  capacity limits, selecting problems and scoring rules, configuring
  anti‑cheat settings (tab logging penalties and shuffling), and
  reviewing before publishing.
* **Live Monitoring & Management (UR13, UR8):**  During a live event
  organizers access a dashboard showing active participants, answer
  statuses, and tab‑switch alerts.  They can broadcast announcements,
  pause/resume open competitions, and manage attempts for disconnected
  users.
* **Post‑Competition Tasks (UR14–UR16):**  Organizers publish
  leaderboards, respond to disputes, recalculate scores if answer keys
  change, export results, and review historical data.  They cannot
  delete open competitions with active participants.

### Administrators (UR3–UR5, UR13–UR16)

* **User Management (UR4):**  Admins maintain a queue of pending
  organizer applications, approve or reject them, suspend or delete
  user accounts, and monitor overall user activity.
* **Resource Access & Moderation (UR5):**  Admins have read access to
  all problem banks and competitions.  They can delete inappropriate
  content, force‑pause competitions, and edit the platform’s default
  problem bank.
* **System Logs & Settings (UR13–UR16):**  Admins monitor server logs,
  including tab switch events.  They access analytics dashboards and
  adjust global settings as needed.

## Target Audience

The platform is tailored for **high‑school students**, their **teachers
and coaches**, and **competition organizers**.  High‑school students
benefit from intuitive registration, secure competition environments,
and accessible history tracking.  Teachers and coaches act as team
leaders or co‑organizers, coordinating group participation.  Organizers
are typically educators or institutions hosting competitions.  A
dedicated admin role ensures compliance with educational and data
privacy standards and maintains platform integrity.
