# PC Training: project rules for AI coding agents

## What this is
A single-page, mobile-first learning app that trains **Aditya** (Manager, Planning & Project Controls at a PMC running multi-site hospital projects in India) to become a competent Planning & Project Controls Manager in 90 days. It was built in Claude and exported here. Treat it as a **learning product**, not a demo: correctness of the content and the teaching method matter more than features.

## Files
- `app/index.html`: the whole app (HTML + CSS + one inline script). Content, engines and UI live here.
- `app/shim.js`: the standalone runtime. It provides `window.claude.use(name)` for `db` (localStorage documents), `sample` (LLM call: Gemini, Anthropic or OpenAI-compatible), `user` and `downloads`. The app code calls only these four. **Keep that interface stable**; change providers only inside the shim.
- `data/my-progress.json`: the learner's real progress (`{state, chat}`). Import via More → Restore backup. Never overwrite or "clean" it.
- `docs/PROGRAMME.md`: the learner's original 90-day brief (also embedded in the app as `<script id="rules">`).
- `docs/TUTOR_SYSTEM_PROMPT.md`: the exact tutor protocol text sent to the LLM.
- `.agents/rules/tutor-style.md`: how the AI tutor must answer. **Read before touching anything tutor-related.**
- `.agents/rules/content-standards.md`: how lessons, checks, drills and real-work tasks must be written. **Read before adding or editing content.**
- `tests/`: jsdom tests. Run `npm install` then `npm test`. All must pass before you finish a task.

## Run
`npx serve app` (or `python -m http.server -d app 8080`), then open the URL on a phone-width viewport. Opening via file:// mostly works but a local server is more reliable.

## Architecture (inside app/index.html)
- **Tabs:** Learn (course units, default) · Tutor (AI chat) · Practice (offline lessons and drills) · Notes (spaced-repetition cards) · More (progress, checklist, library, backup).
- **State:** one `state` object saved to doc `data/users/<uid>/state` as `{state: JSON string}`; chat in `.../chat` (archived to `archive_<ts>` docs when it exceeds ~200 KB). `state.v === 3`. Key fields: `day`, `course[unitId] = {screen, ok, quiz, passed, score, done, missed, apply, xsent}`, `bank` (cards), `sr` (SM-2 schedule per card), `practice` (drill/unit results, `reported` flag), `items` (master checklist status), `domain_scores`, `calib`, `patterns`, `deliverables`, `weekly`, `exam`.
- **Course:** `UNITS` (Days 0–20 main, Gate 1 at Day 20) and `MUNITS` (Site measurement track M1–M5, parallel, opens after Day 1, never advances `day`). Screen kinds: `read`, `ruler`, `explainer`, `guided`, `drill`, `cal`, `quiz`, `explain`, `apply`, `done`. Main units unlock strictly in order. A unit's `done` screen only completes if its quiz was passed (≥ 80%).
- **Engines:** `cpm()` computes ES/EF/LS/LF/TF/FF with FS/SS/FF + lags; `rulerHtml()` draws the schedule; the guided CPM trainer (`startGuided`, `classify` names the exact error); drill generators (`gen*`) with `grade()` and `solution()` (worked hops); the spaced repetition functions (`srRate`, `dueCards`).
- **Practice gating:** `DRILL_UNIT`, `LESSON_UNIT` and `GUIDED_UNIT` map each drill or reading to the unit that teaches it. Nothing opens before the learner passes that unit.
- **Tutor:** `buildTurns()` = PROGRAMME + PROTOCOL + CURRENT STATE + `guardrails()` + the last 16 messages. The reply must end with a `<<<STATE {json} STATE>>>` block that `applyUpdate()` parses. Messages tagged `[EXPLAIN-BACK Ux]`, `[APPLY Ux]`, `[TEACH]`, `[STATUS]`, `[CHALLENGE]`, `[RETEST]`, `[REAL]` are buttons; they skip the confidence requirement.

## Non-negotiables
1. **Teach before testing.** Order inside every unit: why → plain idea → visual or worked example → guided try → check with per-option explanations → explain-back → real-work task → card. Never introduce a term before a plain-language picture of it.
2. **Mastery gating.** No main day unlocks until the previous check is passed. Don't add skip buttons.
3. **Exact arithmetic.** Every number in a lesson, example or answer key must be recomputed by code or by hand. Drills must score 100% on correct answers across many random seeds (tests do this). Round only where the question says to.
4. **Accuracy and humility on standards.** Indian practice (IS 1200, CPWD, the Contract Act s.74, NABH, AERB, PESO) is described as *typical*. Always tell the learner that his contract's BOQ preamble or clause governs. Don't invent clause numbers or thresholds.
5. **Examples vary:** hospitals, commercial buildings, residential towers and external works (roads by chainage, drainage, STP, compound walls, landscaping).
6. **Mobile first:** short screens, no walls of text, tap targets of at least 40 px, light and dark theme via CSS variables.
7. **Learner data is sacred.** Migrations must be additive. Before any destructive change, write a `backup_*` doc first.
8. **The tutor is a tutor, not an examiner** (see `.agents/rules/tutor-style.md`).

## The roadmap (what to build next, in order)
- **Block 2, Days 21–50: Controls core.** P6 hands-on (build, baseline, update, read a 300+ activity schedule), progress measurement (rules of credit, S-curves, physical vs financial), cost control (budget, commitments, accruals, EAC), EVM, procurement control and cash flow, risk register. Gate 2 on Day 50.
- **Block 3, Days 51–70: Advanced.** Delay analysis and EOT (TIA, windows), change control and contracts (variations, LDs, claims), the integrated monthly cycle, reporting and executive communication, portfolio planning and digital tools. Gate 3 on Day 70.
- **Block 4, Days 71–90: Capstone.** Full project simulations (hospital, commercial, external works), monthly reports end to end, viva-style questioning, interleaved revision, final exam on Day 90.
- Write each block only after the previous gate is passed, following `content-standards.md`. Reuse existing drills where possible (`credit`, `scurve`, `cost`, `evm`, `cash`, `risk`, `tia`, `ld` already exist in Practice) and map them in `DRILL_UNIT`.

## Done means
- `npm test` is green.
- Every new quiz question has exactly one correct option, and every option has a "why".
- Every new number has been verified.
- The learner's saved progress still loads (test with `data/my-progress.json`).
