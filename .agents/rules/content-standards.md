# Content standards: writing units, checks, drills and real-work tasks

Use these whenever you add or edit learning content (Block 2 onward, or fixes).

## Unit structure (fixed order)
`{id, day, title, mins, card, screens:[...]}`. Screens, in order:
1. `read`: **Why it matters.** A 3–5 line real situation (vary hospital / commercial / residential / external works).
2. `read`: **The idea.** Plain words, then the term. Max ~150 words per screen; split into two screens rather than scroll.
3. A visual or worked example: `ruler` (schedule bars), `explainer` (step-through), or a `read` with **every hop shown**.
4. `guided` or `drill`: the learner does it, with instant feedback. Reuse existing drills when they fit.
5. `quiz`: a bank of 5–6 questions (gates use `n:10` with 12–14 questions); 5 are drawn at random; pass mark 80%.
6. `explain`: one prompt asking him to explain in his own words, to a site engineer or the COO.
7. `apply`: a real task on his live projects (auto-inserted from the `APPLY` map for main units; inline for track units).
8. `done`: card into Notes and the spaced-review deck; the day advances (main units only).

## Writing rules
- Concrete before abstract. Every new term gets a picture or an example **before** its definition.
- One concept per screen. If it needs two, make two screens.
- Use his world: PMC role, Indian sites, 6-day site weeks, monsoon, festivals, client-procured medical equipment, approvals (fire NOC, OC, AERB, PESO, pollution board), RA bills, BOQs.
- Numbers: use realistic magnitudes (₹ lakh / crore, working days). **Recompute every number.** Show units.
- Dates: always say what the date is the date OF, and whether durations are working or calendar days.
- Standards: describe Indian practice as *typical*, and say the contract's BOQ preamble or clause governs.

## Check questions (`quiz.bank` items)
Format: `{q:"…", o:[[text, isCorrect, why], …]}`, 4 options.
- **Exactly one correct option.** Tests enforce it.
- **Every option has a "why"** that teaches. Wrong options target a real misconception (double-adding the duration, largest vs smallest at merges, SS counted from the finish, delivery vs completion, cumulative vs this-bill, loose vs in-situ volume).
- No trick wording. No "all of the above".
- Mix recognition questions with computation and judgment ("what do you report", "what do you do first").

## Drills (`DRILLS` + `gen*` + `drillBody` + `grade` + `solution`)
- The generator produces realistic random problems and an `ans` object.
- `grade()` uses tolerances only where the question says to round.
- `solution()` shows **every hop**, then one line of what to say or do on site.
- Add a fuzz test: 40+ random problems must score 100 when the `ans` values are typed in.
- Map the drill to the unit that teaches it in `DRILL_UNIT`.

## Real-work tasks (`APPLY[unitId]`)
`{task, good:[rubric bullets], tmpl}`. The task must be doable in about 15 minutes on one of his live projects and produce something his COO would use. Rubric bullets are checkable. The template gives structure, not answers.

## Cards (spaced review)
`{id:"c-…", title, rule (one sayable line), example (numbers), trap (his likely mistake)}`. Keep each under ~400 characters.

## Before you finish
- Run `npm test`.
- Load `data/my-progress.json` through Restore backup and confirm his current day and passed units still show.
- Read the new screens at 380 px width in both light and dark mode.
