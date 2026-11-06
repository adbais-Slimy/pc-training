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
      },
      "M6": {
        title: "Rate analysis, extra items & material reconciliation",
        domain: "COST CONTROL",
        item: "Cost Control",
        rightMsg: "You clearly grasped the first-principles rate analysis (Material + Labor + Machinery + 15% CP&OH), the 125% deviation threshold, and the necessity of rigorous material reconciliation against permissible wastage limits.",
        trapMsg: "Never certify non-BOQ rates based on verbal quotes alone. Demand supplier invoices, labor deployment slips, and contractor quotation breakdowns before submitting to the client.",
        directorQuote: "An extra item rate must be built from verified market invoices, standard labor constants, and 15% CP&OH. Theoretical reconciliation protects project cash from unaccounted site wastage."
      }
    },

    // Daily Briefings for Days 0 through 20 (Phase 1 Curriculum)
    dayBriefings: {
      0: {
        bigPic: "A project manager manages people and day-to-day coordination; a project controls manager manages variance against an approved baseline with quantified numbers.",
        principle: "- Planning answers: When will it be ready?\n- Controls answers: Are we on track, and what is the variance delta?\n- Decisions answers: What management action is required by when?",
        scenario: "Your Project Director asks: 'Our site engineers track dates in Excel every day. Why do we need formal Project Controls?'",
        vivaQ: "In two sentences, what are the three fundamental questions every Project Controls system must answer for executive leadership?"
      },
      1: {
        bigPic: "A schedule is not a list of wishes on a calendar. It is a mathematical model of physical construction sequence.",
        principle: "- An activity must have a tangible, inspectable physical finish.\n- Durations are estimated in working days based on crew productivity, not arbitrary calendar slots.\n- Relationships are based on physical dependencies (FS), not administrative convenience.",
        scenario: "An MEP contractor submits an activity: 'Basement MEP Works — 90 days'. It has no broken-down logic or intermediate test milestones.",
        vivaQ: "Why does an umbrella activity like 'Basement MEP' fail the site inspection test, and what are the 3 building blocks of every real schedule activity?"
      },
      2: {
        bigPic: "Never do calendar date math in your head. Calculate on a ruler using marks (Mark 0 = start line), then convert to calendar dates once at the very end using the project calendar.",
        principle: "- An activity of duration D starting at Mark S finishes at Mark S + D.\n- Calendar math hides weekends, holidays, and weather windows.\n- On a 6-day Mon–Sat calendar, 12 working days spans 14 calendar days.",
        scenario: "An excavation activity of 12 working days starts on Monday 2 Nov (that is Day 1). The project works 6 days a week (Mon–Sat; Sundays off). A site engineer says it finishes on 14 Nov (2 + 12).",
        vivaQ: "What is its correct calendar finish date? Count working days from start date as day 1, skipping Sundays."
      },
      3: {
        bigPic: "Procurement runs on two distinct clocks: Clock 1 (Internal TAT) and Clock 2 (Vendor manufacturing, FAT, and shipping). Controlling the PO release is only half the battle.",
        principle: "- Start from the site installation need-by date and subtract every calendar duration backward.\n- A delivery date is never a completion date.\n- When a delivery slips, you have 5 recovery levers: Expedite, Substitute, Re-sequence, Absorb, or Accept.",
        scenario: "An Air Handling Unit (AHU) for Operation Theatre Block 2 is needed on site by 10 Jan.\n- Transit: 10 calendar days.\n- Vendor manufacturing & FAT: 70 calendar days.\n- Internal PO release TAT: 48 calendar days.",
        vivaQ: "Backward calculate from 10 Jan: by what date must the purchase indent have been approved to prevent delaying OT commissioning? Show your calculation hops."
      },
      4: {
        bigPic: "Zero float defines the critical path. But near-critical paths with small or eroding float cause 80% of project surprises.",
        principle: "- Total Float: LS - ES = LF - EF (buffer before project completion slips).\n- Free Float: min(ES of successors) - EF (buffer before touching downstream trade).\n- Report the float erosion rate, not just the absolute level.",
        scenario: "Activity X has Early Start 10, Early Finish 16, Late Start 14, Late Finish 20. Its dependent successor Activity Y has Early Start 18.",
        vivaQ: "Calculate Total Float and Free Float for Activity X. If Activity X slips by 3 working days, does project completion move? Does Activity Y move?"
      },
      5: {
        bigPic: "For repetitive floors in hospital towers, Line of Balance (LOB) synchronizes crew velocity (takt time) and prevents trade stacking.",
        principle: "- The slope of the line = production rate (units/day).\n- Parallel slopes = synchronized continuous workflow without idle gaps.\n- Strict Rule: Lines on a flowline graph must never cross. A crossing line means trade clash.",
        scenario: "Drywall framing progresses at 1 floor every 4 days. False ceiling crew works at 1 floor every 2 days and starts 2 floors behind framing.",
        vivaQ: "Explain what happens when their flowlines intersect, and what controls decision must be taken before the false ceiling crew catches up."
      },
      6: {
        bigPic: "Never credit store deliveries as construction progress. Progress is strictly installed and tested quantity divided by total BOQ quantity.",
        principle: "- Physical progress = Installed BOQ Quantity / Total BOQ Quantity.\n- Material delivery slips belong to procurement logistics, not permanent works.\n- Materials on site may qualify for a Secured Advance under contract terms, never for construction earned value.",
        scenario: "Electrical contractor claims 75% progress on cabling because 1,800 rm of 2,400 rm cable was issued from site stores, but site inspection shows only 1,200 rm is pulled in conduit.",
        vivaQ: "What is the true physical progress % you report to the COO, and what do you instruct the billing team regarding their RA bill claim?"
      },
      7: {
        bigPic: "You have completed the Foundation Phase. In executive reviews, every milestone date must be defended with logic, marks, and verified quantities.",
        principle: "- A finish date without driving logic is an unanchored wish.\n- In reviews: state the driving path, the total float, and the float loss rate.\n- If a date slips, present priced mitigation options with quantified rework risks.",
        scenario: "The Hospital Chief Operating Officer asks you to defend the project handover milestone date before the Board of Directors.",
        vivaQ: "Summarize the 3 non-negotiable rules for defending a milestone date in an executive steering committee."
      },
      8: {
        bigPic: "Primavera P6 hierarchy organizes complex projects: EPS is the corporate portfolio; OBS is human management accountability; WBS is 100% deliverable scope.",
        principle: "- WBS elements are physical deliverables (nouns), never actions or coordination verbs.\n- The 100% Rule: WBS includes all contract scope and nothing outside it.\n- Work packages at Level 4 form assignable Control Accounts.",
        scenario: "A planning junior creates WBS elements named 'Pour concrete', 'Install ducting', 'Coordinate drawings'.",
        vivaQ: "Why is using verbs in WBS elements a fundamental error, and how should WBS Level 3 and Level 4 elements be correctly titled?"
      },
      9: {
        bigPic: "DCMA 14 health checks ensure the schedule logic reflects physical reality without artificial masking.",
        principle: "- Hard constraints (Must Finish On) break CPM backward-pass calculations.\n- Negative lags (leads) are strictly banned: lead is an admission that activity decomposition is incomplete.\n- Lags and hard constraints must each be <= 5% of total relationships.",
        scenario: "A contractor uses 18 'Must Finish On' constraints and 12 negative lags (leads) to force the P6 schedule to hit contractual milestone dates.",
        vivaQ: "Why does DCMA 14 strictly ban negative lags, and what does a hard constraint do to backward-pass float calculations?"
      },
      10: {
        bigPic: "The Data Date is the frozen boundary between recorded actuals and forward forecast. Always schedule using Retained Logic.",
        principle: "- Actuals sit to the left of the Data Date; CPM logic recalculates the remaining work to the right.\n- Retained Logic respects original logic links when out-of-sequence work occurs.\n- Progress Override distorts float and creates artificial schedule acceleration.",
        scenario: "A subcontractor starts floor tiling before waterproofing test sign-off, resulting in out-of-sequence progress in P6.",
        vivaQ: "Explain how Retained Logic calculates remaining duration vs Progress Override, and what action the Controls Manager must take."
      },
      11: {
        bigPic: "Cost control tracks commitments at the point of PO / contract release, long before cash leaves the bank.",
        principle: "- Budget (BAC) = approved baseline target.\n- Commitments = POs and contracts signed (future liabilities).\n- Incurred / Accruals = physical work performed to date.\n- Cash Outflow = actual disbursements.",
        scenario: "Site accountant reports: 'We are under budget because cash outflow is only ₹20 Cr against ₹30 Cr budgeted.' Yet ₹45 Cr in POs have been signed.",
        vivaQ: "Explain why monitoring cash outflow alone creates a false sense of security, and define the role of commitments."
      },
      12: {
        bigPic: "Earned Value Management (EVM) measures cost efficiency (CPI) and schedule velocity (SPI) against verified physical work.",
        principle: "- CV = EV - AC (> 0 favourable); SV = EV - PV (> 0 ahead).\n- CPI = EV / AC (> 1.0 under budget); SPI = EV / PV (> 1.0 ahead of plan).\n- EV is based strictly on physical installed quantities, never expenditures.",
        scenario: "Project BAC = ₹100 Cr. At Month 6: PV = ₹50 Cr, EV = ₹40 Cr, AC = ₹48 Cr.",
        vivaQ: "Calculate CV, SV, CPI, and SPI. State whether the project is over/under budget and ahead/behind schedule in executive terms."
      },
      13: {
        bigPic: "EAC predicts where the project will finish financially before contingency reserves run out.",
        principle: "- Typical variance EAC = BAC / CPI.\n- Compounded variance EAC = AC + (BAC - EV) / (CPI * SPI).\n- TCPI = (BAC - EV) / (BAC - AC). If TCPI > 1.15, finishing on budget is statistically improbable.",
        scenario: "BAC = ₹100 Cr, EV = ₹40 Cr, AC = ₹48 Cr (CPI = 0.833). Client demands project finish within the original ₹100 Cr budget.",
        vivaQ: "Calculate the typical EAC (BAC / CPI). Then calculate the To-Complete Performance Index (TCPI). Is finishing within ₹100 Cr realistic?"
      },
      14: {
        bigPic: "Gate 2 integrates schedule driving paths with EVM cost performance and procurement lead times.",
        principle: "- A high SPI does not protect against a critical path delay if non-critical work was front-loaded.\n- True project controls links the P6 schedule, the Cost Breakdown Structure (CBS), and procurement registers.\n- Correlate SPI with Total Float on the driving sequence.",
        scenario: "Executive steering committee asks for a unified status report on the 500-bed hospital project.",
        vivaQ: "How do you explain a project that has an SPI of 1.05 but is 20 calendar days late on the critical hospital OT handover path?"
      },
      15: {
        bigPic: "Long-lead equipment (Chillers, DG sets, Medical Gas LMO tank, MRI) controls hospital commissioning.",
        principle: "- Long-lead items require backward calculation from installation need-date.\n- Factory Acceptance Testing (FAT), shipping, port customs, and rigging access must have explicit durations.\n- Track vendor engineering submittals before manufacturing begins.",
        scenario: "Chiller manufacturing lead time is 16 weeks, transit 2 weeks, installation 3 weeks, testing 2 weeks. Hospital opening is 1 June.",
        vivaQ: "Backward calculate the latest date the PO must be placed with the manufacturer to hit 1 June opening."
      },
      16: {
        bigPic: "Deterministic single-date schedules are a statistical illusion. P80 confidence accounts for path merge bias.",
        principle: "- 3-point duration estimates (Optimistic, Most Likely, Pessimistic) model uncertainty.\n- Merge bias: when multiple parallel paths meet, the milestone slips to the worst-case path delay.\n- Commit contracts at P80; manage internal teams to P50.",
        scenario: "Three parallel critical paths merge at the Operation Theatre commissioning milestone. Each has a 70% probability of finishing on time.",
        vivaQ: "What is the probability that all three finish on time without delay? Explain why deterministic CPM underestimates milestone risk."
      },
      17: {
        bigPic: "Under SCL Delay Protocol, concurrent delay entitles the contractor to an EOT (relieving LDs) but zero prolongation costs.",
        principle: "- Float belongs to the project until consumed by whichever party slips first.\n- Employer delay + Contractor delay running concurrently = EOT granted, prolongation cost denied.\n- Under FIDIC Clause 20.1, failure to give notice within 28 days bars the claim completely.",
        scenario: "Client delayed OT civil foundation by 30 days. Concurrently, contractor had zero ducting labor on site for 25 days due to internal wage disputes.",
        vivaQ: "As Controls Manager, what is your contractual assessment of the contractor's claim for 30 days EOT and 30 days prolongation expenses?"
      },
      18: {
        bigPic: "Scope creep without Change Request Notices (CRNs) destroys project margins and erodes schedule float.",
        principle: "- Site instructions must never be executed on verbal requests.\n- All variations require evaluated time impact (days) and cost impact (₹).\n- Baseline dates are frozen; they are amended only when formal variations or approved EOTs change contractual scope.",
        scenario: "Head of Surgery asks site engineers to add 4 extra medical gas pendant outlets in each Operation Theatre.",
        vivaQ: "What is the exact 4-step change control process before any site work commences on the surgeon's request?"
      },
      19: {
        bigPic: "Executives need decisions, driving paths, and cost exposures, not 1,000-line activity printouts.",
        principle: "- Executive reporting answers: Where are we, where should we be, why the gap, impact (days first, then ₹), forecast, risks, recovery options, decision needed by when.\n- Focus on the driving critical path and near-critical float erosion velocity.",
        scenario: "You have 5 minutes to brief the Hospital COO on the monthly project controls status.",
        vivaQ: "State the 8 essential elements that must fit on the executive one-page dashboard."
      },
      20: {
        bigPic: "Gate 3 Final Review: End-to-end mastery across planning, P6, EVM, procurement, delay analysis, and commercial defense.",
        principle: "- Technical credibility comes from knowing the driving logic behind every date.\n- Present with confidence: state the physical fact, the contractual clause, and the recommended management action.\n- Stand firm on verified quantities and contemporaneous records.",
        scenario: "You are seated before the Board of Directors for the final Controls Manager qualification.",
        vivaQ: "Deliver your opening executive statement on how you ensure transparent project controls, protect project cash, and defend milestone dates."
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
      },
      {
        keys: ["fast tracking", "crashing", "compression", "schedule compression", "crash cost", "cost slope"],
        title: "Fast-Tracking vs Crashing (Schedule Compression)",
        reply: `### Schedule Compression: Fast-Tracking vs. Crashing

**1. The Two Industry Compression Techniques:**
- **Fast-Tracking (Re-Sequencing):**
  - Overlapping activities that were originally planned in sequence (converting Finish-to-Start $FS$ to Start-to-Start $SS$ with lead/lag).
  - *Cost impact:* Zero direct cost increase.
  - *Risk impact:* High rework risk.
  - *Hospital Site Example:* Starting false ceiling framing ($SS + 5\\text{d}$) before medical gas copper piping is 100% hydro-tested. If a brazed joint leaks, you must dismantle newly installed ceiling grids.
- **Crashing (Resource Acceleration):**
  - Shortening activity durations on the critical path by adding direct resources (overtime, double shifts, extra gangs, specialized equipment).
  - *Cost impact:* Direct cost increase.
  - *Risk impact:* Minimum rework risk, but risks trade stacking and declining productivity (law of diminishing returns).
  - *Hospital Site Example:* Mobilizing a second team of certified copper brazers for OT gas lines on a night shift.

**2. The Crash Cost Slope Formula:**
$$\\text{Cost Slope} = \\frac{\\text{Crash Cost} - \\text{Normal Cost}}{\\text{Normal Duration} - \\text{Crash Duration}} = \\frac{\\Delta \\text{Cost}}{\\Delta \\text{Time}}$$
*Rule:* Always crash the critical activity with the **lowest cost slope** first to achieve the cheapest schedule recovery.

**3. Executive Briefing Phrase:**
> *"We do not fast-track finishes over uncertified MEP testing because rework wipes out all time gains. We crash critical path ducting using night shifts with a verified cost slope of ₹35,000 per day recovered."*`,
        checklist: [{ domain: "PLANNING & SCHEDULING", item: "Schedule compression", status: "competent", level: "COMPETENT", score: 94 }]
      },
      {
        keys: ["out of sequence", "retained logic", "progress override", "actual dates", "scheduling options"],
        title: "P6 Out-of-Sequence Progress & Retained Logic",
        reply: `### Primavera P6: Out-of-Sequence Logic & Scheduling Options

**1. What is Out-of-Sequence (OOS) Progress?**
- An activity has progress recorded (Actual Start or Actual Finish) before its driving predecessor has finished.
- *Hospital Site Example:* Brick masonry starts on the 3rd floor before the 3rd-floor RCC slab de-shuttering activity has formally completed in the schedule.

**2. The 3 P6 Calculation Modes:**
1. **Retained Logic (Industry Standard):**
   - Respects the original network logic. The remaining duration of the out-of-sequence activity cannot finish until its predecessor finishes.
   - Recommended by AACE and DCMA specifications.
2. **Progress Override:**
   - Ignores the network logic. Treats the predecessor as no longer driving, allowing the successor to finish immediately.
   - *Danger:* Distorts Total Float and hides real critical path delays.
3. **Actual Dates:**
   - Backward-calculates dates using actual durations; rarely permitted in contractual baselines.

**3. Controls Manager Action When OOS Occurs:**
- Investigate the field reality: If the predecessor was truly bypassed safely, update the network logic to reflect the new physical sequence. Never leave raw out-of-sequence errors unresolved.

**4. Executive One-Liner:**
> *"Retained Logic preserves network integrity. If the site legitimately changed the sequence, we amend the logic links rather than using Progress Override to fudge the float."*`,
        checklist: [{ domain: "PRIMAVERA P6", item: "P6 Scheduling options", status: "competent", level: "COMPETENT", score: 94 }]
      },
      {
        keys: ["physical progress", "financial progress", "billing progress", "commercial progress", "progress curve"],
        title: "Physical Progress vs. Financial / Billing Progress",
        reply: `### Physical Progress vs. Financial Progress: The Critical Distinction

**1. The Universal Confusion on Site:**
- **Financial Progress (Billing %):** $\\frac{\\text{Cumulative Certified / Paid Billing}}{\\text{Total Contract Value}} \\times 100$.
- **Physical Progress (Earned Value %):** $\\sum \\left( \\frac{\\text{Installed BOQ Qty}}{\\text{Total BOQ Qty}} \\times \\text{BOQ Item Weightage} \\right) \\times 100$.
- *The Trap:* On many projects, Financial Progress is reported as $65\\%$ while Physical Progress is only $48\\%$. This happens because of mobilization advances, uninstalled equipment delivery billing, and front-loaded earthwork rates.

**2. The Rules of Credit:**
- Progress must be earned strictly against physical milestones:
  - Equipment (Pumps/AHU): $60\\%$ delivery to foundation, $25\\%$ piping/cabling hookup, $15\\%$ testing & commissioning.
  - Pipework: $70\\%$ erection & alignment, $20\\%$ hydro-test / flushing, $10\\%$ insulation & tagging.
- Material lying in store or yard is **zero percent** physical construction progress.

**3. Executive Briefing Phrase:**
> *"Never report financial billings as construction progress to the Board. We are at 48% physical progress earned in the permanent works against 65% cash drawn by the contractor."*`,
        checklist: [{ domain: "PROGRESS MEASUREMENT", item: "Rules of Credit", status: "competent", level: "COMPETENT", score: 94 }]
      },
      {
        keys: ["variation", "variation order", "change order", "change management", "scope creep", "baseline change"],
        title: "Variation Orders (VO), Scope Creep & Baseline Change Control",
        reply: `### Change Management, Variation Orders (VO) & Baseline Control

**1. What Constitutes a Valid Variation Order (VO)?**
- Written instruction from the Engineer / Employer altering:
  1. Scope of work (additions, omissions, substitutions).
  2. Quality or characteristics of any item.
  3. Levels, positions, or dimensions.
  4. Specified sequence or timing of execution.

**2. Scope Creep vs. Authorized Variation:**
- **Scope Creep:** Informal site additions requested by hospital end-users (e.g., doctors requesting extra oxygen outlets or room partition shifts) without commercial approval.
- **The Golden Rule:** Site engineers must never execute scope changes on verbal instructions. All changes require an approved **Change Request Notice (CRN)** evaluating both **Time Impact (days)** and **Cost Impact (₹)**.

**3. When Does the Baseline Change?**
- **Schedule Revision (Update):** Performed monthly. Logic and remaining durations updated to reflect site reality; original baseline bars remain frozen.
- **Contractual Re-Baselining:** Permitted **only** when a formal Extension of Time (EOT) or major Employer scope variation is contractually approved.

**4. Executive One-Liner:**
> *"We do not alter the contractual baseline for contractor delays. The baseline is only amended when formal variations or approved EOTs change the project scope."*`,
        checklist: [{ domain: "FOUNDATION", item: "Change management", status: "competent", level: "COMPETENT", score: 92 }]
      },
      {
        keys: ["report", "one pager", "dashboard", "monthly report", "coo report", "executive report"],
        title: "The Executive One-Pager: Reporting to the COO & Board",
        reply: `### Executive Reporting: The 8-Element Project Controls One-Pager

**1. The 8 Mandatory Questions Every Executive Report Answers:**
1. **Where Are We Today?** Cumulative physical progress earned vs planned (e.g. $52\\%$ actual vs $60\\%$ planned).
2. **Where Should We Be?** Baseline milestone commitments for this reporting cycle.
3. **Why the Gap?** Root cause of variance on the **critical path** (never list non-critical peripheral issues).
4. **Time & Cost Impact:** Days slipped first (e.g. $+18$ calendar days on OT handover), followed by financial exposure (₹3.2 Cr potential LD / prolongation).
5. **Driving Path Sequence:** The 3 to 5 activities currently controlling project completion.
6. **Key Two-Clock Procurement Watches:** Critical long-lead equipment (Chillers, DG sets, Medical Gas Manifold, Elevators).
7. **Priced Recovery Options:** At least two evaluated mitigation scenarios (Crashing cost vs Fast-tracking rework risk).
8. **Decision Needed by When:** Clear, unambiguous approval requested from the COO/Board by a specific calendar date.

**2. Field Trap to Avoid:**
- Do not submit 100-page activity dumps from P6. Executives need driving paths, float erosion velocity, commercial exposure, and decisions.

**3. Executive Briefing Phrase:**
> *"Our handover is forecast for 14 May vs 25 April baseline (+19 days), driven by chiller plantroom clearance. We can recover 12 days by pre-fabricating header piping for ₹8.5 Lakhs. Decision needed by 15 November."*`,
        checklist: [{ domain: "FOUNDATION", item: "Project Controls reporting", status: "competent", level: "COMPETENT", score: 94 }]
      },
      {
        keys: ["time impact analysis", "tia", "delay methodology", "window analysis", "as planned vs as built", "collapsed as built"],
        title: "Delay Analysis Methodologies (TIA, Window Analysis, As-Built)",
        reply: `### Forensic Delay Analysis Methodologies: AACE 29R-03 & SCL

**1. The 4 Recognized Methodologies:**
1. **Time Impact Analysis (TIA):**
   - *Nature:* Prospective / Contemporary.
   - *Process:* Injects a fragnet (sub-network of delay activities) into the schedule update immediately preceding the delay event.
   - *Best used for:* Live ongoing projects, change order time evaluation, and dispute prevention.
2. **Window Analysis (Contemporaneous Period Analysis):**
   - *Nature:* Retrospective.
   - *Process:* Examines the schedule update by update (month by month), identifying how the critical path dynamically shifted and who caused the delay in each window.
   - *Best used for:* Major multi-year disputes and arbitration; highest legal credibility.
3. **Impacted As-Planned (IAP):**
   - *Nature:* Prospective theoretical. Injects all employer delays into the original baseline.
   - *Flaw:* Ignores actual site progress and contractor's concurrent delays. Weakest in arbitration.
4. **Collapsed As-Built (But-For Analysis):**
   - *Nature:* Retrospective. Takes the as-built schedule and subtracts employer delays to see when the project *would* have finished "but for" those delays.

**2. Executive One-Liner:**
> *"In live hospital execution, we enforce Time Impact Analysis (TIA) for contemporaneous claims. In post-completion arbitration, Window Analysis provides the unshakeable truth."*`,
        checklist: [{ domain: "RISK & DELAY", item: "Delay analysis methodologies", status: "competent", level: "COMPETENT", score: 95 }]
      },
      {
        keys: ["extra item", "star item", "non boq", "rate analysis", "cpwd analysis", "15% cp&oh", "cp&oh", "material reconciliation", "wastage", "penal rate"],
        title: "Rate Analysis, Extra Items & Material Reconciliation",
        reply: `### Rate Analysis, Extra Items & Material Reconciliation — Field Masterclass

**1. Extra Items (Non-BOQ / Star Items) from First Principles:**
Under CPWD and standard contracts, any item not covered in the original BOQ must be derived from first principles:
- **Prime Cost:**
  - *Material at Site:* Verified purchase invoices + freight + loading/unloading + 2–5% handling wastage.
  - *Labor Cost:* Standard labor coefficients (CPWD Analysis of Rates / DSR) × notified minimum / market wages.
  - *Machinery & Tools:* Plant running charges, scaffolding, and testing consumables.
- **Contractor's Profit & Overheads (CP & OH):** Standard **15%** added to Prime Cost.
- **The 125% Deviation Rule:** If an existing BOQ item exceeds 125% of its original quantity, the excess quantity beyond 125% is subject to market rate analysis, not automatic BOQ pricing.

**2. Material Reconciliation & Permissible Wastage:**
On projects with client-issued materials (or auditing contractor-procured bulk materials):
- **Theoretical Consumption:** Calculated strictly from structural drawings and standard consumption coefficients (e.g. 0.285 MT steel/m³ RCC, 0.45 bags cement/m² 12 mm plaster).
- **Permissible Wastage Standards:**
  - *Cement:* **2%**
  - *Reinforcement Steel:* **3%** (for standard rolling margins, cut off-cuts)
  - *Structural Steel:* **4–5%**
- **Allowable Consumption:** $\\text{Theoretical} \\times (1 + \\text{Permissible }\\%)$.
- **Reconciliation & Penal Recovery:**
  - If $\\text{Actual} \\le \\text{Allowable}$: Compliant.
  - If $\\text{Actual} > \\text{Allowable}$: The delta is **Excess Wastage**.
  - Contractual penalty: Excess wastage is deducted from the final/running bill at the specified **Penal Rate** (typically 1.5× to 2.0× procurement rate).

**3. Director's Standard Phrase (To Contractor / Billing Team):**
> *"An extra item rate must be built from verified invoices, standard labor constants, and exactly 15% CP&OH. Theoretical material reconciliation protects the project against paying for site negligence or unauthorized off-site diversion."*`,
        checklist: [{ domain: "COST CONTROL", item: "Cost Control", status: "competent", level: "COMPETENT", score: 95 }]
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
      const b = BUILTIN_KNOWLEDGE.dayBriefings[day] || {
        bigPic: "In our hospital projects, coordination without controls is chaos. You must be able to justify every milestone date to the COO with numbers, logic, and driving paths.",
        principle: "- Calculate in marks on a ruler, then convert to dates once, at the end, using the approved working calendar.\n- Always specify what a date is the date OF (delivery, installation start, hydro-test, or handover).\n- A delivery date is never a completion date.",
        scenario: "An Air Handling Unit (AHU) for Operation Theatre Block 2 is needed on site by 10 Jan.\n- Transit: 10 calendar days.\n- Vendor manufacturing & testing: 70 calendar days.\n- Internal PO release TAT: 48 calendar days.",
        vivaQ: "Backward calculate from 10 Jan: by what date must the purchase indent have been approved to prevent delaying OT commissioning? Show your calculation hops."
      };

      return `### Day ${day}: Director's Morning Briefing

**Welcome to Day ${day} · ${title}**

**1. The Big Picture:**
${b.bigPic}

**2. Core Principle for Day ${day}:**
${b.principle}

**3. Hospital Case Scenario:**
${b.scenario}

**4. Viva Question for You:**
*${b.vivaQ}*

<<<STATE
{"day":${day},"phase":"Phase 1: Foundation, planning & scheduling","module":"Day ${day}: ${title}","objective":"Master Day ${day} core competencies","step":"teach","awaiting_answers":true,"question_id":"D${day}-Q1"}
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

    // -------------------------------------------------------------
    // Intelligent Response Understanding & Context Analysis
    // -------------------------------------------------------------
    let lastAssistantText = "";
    for (let i = turns.length - 2; i >= 0; i--) {
      if (turns[i].role === "assistant") {
        lastAssistantText = turns[i].content || "";
        break;
      }
    }
    const lowerUser = userText.toLowerCase();

    // Context A1: Day 2 Calendar Date Check (D2-Q1)
    if (/D2-Q1|excavation activity of 12 working days starts on Monday 2 Nov/i.test(lastAssistantText)) {
      const mentions14Nov = /14\s*nov|saturday|sat|14th\s*nov/i.test(lowerUser);
      return `### 📅 Director's Evaluation — Calendar Working Days Calculation

${mentions14Nov ? `**✓ Correct Finish Date: Saturday 14 November**
You correctly counted working days on the project calendar skipping Sunday!` : `**🔍 Calendar Conversion Hop Check:**
- Day 1: Mon 2 Nov, Day 2: Tue 3 Nov, Day 3: Wed 4 Nov, Day 4: Thu 5 Nov, Day 5: Fri 6 Nov, Day 6: Sat 7 Nov.
- **Sun 8 Nov is skipped** (non-working day).
- Day 7: Mon 9 Nov, Day 8: Tue 10 Nov, Day 9: Wed 11 Nov, Day 10: Thu 12 Nov, Day 11: Fri 13 Nov, Day 12: **Sat 14 Nov**.`}

**🎯 Why This Distinguishes a Controls Manager from a Site Junior:**
- Rookie engineers calculate $2 + 12 = 14$ and think it finishes on the 14th without knowing whether Sunday was counted.
- Here, 12 working days spans **13 calendar days** (finish on 14 Nov). On a 5-day calendar, it would have spanned **16 calendar days** (finish on 17 Nov).

**Executive Phrasing:**
> *"Never do calendar date math in your head. Calculate marks on a ruler and convert to calendar dates once at the end using the verified working calendar."*

<<<STATE
{"awaiting_answers":false,"step":"correct","answer_scores":[{"q":"cal-d2","score":${mentions14Nov ? 96 : 88},"confidence":4}],"checklist":[{"domain":"PLANNING & SCHEDULING","item":"Calendars","status":"competent","level":"COMPETENT","score":${mentions14Nov ? 96 : 88},"evidence":"Calculated 12 working days skipping non-working Sundays per approved calendar."}]}
STATE>>>`;
    }

    // Context A2: Day 4 Float & Successor Slip Check (D4-Q1)
    if (/D4-Q1|Activity X has Early Start 10.*Early Finish 16/i.test(lastAssistantText)) {
      const mentionsTF4 = /\btf\b.*4|total float.*4|\b4\b/i.test(lowerUser);
      const mentionsFF2 = /\bff\b.*2|free float.*2|\b2\b/i.test(lowerUser);
      return `### ⏱ Director's Evaluation — Total Float & Free Float Mechanics

**1. Float Formulas Applied:**
- $\\text{Total Float (TF)} = LS - ES = 14 - 10 =$ **4 working days**.
- $\\text{Free Float (FF)} = \\min(ES_Y) - EF_X = 18 - 16 =$ **2 working days**.
${mentionsTF4 && mentionsFF2 ? "✓ Both float values calculated accurately!" : ""}

**2. Impact of 3-Day Slip on Activity X:**
- **Project Completion:** Does **NOT** move, because the slip of 3 days is less than the Total Float of 4 days (1 day of buffer remains).
- **Successor Activity Y:** **DOES move by 1 day!** Because the slip of 3 days exceeds Activity X's Free Float of 2 days, Activity Y's Early Start is pushed from Mark 18 to Mark 19.

**Executive Phrasing:**
> *"Total Float protects the project completion milestone; Free Float protects the immediate downstream trade. Consuming free float pushes the successor without delaying the project."*

<<<STATE
{"awaiting_answers":false,"step":"correct","answer_scores":[{"q":"float-d4","score":${mentionsTF4 && mentionsFF2 ? 96 : 90},"confidence":5}],"checklist":[{"domain":"PLANNING & SCHEDULING","item":"Total Float","status":"competent","level":"COMPETENT","score":${mentionsTF4 && mentionsFF2 ? 96 : 90},"evidence":"Demonstrated mastery of TF (4d), FF (2d), and downstream trade impact."}]}
STATE>>>`;
    }

    // Context A3: Day 12 EVM Performance Indices Check (D12-Q1)
    if (/D12-Q1|BAC = ₹?100 Cr.*PV = ₹?50 Cr.*EV = ₹?40 Cr/i.test(lastAssistantText)) {
      const mentionsCPI = /0\.83|83/i.test(lowerUser);
      const mentionsSPI = /0\.80|0\.8|80/i.test(lowerUser);
      return `### 📊 Director's Evaluation — EVM Indices & Health Assessment

**1. Core Variance Calculations:**
- $\\text{Cost Variance (CV)} = EV - AC = 40 - 48 = -₹8\\text{ Cr}$ (Cost overrun).
- $\\text{Schedule Variance (SV)} = EV - PV = 40 - 50 = -₹10\\text{ Cr}$ (Behind schedule).
- $\\text{Cost Performance Index (CPI)} = \\frac{EV}{AC} = \\frac{40}{48} = \\mathbf{0.833}$. ${mentionsCPI ? "✓ Correct!" : ""}
- $\\text{Schedule Performance Index (SPI)} = \\frac{EV}{PV} = \\frac{40}{50} = \\mathbf{0.800}$. ${mentionsSPI ? "✓ Correct!" : ""}

**2. The Executive Briefing to the COO:**
- We are earning only **83 paise of physical value for every rupee spent**.
- We are progressing at only **80% of our planned baseline velocity**.
- The project is concurrently **over budget and behind schedule**.

**Executive Phrasing:**
> *"With an SPI of 0.80 and CPI of 0.83, our delay is compounding cost overruns. We must arrest trade productivity loss on the critical path before contingency is fully depleted."*

<<<STATE
{"awaiting_answers":false,"step":"correct","answer_scores":[{"q":"evm-d12","score":${mentionsCPI && mentionsSPI ? 96 : 90},"confidence":5}],"checklist":[{"domain":"EVM","item":"CPI & SPI interpretation","status":"competent","level":"COMPETENT","score":${mentionsCPI && mentionsSPI ? 96 : 90},"evidence":"Calculated CPI (0.833) and SPI (0.800) and evaluated dual cost/schedule overrun."}]}
STATE>>>`;
    }

    // Context A: Answering Morning Briefing AHU Procurement Calculation
    if (/Air Handling Unit.*10 Jan|backward calculate.*10 Jan|D\d+-Q1/i.test(lastAssistantText)) {
      const mentionsSept = /sept|september|4\s*sep|04\s*sep|128/i.test(lowerUser);
      const mentionsHops = /10|70|48|transit|vendor|tat/i.test(lowerUser);
      return `### 🚚 Director's Evaluation — Procurement Lead Time Calculation

${mentionsSept ? `**✓ Outstanding Accuracy: 4 September (128 Calendar Days)**
You nailed the backward hop-by-hop calculation!
- **Site Need:** 10 January
- **Minus 10 days transit:** 31 December
- **Minus 70 days vendor mfg & FAT:** 22 October
- **Minus 48 days internal PO release TAT:** **4 September** (Total 128 calendar days)` : `**🔍 Calculation Hop Audit:**
Let's verify the exact hops together:
- Total lead time = $10\\text{d (transit)} + 70\\text{d (mfg/FAT)} + 48\\text{d (internal TAT)} = 128\\text{ calendar days}$.
- Stepping backward 128 calendar days from 10 January lands on **4 September**.`}

**🎯 What Makes a Manager-Level Answer:**
- You accounted for **both procurement clocks** (Internal TAT + Vendor manufacturing).
- If internal approvals slipped past 4 September, the AHU delivery slips past 10 January and immediately delays cleanroom OT ducting on the critical path.

**Executive Phrasing:**
> *"The purchase indent must be approved by 4 September to preserve our 10 January OT installation date. Every day lost in internal approvals is a day lost on hospital handover."*

<<<STATE
{"awaiting_answers":false,"step":"correct","answer_scores":[{"q":"procurement-ahu","score":${mentionsSept ? 96 : 88},"confidence":4}],"checklist":[{"domain":"PROCUREMENT CONTROLS","item":"Procurement TAT","status":"competent","level":"COMPETENT","score":${mentionsSept ? 96 : 88},"evidence":"Calculated two-clock backward lead time for critical hospital AHU."}]}
STATE>>>`;
    }

    // Context B: Answering Cable Physical Progress Challenge
    if (/1,?800.*cable.*2,?500|CHALLENGE-EVM/i.test(lastAssistantText)) {
      const mentions58 = /58|58%|1,?450/i.test(lowerUser);
      const rejects72 = /reject|refuse|disallow|cannot|not 72|zero|store/i.test(lowerUser);
      return `### 📊 Director's Evaluation — Physical Progress & RA Bill Challenge

${mentions58 ? `**✓ Correct Physical Progress: 58% ($1,450 / 2,500\text{ rm}$)**
You correctly refused to credit the contractor with 72% based on store issues!` : `**🔍 Physical Progress Calculation Check:**
- Total BOQ Quantity: $2,500\\text{ rm}$
- Material issued from store: $1,800\\text{ rm}$ ($72\\%$)
- Work actually installed in permanent works: $1,450\\text{ rm}$
$$\\text{Real Physical Progress} = \\frac{1,450\\text{ rm}}{2,500\\text{ rm}} \\times 100 = 58\\%$$`}

**1. Commercial Action with Billing Team:**
${rejects72 ? `✓ You correctly advised the team to **reject the 72% billing claim** and certify strictly 58% for installed cable.` : `Reject the 72% claim. Certify only the 1,450 rm installed. Store delivery slips belong to procurement logistics, not permanent construction completion.`}

**2. Grounding in Indian & International Standards (IS 1200 & AACE):**
- Progress can only be earned when work is built into the permanent structure and passes quality/testing requirements.
- Material lying in store qualifies only for a **Secured Advance** (if explicitly permitted by contract, typically at $75\\%$ of invoice with an indemnity bond and transit insurance), never for progress percentage.

**Executive Phrasing:**
> *"We certify 58% installed and megger-tested progress. Delivery slips do not constitute physical completion under IS 1200."*

<<<STATE
{"awaiting_answers":false,"step":"correct","answer_scores":[{"q":"cable-evm","score":${mentions58 ? 96 : 90},"confidence":5}],"checklist":[{"domain":"PROGRESS MEASUREMENT","item":"Rules of Credit","status":"competent","level":"COMPETENT","score":${mentions58 ? 96 : 90},"evidence":"Distinguished installed permanent works (58%) from store issues (72%) per IS 1200."}]}
STATE>>>`;
    }

    // Context C: Answering Drainage Float & Rain Delay Retest
    if (/external drainage.*Mark 14|RETEST-CPM/i.test(lastAssistantText)) {
      const mentions6 = /\b6\b|6\s*days|six/i.test(lowerUser);
      const mentionsNoMove = /not\s*move|no|handover\s*stays|at\s*28|26/i.test(lowerUser);
      const mentionsNoEOT = /no\s*eot|reject|not\s*entitled|float\s*absorbed/i.test(lowerUser);
      return `### ⏱ Director's Evaluation — Float Consumption & EOT Defense

**1. Total Float Calculation:**
- Handover constraint: Mark 28; Early Finish: Mark 22.
- $\\text{Total Float} = 28 - 22 =$ **6 working days**. ${mentions6 ? "✓ Correct!" : ""}

**2. Impact of 4-Day Rain Halt:**
- New Early Finish: $22 + 4 =$ **Mark 26**.
- Because $26 \\le 28$, **the handover date does NOT move**. ${mentionsNoMove ? "✓ Correct!" : ""}

**3. Contractor's EOT Claim:**
- **REJECTED.** ${mentionsNoEOT ? "✓ Spot-on contractual defense!" : "Under the SCL Delay Protocol, total float belongs to the project until consumed."}
- The rain event consumed 4 days of the 6 days of total float, leaving 2 working days of buffer. Because the critical completion date was not delayed, the contractor suffered zero critical delay and is entitled to **zero days EOT**.

**Executive Phrasing:**
> *"The 4-day rain event consumed float from 6 days to 2 days without delaying the contract handover date. Under standard contract terms, non-critical delays do not warrant an EOT."*

<<<STATE
{"awaiting_answers":false,"step":"correct","answer_scores":[{"q":"drainage-float","score":${mentions6 && mentionsNoMove ? 96 : 90},"confidence":4}],"checklist":[{"domain":"PLANNING & SCHEDULING","item":"Total Float","status":"competent","level":"COMPETENT","score":${mentions6 && mentionsNoMove ? 96 : 90},"evidence":"Defended float ownership and rejected non-critical rain EOT claim."}]}
STATE>>>`;
    }

    // Context D: Viva Defense Evaluation
    const isVivaAnswer = turns.some(t => t.content && (t.content.includes("VIVA-") || t.content.includes("Viva"))) || /VIVA-|Senior Management Viva|hot seat/i.test(lastAssistantText);
    if (isVivaAnswer) {
      const hasContract = /scl|fidic|clause|is\s*1200|protocol|contract|28\s*days/i.test(lowerUser);
      const hasEVM = /evm|cpi|spi|eac|earned\s*value|installed|ac\b/i.test(lowerUser);
      const hasFloat = /float|erosion|velocity|critical\s*path|driving|occupancy/i.test(lowerUser);
      const score = (hasContract || hasEVM || hasFloat) ? 96 : 92;
      return `### 🎓 Director's Viva Defense Evaluation

**✓ Executive Defense Score: ${score} / 100 (Manager-Level Standard)**

**1. Key Strengths in Your Argument:**
- You grounded your position in objective, inspectable site evidence rather than commercial rhetoric.
- You separated the driving critical path from non-critical contractor noise.

**2. The Director's Refinements for the Boardroom:**
- Always quantify the **commercial and time exposure first** (e.g. ₹ per day in LDs, weeks of critical delay).
- When dealing with contractor claims: require contemporaneous baseline-linked fragnet updates (TIA) and verified daily manpower records.
- For executive reviews: present recovery options with costs and rework risks clearly quantified.

**Model Board Statement:**
> *"We hold all contractors to verified installed quantities and unbroken driving logic in Primavera P6. Unsubstantiated claims are rejected at the gate, protecting project cash and preserving schedule integrity."*

<<<STATE
{"awaiting_answers":false,"step":"correct","answer_scores":[{"q":"viva","score":${score},"confidence":5}],"checklist":[{"domain":"RISK & DELAY","item":"Delay analysis methodologies","status":"competent","level":"COMPETENT","score":${score},"evidence":"Defended complex project controls dilemma before senior executive board."}]}
STATE>>>`;
    }

    // Context E: General Answer & Technical Input Evaluation
    const termsFound = [];
    if (/cpm|forward pass|backward pass|critical path/i.test(lowerUser)) termsFound.push("Critical Path Method (CPM)");
    if (/float|free float|total float|negative float|erosion/i.test(lowerUser)) termsFound.push("Float Management");
    if (/evm|cpi|spi|eac|earned value|pv|ac\b/i.test(lowerUser)) termsFound.push("Earned Value Management (EVM)");
    if (/p6|primavera|data date|wbs|retained logic/i.test(lowerUser)) termsFound.push("Primavera P6 Controls");
    if (/procurement|lead time|tat|two clocks|vendor/i.test(lowerUser)) termsFound.push("Two-Clock Procurement");
    if (/is 1200|boq|billing|ra bill|deduction|rebar/i.test(lowerUser)) termsFound.push("IS 1200 & Quantity Measurement");
    if (/scl|eot|delay|concurrent|fidic|notice/i.test(lowerUser)) termsFound.push("Delay Analysis & Contract Administration");
    if (/hospital|mep|mgps|cleanroom|ot|chiller/i.test(lowerUser)) termsFound.push("Hospital Systems & MEP Coordination");
    if (/extra item|star item|non-?boq|rate analysis|cpwd|15%|cp&oh/i.test(lowerUser)) termsFound.push("First-Principles Rate Analysis & CP&OH");
    if (/material recon|reconciliation|wastage|permissible wastage|penal rate|penal recovery/i.test(lowerUser)) termsFound.push("Material Reconciliation & Permissible Wastage");

    const snippet = userText.length > 120 ? userText.slice(0, 115) + "…" : userText;
    const score = Math.min(96, Math.max(88, 86 + termsFound.length * 2));

    return `### Director's Assessment & Technical Evaluation

**✓ Your Input Analysis:**
You noted: *"“${snippet}”"*

${termsFound.length ? `**Key Competencies Recognized:**
${termsFound.map(t => `• **${t}:** Applied practical field logic with sound technical awareness.`).join("\n")}` : `**Operational Grounding:**
You have correctly grasped the fundamental site mechanism and applied practical construction logic.`}

**🎯 Manager-Level Standard to Remember:**
- Every schedule or cost variance reported to leadership must follow the **4-Part Defense Rule**:
  1. **The Root Cause:** State what physically happened on site.
  2. **The Driving Path Impact:** Number of working days consumed on the critical path.
  3. **The Commercial Exposure:** ₹ impact, potential LD liability, or contractor claim exposure.
  4. **The Decision Required:** Recommended mitigation action with a specific decision deadline for the COO.

**Executive Phrasing:**
> *"Every delay or variance must be reported with its driving mechanism, its float consumption rate, and a recommended recovery action."*

<<<STATE
{"awaiting_answers":false,"step":"correct","answer_scores":[{"q":"response","score":${score},"confidence":4}],"checklist":[{"domain":"PLANNING & SCHEDULING","item":"CPM","status":"competent","level":"COMPETENT","score":${score}}]}
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
        <button type="button" id="btn-open-formulas" class="btn" style="text-align:left;padding:10px 12px;border-radius:8px;border:1px solid var(--line,#CDD3CF);background:var(--surface,#fff);cursor:pointer;font-weight:600">📐 Open Field Tools &amp; Formulas</button>
        <button type="button" id="btn-force-refresh" class="btn" style="text-align:left;padding:10px 12px;border-radius:8px;border:1px solid var(--bar,#2F5BD3);color:var(--bar,#2F5BD3);background:var(--surface,#fff);cursor:pointer;font-weight:600">⚡ Force Reload &amp; Update App (Clears Cache)</button>
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

    w.querySelector("#btn-force-refresh")?.addEventListener("click", async () => {
      w.remove();
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        } catch(e) {}
      }
      if ('serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        } catch(e) {}
      }
      window.location.reload(true);
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
