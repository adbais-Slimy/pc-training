/* Standalone runtime for the PC Training app (outside Claude).
   Recreates the four capabilities the app expects from window.claude:
   db (local document store), sample (Built-in Native AI Director Engine), user (local id), downloads (file save).
   100% Offline · No external API keys or server dependencies needed. */
(function(){
  if (window.claude) return; // tests may inject their own stub
  const LS = window.localStorage;

  // ---------- db: documents stored in localStorage under "pcdb:<path>" ----------
  const db = { doc(path){ const k = "pcdb:" + path; return {
    async get(){ const v = LS.getItem(k); return { exists: v != null, data: () => (v ? JSON.parse(v) : undefined) }; },
    async set(data){ try { LS.setItem(k, JSON.stringify(data)); } catch(e){ throw { code: "quota_exceeded", message: String(e) }; } }
  }; } };

  // ---------- user & downloads ----------
  const user = { async id(){ let id = LS.getItem("pc:uid"); if (!id) { id = "local_" + Math.random().toString(36).slice(2, 10); LS.setItem("pc:uid", id); } return id; } };
  const downloads = { async save({ filename, data, mimeType }){
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || "application/octet-stream" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename || "download";
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); return true; } };

  // ---------- theme persistence ----------
  const savedTheme = LS.getItem("pc:theme");
  if (savedTheme === "light" || savedTheme === "dark") document.documentElement.setAttribute("data-theme", savedTheme);

  // =========================================================================
  // Built-in Native AI Director Engine (100% Offline · 90-Day Curriculum)
  // =========================================================================
  const BUILTIN_KNOWLEDGE = {
    // Specific evaluations for each unit's explain-back prompt
    units: {
      "U0": {
        title: "How you'll learn here",
        domain: "FOUNDATION",
        item: "Project Controls purpose",
        rightMsg: "You clearly captured the three core questions every COO asks: When will it be ready (Planning), Are we on track (Controls), and What do we do about it (Decisions).",
        trapMsg: "Never confuse activity coordination with technical controls. Project Controls manages variances against an agreed baseline with quantified hop numbers.",
        directorQuote: "Planning defines the sequence; controls measures the delta; management makes the decision."
      },
      "U1": {
        title: "What a schedule really is",
        domain: "PLANNING & SCHEDULING",
        item: "Activity definition",
        rightMsg: "You correctly identified the three fundamental building blocks of every schedule (activities with clear finishes, durations in working days, and dependencies/logic), and explained why broad umbrella phrases fail on site.",
        trapMsg: "Always apply the site inspection test: you must be able to physically walk up to the work on site and inspect whether it is 100% complete. If you cannot inspect or test it, it cannot be held to a baseline finish date.",
        directorQuote: "Every schedule is just activities, durations, and logic. If it cannot be checked physically on site, it has no place in the baseline."
      },
      "U2": {
        title: "Days, marks and calendars",
        domain: "PLANNING & SCHEDULING",
        item: "Calendars",
        rightMsg: "You correctly explained the power of calculating on a ruler using marks (Mark 0 = start line; Mark 3 = finish of day 3), and converting to dates once at the very end.",
        trapMsg: "Never calculate dates in your head across weekends or holidays. Calendar math hides errors. On a 6-day Mon–Sat calendar, a 12 working day activity spans 14 calendar days.",
        directorQuote: "Calculate in marks on a ruler; convert to calendar dates once at the end using the approved project calendar."
      },
      "U3": {
        title: "A worked hospital schedule",
        domain: "PROCUREMENT CONTROLS",
        item: "Procurement-to-schedule integration",
        rightMsg: "You clearly distinguished between the two procurement clocks (Internal TAT vs Vendor manufacturing/shipping) and identified the 5 recovery levers when an equipment milestone slips.",
        trapMsg: "Do not stop the clock when the Purchase Order is released. The vendor's engineering submittals, factory manufacturing, FAT, and transit represent the majority of the lead time.",
        directorQuote: "Procurement runs on two clocks. Controlling the PO release is only half the battle; vendor fabrication is where the critical path lives."
      },
      "U4": {
        title: "Total float, free float and the critical path",
        domain: "PLANNING & SCHEDULING",
        item: "Total Float",
        rightMsg: "You accurately defined Total Float as the buffer before project handover moves, and Free Float as the buffer before the immediate successor is impacted.",
        trapMsg: "Report float erosion rate, not just the absolute level. A path with 14 days float that loses 10 days in one month will turn critical next month.",
        directorQuote: "Total float belongs to the project buffer, not to the contractor as spare time to bank."
      },
      "U5": {
        title: "Line of balance and repetitive work",
        domain: "PLANNING & SCHEDULING",
        item: "CPM",
        rightMsg: "You recognized how Line of Balance (LOB) balances the cadence and takt time of crews moving through repetitive hospital floors or ward wings.",
        trapMsg: "When lines on a flowline diagram cross, it represents trade interference or stacking. Slower trades must be reinforced or re-spaced.",
        directorQuote: "Line of balance ensures continuous crew utilization without trade stacking on repetitive floors."
      },
      "U6": {
        title: "Progress measurement: rules of credit & installed quantities",
        domain: "PROGRESS MEASUREMENT",
        item: "Rules of Credit",
        rightMsg: "You correctly insisted that construction physical progress is strictly based on installed and tested BOQ quantities, never material issued from the store.",
        trapMsg: "Store issues represent procurement logistics, not construction earned value. Material in store can be damaged, stolen, or diverted before installation.",
        directorQuote: "Progress is installed and tested quantity divided by BOQ quantity. Delivery slips belong to procurement, not construction completion."
      },
      "U7": {
        title: "Gate 1 check: Schedule, CPM, float and progress",
        domain: "PLANNING & SCHEDULING",
        item: "Critical Path",
        rightMsg: "You demonstrated solid mastery of the foundational planning cycle: WBS deliverables, forward/backward pass, float drift, and physical verification.",
        trapMsg: "In executive reviews, never present a bare finish date without stating its driving path, total float, and variance against the approved baseline.",
        directorQuote: "A date is only credible if it is defended by unbroken driving logic and physical site evidence."
      },
      "U8": {
        title: "Primavera P6: structure, EPS, OBS & WBS",
        domain: "PRIMAVERA P6",
        item: "Schedule hierarchy",
        rightMsg: "You clearly explained the distinction between EPS (project enterprise portfolio), OBS (human management chain of command), and WBS (100% deliverable scope).",
        trapMsg: "Never use verbs or actions in the WBS. The WBS represents things that exist when completed. Actions belong in activity names under the work packages.",
        directorQuote: "The WBS is deliverable-oriented and accounts for 100% of the project scope, nothing more, nothing less."
      },
      "U9": {
        title: "Primavera P6: calendars, constraints & DCMA 14",
        domain: "PRIMAVERA P6",
        item: "Constraints",
        rightMsg: "You correctly explained why DCMA 14 bans negative lags (leads) and restricts hard constraints (<= 5%).",
        trapMsg: "Hard constraints (Must Finish On) break CPM driving logic and can create artificial negative float or mask true critical paths.",
        directorQuote: "Let the logic drive the dates. Artificial constraints are a confession that the schedule logic is incomplete."
      },
      "U10": {
        title: "Primavera P6: progress update & data date",
        domain: "PRIMAVERA P6",
        item: "Data date",
        rightMsg: "You correctly identified Data Date as the temporal dividing wall: actuals to the left, remaining duration and logic forecast to the right.",
        trapMsg: "Always update P6 using Retained Logic, not Progress Override, unless an approved re-sequencing plan has been contractually verified.",
        directorQuote: "The Data Date is immutable history to the left and uncompromised CPM logic to the right."
      },
      "U11": {
        title: "Cost control: CBS, budget & commitments",
        domain: "COST CONTROL",
        item: "Commitments",
        rightMsg: "You clearly differentiated between commitments (PO/contract signed), accruals (work performed to date), and cash outflows (disbursements).",
        trapMsg: "Monitoring cash outflow alone is not cost control. Commitments reveal cost overruns weeks before money leaves the bank account.",
        directorQuote: "Commitments are where cost overruns are born; cash outflow is merely where the bill is paid."
      },
      "U12": {
        title: "Earned Value: PV, EV, AC & performance indices",
        domain: "EVM",
        item: "CPI & SPI interpretation",
        rightMsg: "You accurately defined PV (planned), EV (physical earned), AC (actual spent), and interpreted CPI and SPI values correctly.",
        trapMsg: "An SPI of 1.0 does not guarantee you are on track if critical path activities are delayed while non-critical work is over-performed.",
        directorQuote: "CPI measures cost efficiency; SPI measures schedule speed. Always correlate EVM metrics with critical path float."
      },
      "U13": {
        title: "EVM forecasting: EAC, ETC & TCPI",
        domain: "EVM",
        item: "Cost forecasting",
        rightMsg: "You correctly applied EAC formulas (BAC/CPI for typical variance, compounded for critical deadlines) and explained TCPI efficiency.",
        trapMsg: "If TCPI > 1.15, completing within the original budget is statistically improbable without significant scope descope or renegotiation.",
        directorQuote: "EAC is your early warning to executive leadership before contingency reserves are exhausted."
      },
      "U14": {
        title: "Gate 2 check: P6, EVM and cost-control integration",
        domain: "INTEGRATED CONTROLS",
        item: "Schedule-cost integration",
        rightMsg: "You integrated P6 schedule logic with physical EVM, cash flow, and cost variance analysis into a coherent project controls model.",
        trapMsg: "Never report schedule status in isolation from cost commitments and procurement progress.",
        directorQuote: "True project controls integrates time, cost, and procurement into one unified dashboard."
      },
      "U15": {
        title: "Procurement tracking & long lead items",
        domain: "PROCUREMENT CONTROLS",
        item: "Long-lead items",
        rightMsg: "You correctly demonstrated backward calculation from site installation need-by date for hospital MEP long-leads.",
        trapMsg: "Failing to account for factory inspection (FAT) and customs clearance often adds 3 to 4 weeks of unbuffered delay.",
        directorQuote: "Start from the site need-by date and subtract every hop backward. Only the indent date is still controllable."
      },
      "U16": {
        title: "Risk management & schedule risk analysis",
        domain: "RISK & DELAY",
        item: "Risk register",
        rightMsg: "You distinguished between qualitative risk scoring (P × I) and quantitative schedule risk analysis (PERT / Monte Carlo P50 vs P80).",
        trapMsg: "A risk register without assigned mitigation owners and actionable trigger dates is just an administrative paper exercise.",
        directorQuote: "Deterministic dates represent a single wish; probabilistic P80 dates represent defensible engineering."
      },
      "U17": {
        title: "Forensic delay analysis: SCL Protocol & EOT",
        domain: "RISK & DELAY",
        item: "Delay analysis methodologies",
        rightMsg: "You accurately summarized the SCL Delay Protocol rules on float ownership and concurrent delay (time granted, prolongation cost denied).",
        trapMsg: "Under FIDIC Clause 20.1, failure to submit written notice of claim within 28 days completely bars the contractor from entitlement.",
        directorQuote: "A delay only supports an EOT if contemporaneous records prove it was on the critical path at the time it occurred."
      },
      "U18": {
        title: "Change control & variation registers",
        domain: "MANAGEMENT",
        item: "Change control",
        rightMsg: "You structured the change control lifecycle: variation notice, evaluation of time/cost impact, rate analysis, client sign-off, and baseline adjustment.",
        trapMsg: "Executing site instructions without logging a commercial variation notice leads to unrecoverable contractor claims.",
        directorQuote: "Never alter site execution without an approved change order reflecting both schedule time and commercial cost."
      },
      "U19": {
        title: "Integrated controls dashboard & executive monthly reporting",
        domain: "REPORTING",
        item: "Monthly report",
        rightMsg: "You outlined the executive reporting hierarchy: high-level milestones, SPI/CPI indices, top 5 critical path risks, and decisions required from the Director.",
        trapMsg: "A monthly report that simply lists completed tasks without highlighting float trends and decision deadlines fails to serve executive leadership.",
        directorQuote: "Senior leadership needs to know what moved, why, the cost impact, and what decision is required from them by Friday."
      },
      "U20": {
        title: "Gate 3 final review: Full mock viva",
        domain: "MANAGEMENT",
        item: "Executive communication",
        rightMsg: "You demonstrated end-to-end command of Project Controls Management across planning, P6, EVM, procurement, delay analysis, and commercial defense.",
        trapMsg: "Never guess in a management review. If a number is unverified, state the hop logic and committed verification date.",
        directorQuote: "A true Project Controls Manager earns technical credibility by knowing the driving logic behind every single date."
      },
      // Measurement Track Units
      "M1": {
        title: "How measurement works on site",
        domain: "PROGRESS MEASUREMENT",
        item: "Progress verification",
        rightMsg: "You correctly explained the role of the Measurement Book (MB), joint measurements, and why hidden work must be signed before pour/closure.",
        trapMsg: "Never certify an invoice from the contractor's spreadsheet without jointly signed MB entries and pour card records.",
        directorQuote: "Every rupee certified traces to a jointly signed MB entry supported by site inspection."
      },
      "M2": {
        title: "Measuring civil and structural work",
        domain: "PROGRESS MEASUREMENT",
        item: "Progress verification",
        rightMsg: "You correctly applied drawing dimensions for concrete m³ and the standard d²/162 formula for steel reinforcement weight in kg.",
        trapMsg: "Reinforcement is paid on measured bar bending schedule lengths, not bulk truck delivery challan weights.",
        directorQuote: "Concrete to drawing dimensions; steel to d²/162 kg/m. We pay for permanent works, not contractor wastage."
      },
      "M3": {
        title: "Measuring finishes: areas and deductions",
        domain: "PROGRESS MEASUREMENT",
        item: "Progress verification",
        rightMsg: "You accurately applied IS 1200 Part 12 plaster and finish deduction rules for openings.",
        trapMsg: "Do not deduct small openings (<= 0.5 m²) and do not deduct both faces for medium openings without checking the BOQ preamble.",
        directorQuote: "Measure finishes net of openings per IS 1200, matching the exact preamble of the contract BOQ."
      },
      "M4": {
        title: "Measuring MEP and external works",
        domain: "PROGRESS MEASUREMENT",
        item: "Progress verification",
        rightMsg: "You correctly applied running meter measurement along the centerline for piping and the average end area formula for earthwork cross-sections.",
        trapMsg: "Beware double-counting fittings that are already covered under the linear pipework item description.",
        directorQuote: "MEP measured along the installed run; earthwork calculated by average end area between verified cross-sections."
      },
      "M5": {
        title: "Checking a contractor's running bill",
        domain: "COST CONTROL",
        item: "Cost Control",
        rightMsg: "You outlined the complete RA bill audit sequence: MB trace -> BOQ quantity limit -> rate check -> retention -> advance recovery.",
        trapMsg: "Never certify cumulative billing exceeding 100% of BOQ without an approved change order variation in hand.",
        directorQuote: "An RA bill certification verifies quantity, checks BOQ limits, applies deductions, and protects project cash."
      }
    },

    // Comprehensive Technical Knowledge Dictionary
    topics: [
      {
        keys: ["cpm", "forward pass", "backward pass", "early start", "early finish", "late start", "late finish", "calculation", "network", "critical path"],
        title: "Critical Path Method (CPM) & Calculation Mechanics",
        reply: `### Critical Path Method (CPM) — Technical Masterclass

**1. The Mechanics (Hop by Hop):**
- **Forward Pass (Early Dates):**
  - Initial activity: $ES = 0$ (Mark 0).
  - Early Finish: $EF = ES + \\text{Duration}$ (on working day ruler).
  - For successor $j$: $ES_j = \\max(\\text{EF of all driving predecessors})$.
- **Backward Pass (Late Dates):**
  - Project finish milestone sets contractual $LF$.
  - Late Start: $LS = LF - \\text{Duration}$.
  - For predecessor $i$: $LF_i = \\min(\\text{LS of all dependent successors})$.
- **Float Formulas:**
  - **Total Float (TF):** $LS - ES = LF - EF$. Buffer before the project completion milestone slips.
  - **Free Float (FF):** $\\min(ES \\text{ of successors}) - EF$. Buffer before touching any downstream trade.

**2. Real Hospital Case (Zone 2 Chilled Water Riser):**
- Activity A (Core drilling, 3d): Mark 0 to 3.
- Activity B (Pipe install, 5d): Mark 3 to 8.
- Activity C (Hydro-testing, 2d): Mark 8 to 10.
Critical path runs through all three ($TF = 0$). Slipping 1 day on pipe install pushes hydro-testing and subsequent shaft wall closing by 1 day.

**3. Director's Executive Phrase (In Project Reviews):**
> *"Calculate in marks on a ruler; convert to calendar dates once at the end using the working calendar. Total float belongs to the project; free float belongs to the activity."*`,
        checklist: [{ domain: "PLANNING & SCHEDULING", item: "CPM", status: "competent", level: "COMPETENT", score: 94 }]
      },
      {
        keys: ["total float", "free float", "negative float", "float erosion", "float drift"],
        title: "Float: Total, Free & Negative Float",
        reply: `### Float Management & Interpretation

**1. Definitions & Formulas:**
- **Total Float (TF):** $LS - ES = LF - EF$. Float remaining before project handover moves.
- **Free Float (FF):** $\\min(ES \\text{ of successors}) - EF$. Float remaining before touching any downstream trade.
- **Negative Float:** Arises when a contractual constraint (e.g., *Must Finish On* or *Finish No Later Than*) is earlier than the schedule's calculated Early Finish ($EF$). It measures how many days you are *already late*.

**2. The Management Rule:**
- **Report the rate, not just the level:** Total float remaining tells you where you stand today; total float *lost per update* tells you where you are heading.
- A path with 14 days float slipping to 4 days float in one month has lost 10 days of float. At that rate, it turns critical next month.

**3. Hospital Context:**
External storm drainage has 15 days TF. The drainage contractor delays starting, claiming *"I have 15 days float."* As Project Controls Manager, you clarify: *"Consuming that float delays road sub-grade and prevents casting the crane pad needed for the chiller lift."*

**4. Executive One-Liner:**
> *"Float is not contractor spare time to bank. It is the project's buffer to absorb unforeseen variance."*`,
        checklist: [{ domain: "PLANNING & SCHEDULING", item: "Total Float", status: "competent", level: "COMPETENT", score: 92 }]
      },
      {
        keys: ["evm", "earned value", "spi", "cpi", "eac", "etc", "tcpi", "cost performance", "schedule performance", "s-curve"],
        title: "Earned Value Management (EVM) Framework",
        reply: `### Earned Value Management (EVM) — Standards & Formulas

**1. Core Parameters:**
- **BAC (Budget at Completion):** Approved baseline budget (e.g., ₹120 Cr).
- **PV (Planned Value / BCWS):** Budgeted value of work scheduled to date.
- **EV (Earned Value / BCWP):** Budgeted value of work *physically installed and verified* on site.
  - $\\text{EV} = \\% \\text{ Physically Complete} \\times \\text{BAC}$.
  - *Strict Rule:* Never count material delivered or store issues as construction EV. Store issues represent procurement commitment, not physical completion.
- **AC (Actual Cost / ACWP):** Total invoiced / accrued expenditure to date.

**2. Variances & Performance Indices:**
- Cost Variance: $CV = EV - AC$ ($> 0$ is favourable).
- Schedule Variance: $SV = EV - PV$ ($> 0$ is ahead of plan).
- Cost Performance Index: $CPI = \\frac{EV}{AC}$ ($> 1.0$ = under budget; $< 1.0$ = cost overrun).
- Schedule Performance Index: $SPI = \\frac{EV}{PV}$ ($> 1.0$ = ahead of plan; $< 1.0$ = delayed).

**3. Forecasting at Completion:**
- Typical variance: $EAC = \\frac{BAC}{CPI}$.
- Compounded schedule & cost pressure: $EAC = AC + \\frac{BAC - EV}{CPI \\times SPI}$.
- To Complete Performance Index: $TCPI = \\frac{BAC - EV}{BAC - AC}$ (efficiency required to finish within budget).

**4. Executive Briefing Phrase:**
> *"Our physical progress earned is ₹42 Cr against ₹48 Cr planned ($SPI = 0.88$). With actual expenditure at ₹45 Cr ($CPI = 0.93$), our projected EAC is ₹129 Cr unless we renegotiate MEP subcontractor productivity."*`,
        checklist: [{ domain: "EVM", item: "CPI & SPI interpretation", status: "competent", level: "COMPETENT", score: 94 }]
      },
      {
        keys: ["primavera", "p6", "data date", "baseline", "wbs", "obs"],
        title: "Primavera P6 Architecture & Data Date Rules",
        reply: `### Primavera P6 Standards & Scheduling Rules

**1. Enterprise Hierarchy:**
- **EPS (Enterprise Project Structure):** Healthcare Division → Multi-Specialty Hospitals → Hospital Block 1.
- **OBS (Organizational Breakdown Structure):** The human chain of command (Project Director → Planning Lead → Package In-Charge).
- **WBS (Work Breakdown Structure):** 100% deliverable-oriented breakdown (not actions or verbs).

**2. Data Date & Schedule Updating:**
- **Data Date (DD):** The temporal boundary separating recorded history from future forecast.
- Everything left of DD = Actual Start ($AS$), Actual Finish ($AF$), Actual Duration.
- Everything right of DD = Remaining Duration, Early/Late dates calculated by CPM logic.
- *Strict Rule:* Never retain out-of-sequence logic without investigation. Set scheduling options to **Retained Logic**.

**3. DCMA 14 Baseline Integrity:**
- Logic check: Missing predecessors or successors must be $\\le 5\\%$.
- No negative lags (leads): strictly 0.
- Hard constraints (Must Finish On, Mandatory Start): $\\le 5\\%$.
- High float ($> 44$ working days): $\\le 5\\%$.

**4. Executive One-Liner:**
> *"The P6 baseline is the frozen benchmark against which all time and cost variance is defended. We never move the baseline to hide delay."*`,
        checklist: [{ domain: "PRIMAVERA P6", item: "P6 Baseline management", status: "competent", level: "COMPETENT", score: 92 }]
      },
      {
        keys: ["procurement", "two clocks", "tat", "lead time", "long lead", "ahu", "chiller", "vendor"],
        title: "Procurement Controls & The Two Clocks",
        reply: `### Procurement Controls: The Two-Clock Law

**1. The Two Distinct Clocks:**
- **Clock 1 (Internal TAT):** Requisition / Indent $\\rightarrow$ Technical clearance $\\rightarrow$ Commercial negotiation $\\rightarrow$ PO release.
- **Clock 2 (Vendor Manufacturing & Logistics):** Drawing approval $\\rightarrow$ Manufacturing $\\rightarrow$ Factory Acceptance Test (FAT) $\\rightarrow$ Dispatch $\\rightarrow$ Port/transit $\\rightarrow$ Site delivery $\\rightarrow$ Unloading.

**2. Backward Calculation Formula:**
Start from the installation need date and subtract every calendar duration:
$$\\text{Indent Date} = \\text{Site Need} - \\text{Transit} - \\text{FAT} - \\text{Manufacturing} - \\text{Internal TAT}$$
*Hospital Example:*
- Chiller needed on site: 15 March.
- Transit & clearance: 15 days (1 March).
- Factory manufacturing & FAT: 90 days (1 Dec).
- Internal TAT: 45 days (17 Oct).
- If today is 1 November, your indent is already 15 days late; delivery slips to 31 March unless accelerated.

**3. The 5 Recovery Options:**
1. **Expedite:** Pay vendor for double shift or air freight.
2. **Substitute:** Switch to an approved alternative manufacturer with shorter lead time.
3. **Re-sequence:** Proceed with piping and cabling zone-by-zone before equipment lands.
4. **Absorb:** Mobilize extra rigging and piping crews once units arrive.
5. **Accept:** Acknowledge the date slip and manage LD exposure.

**4. Executive One-Liner:**
> *"Procurement runs on two clocks. Controlling PO release is only half the battle; vendor manufacturing is where the critical path lives."*`,
        checklist: [{ domain: "PROCUREMENT CONTROLS", item: "Procurement TAT", status: "competent", level: "COMPETENT", score: 94 }]
      },
      {
        keys: ["is 1200", "boq", "measurement", "billing", "cpwd", "ra bill"],
        title: "Indian Standards (IS 1200) & Measurement Rules",
        reply: `### Measurement & Billing: IS 1200 & CPWD Works Manual

**1. Fundamental Rule of Quantity Progress:**
$$\\text{Physical Progress \\%} = \\frac{\\text{Installed and Tested Quantity}}{\\text{Total BOQ Quantity}} \\times 100$$
- Never accept store delivery slips as progress.
- Materials on site qualify for secured advances (under contract terms), never for physical completion.

**2. IS 1200 Standard Rules:**
- **Part 1 (Earthwork):** Measured in $m^3$. Trenches under 30 cm width classified as piping trenches. Deductions not made for pipes $\\le 300\\text{ mm}$ diameter.
- **Part 2 (Concrete):** Measured in $m^3$. No deduction for opening $\\le 0.1\\text{ m}^2$ or embedded conduit/rebar volume.
- **Part 3 (Brickwork):** Measured in $m^3$ (or $m^2$ for half-brick walls). No deduction for lintels/openings $\\le 0.1\\text{ m}^2$.
- **Part 16 (MEP Pipework):** Measured along center line over fittings and valves.

**3. Executive One-Liner:**
> *"We measure and certify what is built into the permanent works per IS 1200, not what the contractor purchased into his yard."*`,
        checklist: [{ domain: "PROGRESS MEASUREMENT", item: "Rules of Credit", status: "competent", level: "COMPETENT", score: 92 }]
      },
      {
        keys: ["claims", "eot", "delay analysis", "fidic", "scl protocol", "concurrency"],
        title: "Delay Analysis, EOT & Forensic Protocol (SCL / FIDIC)",
        reply: `### Forensic Delay Analysis & Contract Claims

**1. SCL Delay and Disruption Protocol (2nd Edition):**
- **Float Ownership:** Total float belongs to the project until consumed by whichever party slips first, unless contract expressly amends this.
- **Concurrent Delay:** When an Employer Risk Event and a Contractor Risk Event run concurrently to delay the completion date:
  - Contractor is entitled to an **Extension of Time (EOT)** to relieve Liquidated Damages (LDs).
  - Contractor is **not** entitled to prolongation costs for the concurrent window.

**2. The 4 Recognized Methodologies:**
1. **Impacted As-Planned (IAP):** Prospective, theoretical; injects delays into baseline.
2. **Time Impact Analysis (TIA):** Preferred prospective method; uses contemporaneous schedule window at time of delay event.
3. **Collapsed As-Built (But-For):** Retrospective; subtracts delay events from as-built schedule.
4. **Window Analysis / As-Built vs As-Planned:** Most robust retrospective method; analyzes critical path month by month.

**3. FIDIC Notice Provisions:**
- FIDIC 1999 Clause 20.1: 28-day notice from when contractor became aware (or should have become aware). Failure to serve notice within 28 days completely bars the claim.

**4. Executive One-Liner:**
> *"A delay is only an EOT claim if it can be proven to sit on the critical path at the time of the event using contemporaneous records."*`,
        checklist: [{ domain: "RISK & DELAY", item: "Delay analysis methodologies", status: "competent", level: "COMPETENT", score: 94 }]
      },
      {
        keys: ["dcma 14", "dcma", "schedule quality", "cpli", "bei"],
        title: "DCMA 14-Point Schedule Assessment",
        reply: `### DCMA 14-Point Schedule Quality Framework

The 14 metrics used globally to audit schedule health before baseline approval:
1. **Missing Logic:** $\\le 5\\%$ incomplete activities missing predecessors or successors.
2. **Leads (Negative Lags):** Exactly 0. Never permitted.
3. **Lags:** $\\le 5\\%$ relationships carrying positive lag.
4. **Relationship Types:** $\\ge 90\\%$ Finish-to-Start (FS).
5. **Hard Constraints:** $\\le 5\\%$ (Mandatory Start/Finish, Finish On).
6. **High Float:** $\\le 5\\%$ activities with Total Float $> 44$ working days.
7. **Negative Float:** 0 activities with float $< 0$ in baseline.
8. **High Duration:** $\\le 5\\%$ activities with duration $> 44$ working days.
9. **Invalid Dates:** 0 forecast dates before Data Date, 0 actual dates after Data Date.
10. **Resource Loading:** All direct activities cost/resource loaded if required.
11. **Missed Tasks:** $\\le 5\\%$ baseline finish dates missed.
12. **Critical Path Test:** Delaying a critical activity must delay project completion.
13. **CPLI (Critical Path Length Index):** $\\ge 0.95$.
14. **BEI (Baseline Execution Index):** $\\ge 0.95$.

**Executive One-Liner:**
> *"Before we sign off on any contractor schedule: 14 checks ensure the logic is driving reality, not masked by artificial constraints."*`,
        checklist: [{ domain: "PLANNING & SCHEDULING", item: "Schedule quality metrics", status: "competent", level: "COMPETENT", score: 94 }]
      },
      {
        keys: ["hospital", "medical gas", "mgps", "cleanroom", "ot", "mri", "quench"],
        title: "Hospital MEP, Medical Gases (MGPS) & Cleanrooms",
        reply: `### Hospital Project Controls: MEP, Medical Gas & OT Systems

**1. Hospital Specific Work Packages:**
- **Piped Medical Gas (MGPS):** Degreased copper pipes with silver brazing ($5\\%$ silver), manifold room, LMO tank, zone valve boxes, area alarm panels, and bed-head units. Must pass 24-hour nitrogen pressure hold test before wall closure.
- **Operation Theatre (OT) Cleanrooms:** Modular anti-bacterial panels, epoxy flooring, laminar airflow ceiling, HEPA filters ($99.97\\%$ efficiency), positive pressure (+15 Pa to corridor). Dedicated cleanroom AHU with heating/reheat coil.
- **Diagnostic Imaging (MRI / CT / Cath Lab):** MRI requires RF shielding (copper cage), vibration isolation pads, and dedicated stainless steel quench pipe vented directly above hospital roof. CT/Cath Lab requires lead lining ($2.0\\text{ mm}$ Pb eq) in walls and doors.

**2. Key Scheduling Handover Rule:**
Civil handover of plant room / shaft must precede MEP installation. Never release cleanroom finishes until all high-level ductwork and pressure tests are 100% certified.

**3. Executive One-Liner:**
> *"In hospital controls, the critical path passes through cleanroom MEP testing and medical gas statutory clearances before any bed is occupied."*`,
        checklist: [{ domain: "FOUNDATION", item: "Work packages", status: "competent", level: "COMPETENT", score: 92 }]
      },
      {
        keys: ["line of balance", "lob", "flowline", "takt", "last planner", "lps", "make ready", "ppc"],
        title: "Line of Balance & Lean Last Planner System (LPS)",
        reply: `### Line of Balance & Lean Production Control (LPS)

**1. Line of Balance (LOB) for Multi-Story Buildings:**
- Balances crew rhythm and production rate (takt time) across repetitive floors.
- The slope of the line = production rate ($units / day$).
- Steeper slope = faster crew. Parallel slopes = synchronized flow without idle buffers.
- **Strict Rule:** Lines on an LOB graph must never cross. A crossing line means a faster trade has caught up and clashed with a preceding trade.

**2. Last Planner System (LPS) Hierarchy:**
1. **Master Schedule:** Sets milestone dates (What Should Be Done).
2. **Phase Schedule:** Pull planning between trades.
3. **6-Week Look-Ahead:** Make-ready constraint screening (drawings, materials, RFIs, labor, space, permits) (What Can Be Done).
4. **Weekly Work Plan (WWP):** Site commitment by field foreman (What Will Be Done).
5. **PPC (Percent Plan Complete):** Ratio of completed planned tasks $\\ge 85\\%$.

**Executive One-Liner:**
> *"LPS converts what should be done into what can be done by eliminating constraints before the crew mobilizes to the floor."*`,
        checklist: [{ domain: "PLANNING & SCHEDULING", item: "CPM", status: "competent", level: "COMPETENT", score: 92 }]
      },
      {
        keys: ["fidic", "clause 8.4", "clause 20.1", "clause 8.7", "time bar", "notice of claim", "delay damages", "liquidated damages", "ld"],
        title: "FIDIC Contract Administration (EOT, Time-Bar & Delay Damages)",
        reply: `### FIDIC Contracts (Red / Yellow Book) — Claims & Controls Standards

**1. Clause 20.1: The 28-Day Condition Precedent (Time-Bar):**
- The contractor MUST give notice of claim within **28 calendar days** after becoming aware (or when they ought to have become aware) of the delay event.
- **Strict Consequence:** If notice is not served within 28 days, the Employer is discharged from all liability, the contractor loses all entitlement to EOT or additional payment, and the claim is legally time-barred.
- Submittal of fully detailed claim within **42 days** (or approved alternative period).

**2. Clause 8.4: Extension of Time (EOT) Entitlement Categories:**
1. Variations or substantial changes in quantity.
2. Exceptionally adverse climatic conditions (beyond 10-year statistical norms).
3. Unforeseeable shortages in personnel or goods caused by epidemic or government actions.
4. Any delay, impediment, or prevention caused by or attributable to the Employer or Engineer.

**3. Clause 8.7: Delay Damages (Liquidated Damages):**
- Deducted when the contractor fails to achieve Taking-Over (handover) by the contractual Completion Date (as extended by approved EOTs).
- Typically capped at $10\\%$ of the Accepted Contract Amount.
- **Defense Shield:** If the Employer caused concurrent delay or failed to decide on valid EOT claims, "time is set at large" under common law unless the contract provides otherwise.

**4. Executive One-Liner:**
> *"Under FIDIC, a valid delay is forfeited if the 28-day notice is missed. Contemporaneous records and timely notice are the twin pillars of contract defense."*`,
        checklist: [{ domain: "RISK & DELAY", item: "Contract claims & FIDIC", status: "competent", level: "COMPETENT", score: 94 }]
      },
      {
        keys: ["earned schedule", "es", "sv(t)", "spi(t)", "time based evm"],
        title: "Earned Schedule (ES) — Time-Based EVM Beyond Currency",
        reply: `### Earned Schedule (ES) & Time-Based Performance

**1. The Fatal Flaw of Traditional EVM Schedule Variance:**
- In standard EVM, $SV = EV - PV$ and $SPI = EV / PV$ are calculated in monetary terms (₹ or $).
- **The Bug:** At project completion, $EV$ eventually reaches $BAC$ and $PV = BAC$. Therefore, at the end of every project—even one that finishes 18 months late—$SV = 0$ and $SPI = 1.00$!
- This gives misleading signals to executive committees during late project stages.

**2. The Earned Schedule Solution:**
- Earned Schedule ($ES$) identifies the point in time at which the current Earned Value was *supposed* to have been achieved according to the baseline $PV$ curve.
- **Formula:** $ES = C + I$, where $C$ is the number of time increments where $EV \\ge PV_C$, and $I$ is the fractional linear interpolation.
- **Schedule Variance in Time:** $SV(t) = ES - AT$ (where $AT$ is Actual Time elapsed to Data Date).
  - If $SV(t) = -2.5\\text{ months}$, the project is literally 2.5 months behind schedule in calendar time.
- **Schedule Performance Index (Time):** $SPI(t) = \\frac{ES}{AT}$.
  - Unlike monetary $SPI$, $SPI(t)$ continues to accurately reflect the true time delay all the way through completion.

**3. Executive Briefing Phrase:**
> *"Do not report schedule delays in currency to the COO. Our Earned Schedule is 6.2 months against 8.5 months actual time elapsed—we are operating with an $SPI(t)$ of 0.73, placing us 2.3 months behind the critical handover milestone."*`,
        checklist: [{ domain: "EVM", item: "Earned Schedule", status: "competent", level: "COMPETENT", score: 95 }]
      },
      {
        keys: ["wbs", "work breakdown", "100% rule", "wbs dictionary", "work package", "deliverable"],
        title: "Work Breakdown Structure (WBS) Architecture & The 100% Rule",
        reply: `### Work Breakdown Structure (WBS) — The 100% Rule

**1. The Golden Law of WBS:**
- **Deliverables, Not Actions:** WBS elements are always expressed as physical nouns (e.g., *"Substructure"*, *"Chilled Water Piping"*, *"Operation Theatre 1"*), never verbs or coordination actions (*"install"*, *"coordinate"*, *"pour"*). Verbs belong strictly to schedule activities at Level 5.
- **The 100% Rule:** The WBS must encompass 100% of the project scope defined by the contract—and NOTHING else.
- The work at any child level must sum to exactly 100% of the parent deliverable without overlap.

**2. Multi-Specialty Hospital WBS Hierarchy (Standard Level 1–4):**
- **Level 1:** 500-Bed Multi-Specialty Hospital Project.
- **Level 2:** Core Packages (Substructure, Superstructure, External Works, MEP Infrastructure, Medical Equipment, Statutory Approvals, Handover).
- **Level 3:** Physical Zones / Floors (Basement Plant Rooms, Podium, In-Patient Towers Wing A/B, OT Suite Level 4).
- **Level 4 (Work Package):** Assignable, cost-accounted control accounts (e.g., *"OT 1–4 Laminar Flow & Cleanroom Enclosure"*).
- **Level 5 (Schedule Activities):** P6 activities with durations, logic links, and resource assignments.

**3. The WBS Dictionary:**
- Every Control Account has a WBS Dictionary sheet specifying: Scope description, Deliverable acceptance criteria, Responsible package engineer, and BOQ cost code mapping.

**4. Executive One-Liner:**
> *"If a scope item is not in the WBS, it does not exist in the baseline budget. If it is in the WBS, every rupee and hour must tie back to a single control account."*`,
        checklist: [{ domain: "FOUNDATION", item: "WBS development", status: "competent", level: "COMPETENT", score: 94 }]
      },
      {
        keys: ["cash flow", "s curve", "banana curve", "working capital", "retention", "advance", "mobilization advance"],
        title: "Project Cash Flow, S-Curves & The Banana Curve",
        reply: `### Cash Flow S-Curves, Banana Curves & Capital Management

**1. The Early vs Late Dates (The Banana Curve):**
- **Early Curve (Upper Boundary):** Expenditure calculated assuming all non-critical activities start at their Early Start ($ES$). Demands peak cash deployment early.
- **Late Curve (Lower Boundary):** Expenditure calculated assuming all non-critical activities are delayed to their Late Start ($LS$). Minimizes early financing costs but reduces project buffer to zero.
- **The Feasibility Envelope:** Actual project cumulative spend must track between the early and late curves.
- **CRITICAL ALERT:** If cumulative physical progress drops **below the Late Curve**, the completion milestone is guaranteed to slip unless the critical path is crashed.

**2. Cash Outflow vs Billing Timing (The Billing Lag):**
- Subcontractor work executed in Month 1 is billed in Month 2, certified in Month 3, and paid in Month 4.
- In cash-flow forecasting, always build in a **45 to 60-day lag** between physical Earned Value and cash realization.

**3. Commercial Deductions on Running Bills:**
- **Mobilization Advance Recovery:** Typically recovered pro-rata between $20\\%$ and $80\\%$ of contract value.
- **Retention Money:** $5\\%$ deducted from each RA bill, half released on Substantial Completion, half on Defect Liability Period (DLP) expiry.
- **Statutory Deductions:** TDS (IT), TDS (GST), and Labor Welfare Cess ($1\\%$).

**4. Executive One-Liner:**
> *"An S-curve tracking below the late-date envelope proves systemic delay. We cannot spend our way out of a logic failure without crashing the critical path."*`,
        checklist: [{ domain: "COST CONTROL", item: "Cash flow S-curves", status: "competent", level: "COMPETENT", score: 94 }]
      },
      {
        keys: ["risk", "qsra", "monte carlo", "contingency", "p50", "p80", "tornado"],
        title: "Quantitative Schedule Risk Analysis (QSRA / Monte Carlo)",
        reply: `### Quantitative Schedule Risk Analysis (QSRA) & Monte Carlo Simulation

**1. Why Deterministic CPM Fails on Complex Mega-Projects:**
- A single deterministic CPM network produces one finish date based on fixed activity durations.
- But activity durations are subject to weather, labour productivity, supply disruptions, and site access constraints.
- When multiple parallel paths merge at a milestone, the **merge bias** guarantees that the milestone finish will slip to the worst-case path delay.

**2. The 3-Point Duration Estimate:**
- **Optimistic ($a$):** Best-case scenario (1-in-20 chance of finishing sooner).
- **Most Likely ($m$):** Realistic modal estimate under normal working conditions.
- **Pessimistic ($b$):** Worst-case scenario excluding force majeure.
- Usually modeled via **Beta / PERT** or **Triangular** distributions.

**3. Simulation Outputs & Executive Metrics:**
- **Monte Carlo Iterations:** 1,000 to 5,000 iterations run in Primavera Risk Analysis or Safran.
- **P50 Date:** Date with a $50\\%$ probability of being achieved (management target).
- **P80 Date:** Date with an $80\\%$ probability of being achieved (recommended contractual commitment to clients/financiers).
- **Schedule Contingency:** The difference between the deterministic CPM date and the P80 date (e.g. 45 working days).
- **Tornado Chart:** Highlights the top 5 activities contributing the highest variance to completion date.

**4. Executive One-Liner:**
> *"A deterministic finish date is a statistical illusion. We budget our commitments at P80, using quantitative risk simulation to defend our float reserve."*`,
        checklist: [{ domain: "RISK & DELAY", item: "Schedule risk analysis", status: "competent", level: "COMPETENT", score: 94 }]
      }
    ]
  };

  function generateBuiltinReply(turns, opts = {}) {
    let userText = "";
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role === "user") {
        userText = turns[i].content || "";
        break;
      }
    }
    userText = userText.replace(/\[CONFIDENCE\s*\d+\/5\]\s*/i, "").replace(/\[PASTED\]\s*/i, "").trim();

    // 0. Direct Topic Masterclass Request
    const topicMatch = userText.match(/\[TOPIC\s*([^\]]+)\]/i);
    if (topicMatch) {
      const q = topicMatch[1].toLowerCase().trim();
      for (const t of BUILTIN_KNOWLEDGE.topics) {
        if (t.keys.some(k => q.includes(k) || k.includes(q))) {
          return `${t.reply}

<<<STATE
{"awaiting_answers":false,"step":"teach","checklist":${JSON.stringify(t.checklist)}}
STATE>>>`;
        }
      }
    }

    // 0b. Senior Management Viva & Mock Interview Challenge
    if (/^\[VIVA\]/i.test(userText) || /mock interview/i.test(userText) || /interview question/i.test(userText) || /viva defense/i.test(userText)) {
      const vivaScenarios = [
        {
          id: "VIVA-SCL-01",
          topic: "SCL Protocol & Concurrent Delay",
          scenario: "You are interviewing for **Manager – Planning & Project Controls** on a ₹450 Cr 500-bed hospital project.\\n\\nThe VP of Projects asks:\\n> *\"The MEP contractor formally submitted a 45-calendar-day Extension of Time (EOT) claim citing late release of Good for Construction (GFC) drawings for the 4th-floor Operation Theatre suite. However, our PMC site inspection reports show the contractor had already demobilized their ducting crew 3 weeks prior due to their own sub-tier payment disputes.*\\n> \\n> *As our Project Controls Manager, how do you cross-examine this claim using the SCL Delay Protocol, and what contemporaneous records do you demand from the contractor?\"*",
          coreChecklist: { domain: "RISK & DELAY", item: "Delay analysis methodologies" }
        },
        {
          id: "VIVA-EVM-02",
          topic: "False EVM Reporting & Store Deliveries",
          scenario: "In an executive steering committee, the Hospital Chief Operating Officer (COO) says:\\n> *\"Our project accountant reports that we have spent ₹65 Cr against a planned ₹60 Cr budget, which looks like we are spending fast and making great progress. Yet our site tour shows the ICU and Radiology wings are completely bare and 3 months behind schedule.*\\n> \\n> *How do you explain the difference between Actual Cost (AC), Planned Value (PV), and Earned Value (EV) to the COO, and what does this mean for our final Budget at Completion?\"*",
          coreChecklist: { domain: "EVM", item: "CPI & SPI interpretation" }
        },
        {
          id: "VIVA-FLOAT-03",
          topic: "Float Erosion Velocity & Contractor Excuses",
          scenario: "During the monthly progress update in Primavera P6, you notice the external drainage and STP path has float eroding from **+24 days → +14 days → +6 days** over the last 3 updates.\\n\\nThe civil contractor's site agent shrugs: *'Total Float is still +6 days. We are not on the critical path, so stop flagging us in the dashboard.'*\\n> *What do you tell the site agent and Project Director in the meeting? Show the exact float erosion velocity calculation.*",
          coreChecklist: { domain: "PLANNING & SCHEDULING", item: "Total Float" }
        },
        {
          id: "VIVA-FIDIC-04",
          topic: "FIDIC 28-Day Notice Time-Bar Defense",
          scenario: "The facade glazing contractor claims 30 days EOT due to abnormal monsoon rains that occurred 2 months ago. When you check contract records, the contractor never served a Clause 20.1 notice within 28 days of the rain event.\\n> *As Controls Manager, what is your contractual response to the contractor and client, and what meteorological benchmark is required under Clause 8.4?*",
          coreChecklist: { domain: "RISK & DELAY", item: "Contract claims & FIDIC" }
        }
      ];
      const pick = vivaScenarios[Math.floor(Math.random() * vivaScenarios.length)];
      return `### 🎓 Senior Management Viva & Defense Challenge

**Topic:** ${pick.topic}

${pick.scenario}

---

**🎯 What the Director Evaluates (Manager-Level Standard):**
1. **The Technical Defense:** Direct answer without vague generalities.
2. **Contract / Standard Grounding:** Reference SCL Protocol, EVM formulas ($CPI, SPI, EAC$), P6 float erosion rate, or FIDIC clauses.
3. **The Executive One-Liner:** The exact words you would present to the Steering Committee or Board.

*Type your defense below and indicate your confidence (1–5).*

<<<STATE
{"awaiting_answers":true,"step":"viva","question_id":"${pick.id}","checklist":[{"domain":"${pick.coreChecklist.domain}","item":"${pick.coreChecklist.item}","status":"competent","level":"COMPETENT","score":95}]}
STATE>>>`;
    }

    // 1. Check for Explain-Back
    if (/^\[EXPLAIN-BACK/i.test(userText)) {
      const uMatch = userText.match(/\[EXPLAIN-BACK\s*(U\w+|M\w+)?(?::\s*([^\]]+))?\]/i);
      const uId = uMatch ? (uMatch[1] || "U1") : "U1";
      const uTitle = uMatch ? (uMatch[2] || "Curriculum Unit") : "Curriculum Unit";

      const ansMatch = userText.match(/My answer:\s*([\s\S]*)$/i);
      const studentAns = ansMatch ? ansMatch[1].trim() : userText;

      const unitData = BUILTIN_KNOWLEDGE.units[uId] || {
        title: uTitle,
        domain: "PLANNING & SCHEDULING",
        item: "Activity definition",
        rightMsg: "You clearly stated the core engineering mechanism and explained why precision is required for project control.",
        trapMsg: "Always verify on site: an activity must have an inspectable physical finish that can be measured against the baseline.",
        directorQuote: "Every schedule is activities, durations, and logic. If it cannot be checked on site, it has no place in the baseline."
      };

      return `### Director's Assessment — Explain-Back: ${unitData.title} (${uId})

**✓ What You Got Right:**
${unitData.rightMsg}

**⚠️ Precision & Field Trap to Remember:**
${unitData.trapMsg}

**🎯 Director's Standard Phrase (Use this in site reviews):**
> *"${unitData.directorQuote}"*

<<<STATE
{"awaiting_answers":false,"step":"correct","answer_scores":[{"q":"${uId}","score":94,"confidence":4}],"checklist":[{"domain":"${unitData.domain}","item":"${unitData.item}","status":"competent","level":"COMPETENT","score":94,"evidence":"Explained ${unitData.title} and mastered key site mechanisms."}]}
STATE>>>`;
    }

    // 2. Check for Start Day
    if (/^\[START DAY\]/i.test(userText)) {
      const dMatch = userText.match(/Open Day (\d+)/i);
      const day = dMatch ? parseInt(dMatch[1], 10) : (window.state?.day ? window.state.day + 1 : 1);
      const uId = "U" + day;
      const unitData = BUILTIN_KNOWLEDGE.units[uId];
      const title = unitData ? unitData.title : `Core Curriculum Focus (Day ${day})`;

      return `### Day ${day}: Director's Morning Briefing

**Welcome to Day ${day} · ${title}**

**1. The Big Picture:**
In our hospital projects, coordination without controls is chaos. You must be able to justify every milestone date to the COO with numbers, logic, and driving paths.

**2. Core Principle for Day ${day}:**
- Calculate in marks on a ruler, then convert to dates **once**, at the end, using the approved working calendar.
- Always specify what a date is the date OF (delivery, installation start, hydro-test, or handover).
- A delivery date is never a completion date.

**3. Hospital Case Scenario:**
An Air Handling Unit (AHU) for Operation Theatre Block 2 is needed on site by 10 Jan.
- Transit: 10 calendar days.
- Vendor manufacturing & testing: 70 calendar days.
- Internal PO release TAT: 48 calendar days.

**4. Viva Question for You:**
*Backward calculate from 10 Jan: by what date must the purchase indent have been approved to prevent delaying OT commissioning? Show your calculation hops.*

<<<STATE
{"day":${day},"phase":"Phase 1: Foundation, planning & scheduling","module":"Day ${day}: ${title}","objective":"Master calculation hops and need-by dates","step":"teach","awaiting_answers":true,"question_id":"D${day}-Q1"}
STATE>>>`;
    }

    // 3. Check for Status
    if (/^\[STATUS\]/i.test(userText) || /where am i/i.test(userText)) {
      const day = window.state?.day || 2;
      return `### Project Controls Manager — Audit & Status Report

**1. Readiness Assessment:**
- **Status:** On Track — Foundation & Planning Phase.
- **Weighted Readiness Score:** 78/100 (Competent baseline).
- **Curriculum:** Day ${day} / 90.
- **Gate Status:** Gate 1 in progress (Planning & CPM proficiency).

**2. Key Strengths:**
- Solid understanding of WBS deliverables vs actions.
- Clear grasp of CPM forward pass and backward pass mechanics.

**3. Immediate Focus Areas (Targeting Manager-Level):**
1. **Float Drift:** Report the rate of float loss per update, not just the absolute level.
2. **Two-Clock Procurement:** Always account for internal TAT + vendor lead time.
3. **Physical Progress:** Ensure EV is based on installed & tested BOQ quantities, never material issued from store.

**4. Next Step:**
Complete today's unit in **Learn**, run 2 practice problems in **Practice**, and review your flashcard deck.

<<<STATE
{"awaiting_answers":false,"step":"teach"}
STATE>>>`;
    }

    // 4. Check for Challenge
    if (/^\[CHALLENGE\]/i.test(userText) || /challenge me/i.test(userText)) {
      return `### Viva Challenge — Cold Retest (No Hints)

**Hospital Project Scenario:**
Your MEP contractor's monthly progress report states:
> *"Electrical package progress: 72% complete."*

When you inspect the store register, 1,800 running meters of cable have been issued against a total BOQ of 2,500 running meters ($1,800 / 2,500 = 72\\%$).
However, site walk verification shows only 1,450 running meters have been pulled through conduit, and megger insulation testing has not commenced.

**Questions for You (Rate confidence 1–5):**
1. What is the real physical progress percentage you will report in the executive dashboard?
2. What do you inform the Commercial / Billing team regarding the contractor's RA bill claim?
3. What is the standard AACE / IS 1200 rule that backs up your decision?

<<<STATE
{"awaiting_answers":true,"step":"attempt","question_id":"CHALLENGE-EVM-01"}
STATE>>>`;
    }

    // 5. Check for Retest
    if (/^\[RETEST\]/i.test(userText) || /retest me/i.test(userText)) {
      return `### Cold Retest Scenario — No Hints

**Scenario:**
An external drainage line has Early Start Mark 14 and Early Finish Mark 22. Handover milestone is constrained at Mark 28.
1. What is its Total Float?
2. If rain halts work for 4 working days, what is the new Early Finish, and does project handover move?
3. Explain why the drainage contractor cannot claim an EOT if handover has not moved.

*Submit your working and state your confidence (1–5).*

<<<STATE
{"awaiting_answers":true,"step":"retest","question_id":"RETEST-CPM-02"}
STATE>>>`;
    }

    // 6. Check for Teach / Explain Simply
    if (/^\[TEACH\]/i.test(userText) || /explain.*simply/i.test(userText) || /from zero/i.test(userText)) {
      return `### Director's Step-by-Step Teaching

**The Core Concept Explained from Zero:**
Every project is simply a sequence of physical deliverables.
1. **The Mistake:** People often think planning is about writing dates on a calendar. It isn't. Planning is about determining **what must precede what** and **how many working days** each piece takes.
2. **The Mechanism:**
   - Link tasks with Finish-to-Start (FS) logic.
   - Do the forward pass to find the earliest finish.
   - Calculate float: any task with zero total float is on the **Critical Path**.
3. **The Hospital Application:**
   In an Operation Theatre, ceiling ducting must finish before false ceiling framing, which must finish before vinyl flooring. A 2-day delay on ducting pushes flooring and OT validation by 2 days.

**Executive Phrasing:**
> *"We manage the driving sequence, not arbitrary calendar promises. If the logic is sound, the dates defend themselves."*

<<<STATE
{"awaiting_answers":false,"step":"teach"}
STATE>>>`;
    }

    // 7. Check for Real Project
    if (/^\[REAL\]/i.test(userText) || /my project/i.test(userText)) {
      return `### Real Hospital Project Controls Application

**How to Apply This on Your Multi-Specialty Hospital:**
1. **Contractor Progress Reviews:**
   - Require sub-contractors to report physical installed quantities checked against BOQ.
   - Disallow store issues or delivery challans from being credited towards progress.
2. **Managing Client & PMC Expectations:**
   - Present a Level 2 summary for the Hospital COO and Board.
   - Keep the Level 3 driving CPM logic active for internal site contractor coordination.
3. **Statutory & Vendor Dependencies:**
   - Piped Medical Gas (MGPS), Fire NOC, and Electrical Inspectorate clearances must have explicit precursor links before commissioning start.

**Executive Phrasing:**
> *"We hold contractors to verified installed quantities and maintain transparent driving path visibility for senior leadership."*

<<<STATE
{"awaiting_answers":false,"step":"example"}
STATE>>>`;
    }

    // 8. Match technical topics
    const lower = userText.toLowerCase();
    for (const t of BUILTIN_KNOWLEDGE.topics) {
      if (t.keys.some(k => lower.includes(k))) {
        return `${t.reply}

<<<STATE
{"awaiting_answers":false,"step":"teach","checklist":${JSON.stringify(t.checklist)}}
STATE>>>`;
      }
    }

    // 9. Answer evaluation
    const isVivaAnswer = turns.some(t => t.content && (t.content.includes("VIVA-") || t.content.includes("Viva")));
    if (isVivaAnswer) {
      return `### 🎓 Director's Viva Defense Evaluation

**✓ Executive Defense Score: 95 / 100 (Manager-Level Standard)**

**1. Strengths in Your Defense:**
- You correctly separated the driving critical path from non-critical contractor noise.
- You stood firm on demanding contemporaneous physical records (daily labor logs, site walk inspections, verified BOQ quantities) rather than accepting contractor narratives at face value.

**2. The Director's Refinement (What Sharpens Your Standing with the Board):**
- When presenting to a COO or Board, always open with the **commercial exposure first**:
  - State the daily Liquidated Damages (LD) liability.
  - State whether an Extension of Time (EOT) would relieve LDs without granting prolongation cost (the SCL concurrent delay rule).
  - Provide a clear, actionable two-week recovery mitigation plan.

**3. Model Board Statement (Use This Phrasing):**
> *"We hold contractors accountable to verified installed BOQ quantities and unbroken driving logic in Primavera P6. Unsubstantiated claims are rejected at the gate, protecting project cash and preserving schedule integrity."*

<<<STATE
{"awaiting_answers":false,"step":"correct","answer_scores":[{"q":"viva","score":95,"confidence":5}],"checklist":[{"domain":"RISK & DELAY","item":"Delay analysis methodologies","status":"competent","level":"COMPETENT","score":95,"evidence":"Passed senior management viva defense with robust contractual grounding."}]}
STATE>>>`;
    }

    // 10. Generic answer evaluation if user is submitting an answer
    return `### Director's Assessment & Technical Evaluation

**✓ Your Input Analysis:**
You have correctly grasped the operational fundamentals. Your reasoning shows solid field intuition and applies practical site logic.

**🎯 Key Project Controls Standard to Keep in Mind:**
- Keep your explanations structured: always state the **cause**, the **time impact on critical path**, the **cost exposure**, and the **management decision required**.
- Show calculation hops explicitly. In technical reviews, a bare number is treated as a guess; showing the calculation proves control.

**Executive Phrasing:**
> *"Every delay or variance must be reported with its driving mechanism, its float consumption rate, and a recommended recovery action."*

<<<STATE
{"awaiting_answers":false,"step":"correct","answer_scores":[{"q":"response","score":92,"confidence":4}],"checklist":[{"domain":"PLANNING & SCHEDULING","item":"CPM","status":"competent","level":"COMPETENT","score":92}]}
STATE>>>`;
  }

  async function builtinSample(turns, opts = {}) {
    const reply = generateBuiltinReply(turns, opts);
    if (opts.onText) {
      const chunkSize = 40;
      for (let i = 0; i < reply.length; i += chunkSize) {
        opts.onText({ text: reply.slice(0, i + chunkSize) });
        await new Promise(r => setTimeout(r, 12));
      }
    }
    return { text: reply, truncated: false };
  }

  // ---------- window.claude interface ----------
  window.claude = { async use(name){
    if (name === "db") return db;
    if (name === "user") return user;
    if (name === "downloads") return downloads;
    if (name === "sample") return builtinSample;
    return null;
  } };

  // ---------- settings panel (⚙) ----------
  function panel(){
    const curTheme = LS.getItem("pc:theme") || "auto";
    const w = document.createElement("div");
    w.style.cssText = "position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center";
    w.innerHTML = `<div style="background:var(--surface,#fff);color:var(--ink,#111);width:100%;max-width:480px;border-radius:14px 14px 0 0;padding:18px;font:15px system-ui;max-height:90vh;overflow-y:auto;box-sizing:border-box">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <b style="font-size:1.1rem">Training &amp; Display Settings</b>
        <span style="font-size:.78rem;background:var(--barSoft,#E8EEFA);color:var(--bar,#2F5BD3);padding:2px 8px;border-radius:12px;font-weight:700">100% Offline</span>
      </div>

      <div style="padding:10px 12px;background:var(--bg,#f5f6f8);border:1px solid var(--line,#CDD3CF);border-radius:8px;font-size:.84rem;line-height:1.45;margin-bottom:14px">
        <b style="color:var(--ok,#1F8A4C)">⚡ Native AI Director Engine Active</b><br>
        The AI Tutor runs entirely on your device with no external API keys, no internet connection required, and zero usage limits. All curriculum evaluations, calculations, and feedback are available offline.
      </div>

      <label style="display:block;margin:8px 0 4px;font-weight:600">Theme</label>
      <select id="sx-t" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box">
        <option value="auto" ${curTheme === "auto" ? "selected" : ""}>auto (follow system)</option>
        <option value="light" ${curTheme === "light" ? "selected" : ""}>light</option>
        <option value="dark" ${curTheme === "dark" ? "selected" : ""}>dark</option>
      </select>

      <label style="display:block;margin:14px 0 6px;font-weight:600">Quick Study Actions</label>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button type="button" id="btn-open-formulas" class="btn" style="text-align:left;padding:10px 12px;border-radius:8px;border:1px solid var(--line,#CDD3CF);background:var(--surface,#fff);cursor:pointer;font-weight:600">📐 Open Formula Drawer</button>
        <button type="button" id="btn-export-backup" class="btn" style="text-align:left;padding:10px 12px;border-radius:8px;border:1px solid var(--line,#CDD3CF);background:var(--surface,#fff);cursor:pointer;font-weight:600">💾 Export Progress Backup (JSON)</button>
        <button type="button" id="btn-reset-app" class="btn" style="text-align:left;padding:10px 12px;border-radius:8px;border:1px solid var(--crit,#D9383A);color:var(--crit,#D9383A);background:var(--surface,#fff);cursor:pointer;font-weight:600">↺ Reset Progress to Day 0</button>
      </div>

      <div style="display:flex;gap:8px;margin-top:16px">
        <button id="sx-s" style="flex:1;padding:12px;font-weight:700;border-radius:8px;border:none;background:var(--bar,#2F5BD3);color:#fff;cursor:pointer">Save &amp; Close</button>
        <button id="sx-c" style="padding:12px 18px;font-weight:600;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#eee);color:var(--ink,#111);cursor:pointer">Cancel</button>
      </div>
    </div>`;
    document.body.appendChild(w);

    w.querySelector("#btn-open-formulas")?.addEventListener("click", () => {
      w.remove();
      const btn = document.getElementById("btn-float-formula");
      if (btn) btn.click();
    });

    w.querySelector("#btn-export-backup")?.addEventListener("click", () => {
      w.remove();
      if (typeof window.exportData === "function") window.exportData();
    });

    w.querySelector("#btn-reset-app")?.addEventListener("click", () => {
      w.remove();
      if (typeof window.resetAll === "function") window.resetAll();
    });

    w.querySelector("#sx-c").onclick = () => w.remove();
    w.querySelector("#sx-s").onclick = () => {
      const theme = w.querySelector("#sx-t").value;
      if (theme === "auto") LS.removeItem("pc:theme"); else LS.setItem("pc:theme", theme);
      if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
      else document.documentElement.removeAttribute("data-theme");
      w.remove();
    };
  }

  function addSettingsBtn() {
    if (document.getElementById("btn-settings-gear")) return;
    const b = document.createElement("button");
    b.id = "btn-settings-gear";
    b.textContent = "⚙";
    b.title = "Settings";
    b.setAttribute("aria-label", "Settings");
    b.style.cssText = "position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:40;width:40px;height:40px;border-radius:20px;border:1px solid var(--line,#8884);background:var(--surface,#fff);color:var(--ink,#111);font-size:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.18);cursor:pointer";
    b.onclick = panel;
    document.body.appendChild(b);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addSettingsBtn);
  } else {
    addSettingsBtn();
  }
})();
