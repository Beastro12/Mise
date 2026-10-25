# Decisions

Everything the brief did not specify, and what was chosen instead. Numbered so
they can be referred to from code comments.

## Where the app lives

**D1 — Lab is in `lab/`, not at the repository root.**
The repository already contains a different, complete application (*Aitta*, a
meal planner: 115 source files, its own `package.json`, schema, docs and
helper scripts). The brief described a greenfield build and said nothing about
replacing anything. Building at the root would have destroyed working software
that was not mine to delete, so Lab was built as a self-contained app in
`lab/`, with its own dependencies, database, scripts and documentation.
Nothing outside `lab/` was modified. **This is the decision most worth your
review**: if you did intend Lab to replace Aitta, moving `lab/*` up one level
and deleting the old app is a mechanical change.

**D2 — `turbopack.root` is pinned to `lab/`.**
Because of D1, Turbopack's automatic project-root detection walked up to the
repository root and tried to compile the other app's `src/proxy.ts`. The root
is set explicitly in `next.config.ts`.

## Data model

**D3 — Deterministic seed ids.**
Seed rows use a UUID derived from a stable natural key (module code, concept
text) rather than a random one, so `npm run db:setup` is idempotent: a second
run inserts nothing and never touches a row you have since edited. Rows created
while using the app get random UUIDs. See `src/lib/stable-id.ts`.

**D4 — The `order` field is stored in a column called `order_index`.**
`order` is a SQL keyword. The TypeScript field is still `order`, as specified.

**D5 — `recalls` has an extra `moduleCheckRunId` column.**
A module check is "4 questions, at least 3 full". Without knowing which answers
belonged to the same run, a passed check could not be re-derived later — the
last four answers might be a mix of ordinary due cards and two different
attempts. The column is null for an ordinary recall card and set for every
answer in one check run.

**D6 — `lessons` has an extra `preWorkDoneAt` column.**
Pre-work is one of the five loop steps shown on a lesson, but it is *not* one
of the three completion requirements. The brief forbids a manual checkbox for
lesson completion; that rule is about completion, so pre-work is marked by
hand here and has no bearing on whether a lesson closes. Deriving it from
source read-status instead would have been wrong for modules whose lessons
share one source.

**D7 — `builds` has an extra `conceptId` column.**
The rules require that "a completed build linked to the concept promotes it to
applied". The brief's `concepts.buildLink` is free text (`"PG Council of 5
(M5)"`), which cannot carry that link reliably, so the build points at the
concept explicitly. `buildLink` is kept as written, for the register and the
Markdown export.

**D8 — `AI Act essentials` has the module code `AIA`.**
The brief gave codes for M0–M6 but not for this module, and the schema makes
`code` unique and non-null. Sources belonging to it use the same code.
`AI Engineering` (a reference "for all modules") uses the code `all`, and the
staying-current sources use `—`, as the brief wrote them.

**D9 — Recall dates are stored as midnight UTC on the due day.**
A card is due from 00:00 UTC of its day rather than at the exact hour it was
last answered, which matches how a daily study rhythm actually works and makes
"due today" stable to reason about.

## Tutor and grading

**D10 — Structured calls ask for JSON and validate with zod, rather than using
the API's structured-output mode.** The brief requires one automatic retry on
invalid JSON and then a visible error, so the validate-and-retry path has to
exist either way. Keeping the request shape minimal also means any model id
you put in `.env.local` will work.

**D11 — No `thinking` or `effort` parameters are sent.**
The model ids come from the environment and may be changed. Different models
accept different thinking configuration, and sending the wrong one is a hard
400. Sending neither works everywhere and lets each model use its default.
Only `text` blocks are read from responses, so thinking blocks are ignored
rather than rendered.

**D12 — `max_tokens`: 16000 for the tutor stream, 8192 for structured calls.**
Generous enough that reasoning cannot starve the visible answer.

**D13 — The tutor streams newline-delimited JSON, not SSE.**
Same effect, less ceremony to parse, and it carries a typed terminal event so
the client can tell "finished" from "failed halfway". The user's turn is saved
before the call and the reply after it completes, so a failed stream never
leaves half an answer in the log.

**D14 — A recall question's expected answer is sent to the browser.**
It is needed to grade the answer and it is shown after grading as "a full
answer", which is the useful part. This is a single-user local app; reading
ahead only cheats yourself.

**D15 — Concept proposals are capped at 5 per session**, in line with "one
concept per session, deep". Nothing is ever inserted automatically.

## Interface

**D16 — The theme is stored in a cookie, not `localStorage`.**
The server therefore renders `data-theme` on `<html>` itself. This removes the
pre-paint inline script entirely and, with it, a real hydration error
(React #418) that appeared intermittently in the production build when the
toggle's state was read from client storage during the first render. Every
page is already `force-dynamic`, so reading a cookie in the layout costs
nothing. With no cookie set, the CSS follows the system preference, as asked.

**D17 — The concept register is a table from 640px up and a card list below.**
A seven-column register cannot be read on a phone. Rendering it anyway also
made the whole page scroll sideways.

**D18 — `.scroll-x` uses `contain: paint`.**
Wide tables sit in a horizontal scroller. `overflow-x: auto` alone was not
enough: the table's scrollable overflow still widened the viewport's scroll
area, so the entire page scrolled sideways even though every ancestor box was
the correct width. `contain: paint` stops that propagation while leaving the
table's own scrolling intact. Verified at 390, 480, 768, 1024 and 1440px.

**D19 — Three type stacks, two loaded families.**
Archivo for interface text and Source Serif 4 for everything meant to be read,
both via `next/font`. Verbatim content — build predictions, results, model
output, exported Markdown — uses the system monospace stack, which loads
nothing. The brief rules out monospace as a decorative label style; it is used
only where the content is literally a transcript.

**D20 — Pages are `force-dynamic`; Cache Components is off.**
Every page reads the database and belongs to one person. Caching would add
invalidation work with nothing to gain, and it keeps `next build` from trying
to prerender pages that need the database.

## Testing and verification

**D21 — There are integration tests as well as the required unit tests.**
`tests/rules.test.ts` covers every branch of the rules engine with pure
functions, as specified. `tests/integration.test.ts` runs the real services
against a temporary SQLite database to prove the wiring: that a `full`
explain-back actually promotes the concept, that a finished build promotes it
to applied, that completion writes exactly one evidence row however many times
it is rechecked, that a module needs both its lessons and a passing check, and
that export/import round-trips. The pure functions can be right while the
wiring is wrong; this checks both.

**D22 — Verification used a real browser.**
Every route was loaded at five widths in both themes (198 page loads) and
checked for console errors, JavaScript errors and horizontal page scroll.
That is what surfaced D16 and D18, neither of which shows up in a build log.

## Content

**D23 — Lessons the brief left blank were written to match their module.**
Objectives, pre-work and bridges for M1–M6 and for the lessons where the brief
only gave a title follow the pattern of the ones it did specify: a mechanism
to understand, a named source, and a bridge phrased as something you would say
to a customer.

**D24 — Sources carry notes, and the time-sensitive ones say so.**
The OpenAI monitoring report, the AI Act application dates and the ISO/IEC
42001 overview are each flagged in their note as needing to be checked against
the primary source before being used with a customer, matching the tutor's
instruction never to present current regulation or products as settled.
