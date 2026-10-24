# Lab — design plan

A working lab notebook for learning how AI systems work. Read on a laptop for
an hour at a time, checked on a phone between meetings. Not a dashboard.

## 1. Colour

Six named colours per theme, as CSS variables in `src/app/globals.css`. The
dark theme is the default; the light theme is complete, not a tint.

| Name | Role | Dark | Light |
|---|---|---|---|
| `ink` | Page ground. Blue-black, not neutral black: closer to ink on a dark desk. | `#0F1621` | `#F3F5F8` |
| `slate` | Raised surface: panels, tab strip, input fields. | `#18212F` | `#FFFFFF` |
| `rule` | Hairlines, grid, field borders, dividers. | `#2A3545` | `#D4DAE3` |
| `chalk` | Body text. `chalk-dim` is the muted pair for secondary text. | `#E6EAF0` / `#98A4B7` | `#141B26` / `#5A6474` |
| `teal` | **Established knowledge**: established names, sources, VERIFIED tags, the "explained back" rung. | `#4FB3A6` | `#1C7A6F` |
| `ochre` | **My own work**: predictions, my-version text, primary actions, the "applied" rung. | `#E0A33E` | `#A8700C` |
| `rust` | Misses, errors, dropped items. Used sparingly. | `#D1604A` | `#AE3F2A` |

The two accents carry meaning and are not interchangeable: **teal is what the
field already knows, ochre is what Pietro wrote himself.** That split is the
whole app in two colours, and it is what makes the status ladder legible.

### The status ladder (the one loud element)

Five rungs, drawn as five segments that fill and warm from left to right:

```
met                 ▱▱▱▱▱   hollow, rule-coloured
explained back ½    ▰▱▱▱▱   one segment, chalk-dim
explained back      ▰▰▰▱▱   teal        (the field's version landed)
applied             ▰▰▰▰▱   ochre       (my own build used it)
taught              ▰▰▰▰▰   ochre fill + chalk hairline (brightest thing on screen)
```

Cool and faint to warm and solid, so a row's status is readable at a glance
from across the table, without reading the label. Same component everywhere it
appears: the concept register, the lesson header, Today. Nothing else in the
app gets this much colour.

## 2. Type

Two families, both via `next/font/google`, variable, `display: swap`.

- **Archivo** — headings, navigation, labels, buttons, table headers. A
  grotesque with slightly compressed, technical proportions; it does not read
  as the default UI sans.
- **Source Serif 4** — everything meant to be *read*: lesson objectives,
  pre-work, tutor replies, explain-back answers, bridges, feedback. Serif at
  17px/1.65 holds an hour of reading far better than a UI sans.

Verbatim content only (build predictions, results, model output, exported
Markdown) uses the system monospace stack (`ui-monospace, SFMono-Regular, …`).
That is a third *stack* but not a third loaded family, and it is reserved for
content that is literally a transcript — never for a field label.

Reading columns are capped at `68ch` (`--measure`), which lands under 75
characters at the body size.

## 3. Layout

A fixed left rail (nav + a one-line progress read-out), one content column.
Below 900px the rail becomes a bottom bar with five icons and the content
column goes full width.

### Today

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Lab      │  Friday 24 October                                   │
│          │                                                      │
│ Today    │  ┌────────────────────────────────────────────────┐  │
│ Courses  │  │ Next: M0 · L2 How training works               │  │
│ Concepts │  │ Explain-back — 2 partial attempts so far       │  │
│ Recall ③ │  │ [ Open the lesson ]                            │  │
│ Builds   │  └────────────────────────────────────────────────┘  │
│ Log      │                                                      │
│ Parking ②│  Due for recall today                                │
│ Sources  │  ──────────────────────────────────────────────────  │
│ Settings │  Training without understanding      ▰▱▱▱▱  box 0    │
│          │  Meaning spread across parameters    ▰▰▰▱▱  box 2    │
│ ─────────│  [ Start recall ]                                    │
│ 4/17     │                                                      │
│ concepts │  Builds waiting for results                          │
│ explained│  ──────────────────────────────────────────────────  │
│ back     │  5 fresh chats, one factual prompt   predicted       │
│          │  Prediction saved 23 Oct · [ Add results ]           │
│          │                                                      │
│          │  2 open notes in the parking lot                     │
└──────────┴──────────────────────────────────────────────────────┘
```

Bands separated by hairlines, not cards. No count tiles.

### Lesson

The five loop steps *are* the tab strip, so the loop is always visible and
never duplicated as a separate progress widget. A filled marker means done.

```
┌──────────┬──────────────────────────────────────────────────────┐
│ …nav…    │  M0 · Lesson 2                                       │
│          │  How training works                      in progress │
│          │                                                      │
│          │  ● Pre-work  ● Session  ◌ Build  ◌ Explain-back  ◌ Bridge
│          │  ══════════════════════════════════════════════════  │
│          │                                                      │
│          │  Objectives                                          │
│          │  Loss, gradient descent, backpropagation; why        │
│          │  training works without anyone understanding what    │
│          │  a single parameter does.                            │
│          │                                                      │
│          │  ┌─ tutor session ────────────────────────────────┐  │
│          │  │ you   How does training know which way to go?  │  │
│          │  │ lab   Before I answer — what would you have    │  │
│          │  │       to measure to know you went the wrong    │  │
│          │  │       way?                      [ Park this ]  │  │
│          │  │ ─────────────────────────────────────────────  │  │
│          │  │ [ write a reply…                            ]  │  │
│          │  │ [ Send ]            [ End session ]            │  │
│          │  └────────────────────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────────────────┘
```

## 4. Three principles

1. **The ladder is the only loud thing.** Everything else is hairlines, two
   greys and text. If a second element competes for attention, it is wrong.
2. **Reading length beats density.** One column, capped measure, serif body.
   Nothing is squeezed into a grid to fill space.
3. **State appears where you act on it.** The loop state lives in the lesson's
   tab strip; a concept's status lives on its row. No decorative duplicate
   badges, no progress ring that restates a number next to it.

---

## 5. Review of the plan above, and what changed

Read back against the brief's list of generic defaults. Four things failed and
were revised; this section records the before and after.

1. **A three-tile count row on Today** ("17 concepts · 4 explained back · 3 due"),
   identical rounded cards with soft shadows. That is the SaaS dashboard
   cliché the brief rules out, and the numbers were not actionable.
   **Changed to** hairline-separated bands that each lead with a thing to do,
   plus one quiet progress line in the nav rail.
2. **All-caps eyebrow labels** over each band (`TODAY'S RECALL`, `OPEN BUILDS`).
   **Changed to** sentence-case headings in Archivo at normal case, with a
   hairline under them doing the separating work.
3. **Monospace for field labels and dates**, which reads as fake-technical.
   **Changed to** mono reserved strictly for verbatim transcript content
   (prediction, results, model output, exported Markdown).
4. **A single accent colour** (the near-black + one-accent pattern). It left
   the five ladder rungs with no way to differ except opacity, which is
   exactly the weak version of the signature element.
   **Changed to** the teal/ochre semantic split described above, which gives
   the ladder a real cool→warm ramp and tells the reader, everywhere in the
   app, which parts are the field's and which are his.

Also dropped: `→` on buttons (every button now names its action: "Save
prediction", "Grade my answer", "Park this"), and box shadows (replaced by 1px
hairlines and, on the active element, a 2px ochre left edge — the notebook
margin mark).

Motion: 120ms colour/opacity transitions on hover and focus only, all inside
`@media (prefers-reduced-motion: no-preference)`. Nothing animates on load.
