# 01 – Foundation

## Mission

Kickstart the new Mathwiz Arena project by creating a clean
Next.js 14 + Supabase codebase, configuring Tailwind CSS and Shadcn UI,
and establishing global styles and layouts that reflect the agreed
design system.  This branch lays the groundwork for all subsequent
features.

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/foundation`
* **Requirements:** None.  This is the first implementation branch.
* **Assigned to:** Mabansag, Vj

## Requirements

* Node.js ≥ 18.17 installed locally.
* Supabase project URL and anon key available for `.env.local`.
* Access to the Next.js + Supabase starter template (via `npx` or
  cloning from Vercel).

## Atomic Steps
0. **Research and planning.**  Before writing any code, use the
   internet search tool to research the latest best practices for
   building high‑performance Next.js + Supabase applications.  Look
   for open‑source templates or starter kits that incorporate modern
   UI libraries (e.g. Radix UI, Material UI) and compare them to
   Shadcn UI in terms of accessibility, performance and theming.  Read
   articles and community discussions from the past year to ensure
   your technology choices remain up to date.  This research will
   inform whether sticking with Shadcn UI is sufficient or if
   additional component libraries should be integrated to improve
   responsiveness and mobile friendliness.

1. **Create the project scaffold.**  Run
   ```bash
   npx create-next-app@latest mathwiz-arena --example with-supabase
   cd mathwiz-arena
   ```
   or clone the Vercel template repository.  Remove any example
   auth pages to avoid confusion.
2. **Initialise Git and branches.**  Inside the project directory run
   `git init` and create the base branches:
   ```bash
   git checkout -b develop
   git checkout -b feature/foundation
   ```
3. **Set up environment variables.**  Copy `.env.example` to
   `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your Supabase project’s values.
4. **Configure Tailwind and Shadcn UI.**  Ensure `tailwind.config.ts`
   defines dark mode and uses the content globs from `/app`, `/pages`,
   `/components` and `/src`.  Install Shadcn UI via
   `npx shadcn-ui@latest init` and choose the `tailwindcss` styling
   option.
5. **Define global CSS variables.**  Create or edit
   `app/globals.css` to declare CSS custom properties for colours,
   border radius, and animations.  Mirror the values from the old
   project: neutral greys and blue accent (`--primary: 0 0% 9%`,
   `--primary-foreground: 0 0% 98%`, etc.).
   Add classes for card styles, headings, and animations.
6. **Implement the root layout.**  Create `app/layout.tsx` that wraps
   the application in `ThemeProvider` (handles dark/light mode) and a
   responsive container.  Add a basic header with the Mathwiz logo and
   navigation links (`Home`, `Login`, `Register`).  Use Shadcn’s
   `<Button />` components with Tailwind variants.
7. **Verify local development.**  Run `npm install` then `npm run dev`.
   Navigate to `http://localhost:3000` to ensure the app renders
   without errors, the global styles apply, and dark mode toggles via
   the provider.  Fix any configuration issues.
8. **Commit changes.**  Once satisfied, commit your work using
   descriptive messages (see Git Branching section).  Push the
   `feature/foundation` branch to your remote repository and open a
   pull request into `develop` when reviewed.

## Key Files

* `package.json` – lists dependencies and scripts.
* `tailwind.config.ts` – defines dark mode and themes.
* `app/globals.css` – contains CSS variables and animations.
* `app/layout.tsx` – root layout with ThemeProvider and navigation.
* `.env.local` – Supabase credentials (not committed).

## Verification

* `npm run dev` starts without errors.
* Switching between light and dark modes changes the colours defined
  in `globals.css`.
* The home page loads with a header and placeholder content.

## Git Branching

Suggested atomic commit titles:

1. **chore: scaffold Next.js project with Supabase template** – result
   of running `create-next-app` and initialising Git.
2. **chore: configure Tailwind and Shadcn UI** – updates to
   `tailwind.config.ts`, installation of Shadcn UI and global CSS.
3. **feat: implement root layout and theme provider** – adds
   `app/layout.tsx`, navigation, and dark mode toggle.

## Definition of Done

* The project compiles and runs locally.
* Tailwind and Shadcn UI are correctly configured.
* Global styles (colours, animations) match the design system.
* A root layout exists with navigation, ready for further pages.
* The branch is merged into `develop` via pull request after review.
