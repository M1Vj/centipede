# Temporary Product Demo Video Guide: Organizer Competition Creation

Core feature: Organizer competition creation.

Recommended feature scope: show an organizer creating a competition draft from the Competition Dashboard, filling the wizard, selecting problems, configuring scoring, reviewing the details, and confirming that the competition appears in the organizer dashboard/detail page.

Target length: 2 to 5 minutes.

## Commit/date guidance

Your activity says the deadline limit is May 15. In this local Git history, there is no visible commit dated May 15, 2026.

Deadline-safe choice:

```powershell
git log --all --before="2026-05-16 00:00" --date=iso --pretty=format:"%h %ad %s" -n 8
```

The latest visible commit before May 16 is:

```text
f1cb127 2026-05-10 00:11:26 +0800 refine leaderboard podium layout
```

Use `f1cb127` if your instructor requires the demonstrated code to be from before the May 15 cutoff. Do not use the May 16 commit unless your instructor explicitly allows it, because it is after the stated deadline in the visible Git history.

Suggested safe recording setup:

```powershell
git status --short
git switch --detach f1cb127
npm install
npm run dev
```

After recording, return to your working branch:

```powershell
git switch -
```

Important: the current working tree has uncommitted changes. Do not run destructive Git commands. If you want to keep your current work untouched while testing the old commit, use a separate clone or ask someone to help create a separate Git worktree.

## App route to demonstrate

Start from the organizer dashboard:

```text
/organizer/competition
```

Then click:

```text
Create New Competition
```

This opens:

```text
/organizer/competition/create
```

Relevant implementation files:

```text
app/organizer/competition/page.tsx
app/organizer/competition/create/page.tsx
components/competition-wizard/competition-wizard.tsx
app/api/organizer/competitions/route.ts
lib/competition/validation.ts
DESIGN.md
```

## Recording format

Follow the activity rules:

- Wear neat or business casual clothing.
- Stand while speaking.
- Frame only the upper body.
- Use enough lighting.
- Switch between speaker camera and screen demo.
- Do not overlay webcam on top of the demo screen.
- Make every team member participate.
- Keep it quick.

Suggested recording pattern:

1. Full camera for introductions.
2. Full screen recording for the app demo.
3. Full camera for the question.
4. Full screen recording for the quick proof/demo answer.
5. Full camera for closing.

## Suggested 3 to 4 minute video script

### 0:00 to 0:25 - Team introduction

Speaker 1:

"Good day, we are Team [team name]. I am [name], and I worked on [part]."

Each member says one short line:

"I am [name], and I worked on [feature/responsibility]."

Main developer:

"For this product demonstration, we will show the organizer competition creation feature. This is one of our core completed features because it is the starting point for running events in MathWiz."

### 0:25 to 0:45 - Feature context

Main developer:

"An organizer uses this feature to create a competition, define the schedule and format, choose problems, configure scoring, and review the setup before saving or publishing."

Switch to screen recording.

### 0:45 to 2:15 - Start-to-end demo

Demo steps:

1. Log in as an organizer.
2. Go to the Organizer workspace.
3. Open Competition Dashboard.
4. Click Create New Competition.
5. In Overview, enter:
   - Name: `Algebra Sprint Demo`
   - Description: `A short algebra competition for demonstration.`
   - Rules/instructions: `Answer each item carefully. Submit before the time ends.`
6. Continue to Schedule.
7. Select Scheduled or Open depending on what is easiest in your test data.
8. For Scheduled, set a future start time and duration.
9. Select Individual format, or Team format if the project data supports teams cleanly.
10. Continue to Problems.
11. Select at least one available problem.
12. Continue to Scoring.
13. Show attempts allowed, scoring mode, penalties, and tie breaker.
14. Continue to Review.
15. Show the summary.
16. Click the create/save/publish action available in the wizard.
17. Show that the competition is now visible in the organizer competition dashboard or detail page.

Talk while demonstrating:

"The wizard guides the organizer through five major areas: overview, schedule, problems, scoring, and review. Required information is collected before the competition is created. The selected problems and scoring rules are included in the final review so the organizer can confirm the setup before saving."

### 2:15 to 3:30 - Implementation-focused Q&A

Use one member as the questioner. Ask at least three quick questions.

Question 1:

"What if I do not fill the competition name and click the next or create button?"

Developer answer with demo:

"The form validates required fields. If the competition name is empty, the wizard shows a validation message and prevents the competition from being created."

Demo proof:

Clear the competition name, try to proceed or create, and show the validation message.

Question 2:

"What if I input `<script>alert()</script>` in a textbox and submit?"

Developer answer with demo:

"The value is treated as text input, not executable page code. The server also normalizes and validates competition input before saving through the organizer competitions API."

Demo proof:

Enter `<script>alert()</script>` in the description or instructions field. Show that it remains text and does not run as JavaScript.

Question 3:

"Is the color scheme based on the Design Specs?"

Developer answer with demo:

"Yes. The organizer screens use the MathWiz design specs, including the primary orange `#F49700`, dark navy text, slate neutral colors, Poppins typography, rounded cards, and consistent button styling."

Demo proof:

Show the Create New Competition button, headings, cards, and wizard controls. Optionally open `DESIGN.md` briefly and point to the brand color section.

Question 4:

"Are you sure the code is testable already?"

Developer answer with demo:

"The feature is structured so validation and API behavior can be tested separately. The validation logic is in `lib/competition/validation.ts`, the UI wizard is in `components/competition-wizard/competition-wizard.tsx`, and the create API is in `app/api/organizer/competitions/route.ts`."

Demo proof:

Show the files briefly, or run:

```powershell
npm test
```

Only run the tests during the video if they finish fast on your machine. If not, say the test command exists and show the test files/folders.

Question 5:

"Where will the website/app be deployed?"

Developer answer:

"The project is configured as a Next.js app and has a `vercel.json` file, so the intended deployment target is Vercel. The backend services are connected through Supabase."

### 3:30 to 4:00 - Closing

Speaker:

"That completes the demonstration of the organizer competition creation feature. We showed the feature from the organizer dashboard up to the created competition, and we also demonstrated validation, input handling, design consistency, testability, and deployment readiness."

## What each member can do

Member 1:

- Introduces the team.
- Explains why competition creation is the chosen core feature.

Member 2:

- Performs the main screen demo.
- Creates the competition from start to finish.

Member 3:

- Asks implementation-focused questions.

Member 4, if available:

- Answers design/deployment/testing questions or gives the closing.

If working individually, invite one person to ask the Q&A questions while you answer and demonstrate.

## Demo data checklist

Before recording, prepare:

- One organizer account that can log in successfully.
- At least one existing problem in the problem bank.
- A future schedule date/time if using Scheduled competition.
- A short competition title, description, and instruction text.
- A browser zoom level that keeps the wizard readable.
- A clean screen with no private keys or `.env.local` visible.

## Short fallback if something fails during recording

If creation fails because of local database or test data issues, still demonstrate:

1. Opening the organizer dashboard.
2. Opening the create wizard.
3. Filling all wizard sections.
4. Showing client-side validation.
5. Showing the review page.
6. Explaining that final persistence depends on the local Supabase database being available.

Do not spend video time debugging. Keep the demo focused and quick.
