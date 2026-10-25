# Lab

A personal learning app for one person: a working notebook for learning how AI
systems actually work, rather than a chat window you lose at the end of the
session.

It runs the same loop every time:

**Pre-work → tutor session (Socratic) → build exercise (predict, then run, then
compare) → explain-back (graded) → professional bridge → concept log update →
spaced recall later.**

Around that loop it keeps the things a chat cannot: a course of modules and
lessons, a concept register with a status ladder (met → explained back →
applied → taught), Leitner spaced recall, a build log where the prediction is
written before the results, a completion register with the evidence that closed
each lesson, and a parking lot for tangents.

Everything is local. One SQLite file, no account, no server to deploy.

## What you need

- **Node 20.9 or newer** (22 LTS recommended). Check with `node -v`.
- An **Anthropic API key**, for the tutor and for grading. Everything else —
  the course, the register, builds, bridges, the completion log, the parking
  lot, export and import — works without one.

## Setup

### Windows 11 (PowerShell)

```powershell
cd path\to\lab
npm install
Copy-Item .env.example .env.local
notepad .env.local          # paste your key after ANTHROPIC_API_KEY=
npm run db:setup
npm run dev
```

### macOS / Linux

```bash
cd path/to/lab
npm install
cp .env.example .env.local
open -e .env.local          # or: nano .env.local
npm run db:setup
npm run dev
```

Then open **http://127.0.0.1:3000**. The app binds to localhost only; nothing
is exposed to your network.

`npm run db:setup` creates the database and seeds the course, the concept
register, the placement result, the parking-lot notes and the source library.
It is safe to run again at any time: it applies any new schema changes and
never inserts a second copy of a seeded row or overwrites one you have edited.

### The environment file

`.env.local` is read only by the server and is never committed.

```
ANTHROPIC_API_KEY=
LAB_TUTOR_MODEL=claude-sonnet-5-5
LAB_GRADER_MODEL=claude-haiku-5-5
```

The two model ids are read from the environment and appear nowhere else in the
code, so you can change models by editing this file and restarting. Without a
key the app still runs; the tutor and grading areas show a setup screen telling
you exactly which file to create and what to put in it.

After editing `.env.local`, stop the dev server (Ctrl+C) and start it again —
environment variables are read at startup.

## Editing the prompts

The tutor's behaviour lives in Markdown, not in code:

| File | What it controls |
|---|---|
| `prompts/tutor.md` | How the tutor teaches: Socratic, build-first, names the established concept, pushes for the mechanism, tags claims VERIFIED / INFERRED / UNVERIFIED. |
| `prompts/learner-profile.md` | Who it is teaching, and the known habits to push against. |
| `prompts/grader.md` | The grading rubric for explain-backs and recall: what counts as full, partial and miss. |

They are read fresh on every request, so you can edit one, save, and the next
message uses it. No restart, no rebuild.

The system prompt is assembled per request from `tutor.md`, the learner
profile, the current module and lesson, up to 5 concepts due for recall, and
your 10 most recent concept-log rows.

## Export and import

**Settings → Export** gives you three files:

- **Everything (JSON)** — the full backup, and the only file that import reads.
- **Concept register (Markdown)** — a table with the columns
  `Concept | Established name / source | My 1-line version | Where it breaks | Build link | Status | Date`,
  ready to paste into a Claude Project.
- **Completion register (Markdown)** — what you finished, when, and the
  evidence.

**Settings → Import** takes a JSON export and **replaces everything** currently
in the database. It asks for confirmation first and names the file it is about
to use. Export before you import if you want a way back.

## Where the data lives

One file: **`data/lab.db`** (SQLite). Settings shows the full path.

To back it up, copy that file. To move the app to another machine, copy the
whole folder, run `npm install`, and the database comes with it. To start over,
delete `data/` and run `npm run db:setup`.

Automatic backup on Windows, if you want one: point OneDrive or File History at
the `data` folder. On macOS, Time Machine covers it. Copying the file while the
app is running is safe.

## The rules the app enforces

These are not reminders — the app will not record a thing that did not happen.

- **A lesson completes only when** one explain-back is graded `full`, the build
  (if the lesson has one) is done with its prediction saved *before* the
  results, and a bridge is saved. There is no "mark complete" checkbox.
- **Results cannot be saved before a prediction.** The field is locked in the
  UI and the rule is checked again in the API, so it cannot be worked around.
- **A module completes when** every lesson is complete *and* a module check of
  4 recall questions comes back with at least 3 graded `full`.
- **Concept status only ever goes up.** A `full` explain-back promotes to
  explained back; a finished build linked to the concept promotes to applied;
  `taught` is the one you set yourself.
- **Spaced recall** uses Leitner boxes at 1, 3, 7, 16, 35 and 90 days. `full`
  moves up a box, `partial` brings it back tomorrow, `miss` resets to box 0.
  Concepts still at `met` are not scheduled.

These live in `src/lib/rules.ts` as pure functions, covered by the tests.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app at http://127.0.0.1:3000 |
| `npm run db:setup` | Create or update the database and seed it (safe to re-run) |
| `npm test` | Run the unit and integration tests |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run build` / `npm start` | Production build and serve |

## How it is put together

- **Next.js (App Router), TypeScript strict, Tailwind.** Pages are server
  components reading SQLite directly; anything interactive is a client
  component talking to a route handler.
- **SQLite through `@libsql/client` with Drizzle.** No native build tools, so
  `npm install` works on Windows without Visual Studio.
- **The Anthropic SDK runs server-side only.** The key is read in route
  handlers and never reaches the browser. Structured calls (grading, summaries,
  concept proposals, recall questions) are validated with zod and retried once
  if the model returns something off-shape, then surfaced as a visible error.
- **The tutor streams** over a route handler; both turns are persisted.

More on the choices behind all of this: [DECISIONS.md](DECISIONS.md). The
visual design and its review: [DESIGN.md](DESIGN.md).
