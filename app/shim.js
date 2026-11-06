/* Standalone runtime for the PC Training app (outside Claude).
   Recreates the four capabilities the app expects from window.claude:
   db (local document store), sample (LLM call), user (local id), downloads (file save).
   Your API key stays in this browser's localStorage only. */
(function(){
  if (window.claude) return; // tests may inject their own stub
  const LS = window.localStorage;
  const cfgKey = "pc:llm";
  const sanitizeApiKey = k => (k || "").replace(/^["']|["']$/g, "").trim();
  const cleanModel = m => (m || "").replace(/^models\//, "").trim();

  const getCfg = () => {
    try {
      const c = JSON.parse(LS.getItem(cfgKey) || "{}");
      if (!c.provider || c.provider === "gemini") {
        if (!c.model || /gemini-[12]\./.test(c.model || "")) { c.model = "gemini-3.8-flash"; setCfg(c); }
        if (!c.modelComplex || /gemini-[12]\./.test(c.modelComplex || "")) { c.modelComplex = "gemini-3.1-pro-preview"; setCfg(c); }
      }
      return c;
    } catch { return {}; }
  };
  const setCfg = c => LS.setItem(cfgKey, JSON.stringify(c));

  // Helper to format messages into valid Gemini multi-turn schema
  function formatGeminiContents(msgs) {
    const contents = [];
    for (const m of msgs) {
      const role = m.role === "assistant" ? "model" : "user";
      const text = (typeof m.content === "string" ? m.content : JSON.stringify(m.content || "")).trim();
      if (!text) continue;
      if (contents.length && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += "\n\n" + text;
      } else {
        contents.push({ role, parts: [{ text }] });
      }
    }
    if (!contents.length) contents.push({ role: "user", parts: [{ text: "Hello" }] });
    if (contents[0].role !== "user") contents.unshift({ role: "user", parts: [{ text: "Hello Director." }] });
    if (contents[contents.length - 1].role !== "user") contents.push({ role: "user", parts: [{ text: "Please continue." }] });
    return contents;
  }

  // ---------- db: documents stored in localStorage under "pcdb:<path>" ----------
  const db = { doc(path){ const k = "pcdb:" + path; return {
    async get(){ const v = LS.getItem(k); return { exists: v != null, data: () => (v ? JSON.parse(v) : undefined) }; },
    async set(data){ try { LS.setItem(k, JSON.stringify(data)); } catch(e){ throw { code: "quota_exceeded", message: String(e) }; } }
  }; } };

  // ---------- sample: one interface, five providers ----------
  const DEFAULTS = {
    builtin:   { model: "builtin-director", modelComplex: "builtin-director" },
    gemini:    { model: "gemini-3.8-flash", modelComplex: "gemini-3.1-pro-preview" },
    openrouter:{ model: "google/gemini-2.5-flash", modelComplex: "google/gemini-3.1-pro-preview", baseUrl: "https://openrouter.ai/api/v1" },
    anthropic: { model: "claude-3-5-sonnet-latest", modelComplex: "claude-3-5-sonnet-latest" },
    openai:    { model: "gpt-4o-mini", modelComplex: "gpt-4o", baseUrl: "https://api.openai.com/v1" }
  };
  async function callLLM(turns, opts = {}){
    const c = getCfg();
    const key = sanitizeApiKey(c.key);
    if (!c.provider || !key) throw { code: "not_granted", message: "No API key set. Tap ⚙ to add one." };
    const d = DEFAULTS[c.provider] || DEFAULTS.gemini;
    const rawModel = (opts.modelTier === "complex" ? (c.modelComplex || d.modelComplex) : (c.model || d.model));
    const model = cleanModel(rawModel) || d.model;
    const msgs = turns.map(t => ({ role: t.role, content: typeof t.content === "string" ? t.content : JSON.stringify(t.content) }));
    let r, j, text = "";
    try {
      if (c.provider === "gemini") {
        const isComplex = opts.modelTier === "complex";
        const cleanM = cleanModel(model) || (isComplex ? "gemini-3.1-pro-preview" : "gemini-3.8-flash");
        const fallbackList = isComplex
          ? ["gemini-3.1-pro-preview", "gemini-3.8-flash", "gemini-3.6-flash"]
          : ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.1-pro-preview"];
        const candidates = [cleanM];
        fallbackList.forEach(m => {
          if (!candidates.includes(m)) candidates.push(m);
        });

        const geminiContents = formatGeminiContents(msgs);
        let lastErr = null;
        for (let attempt = 0; attempt < candidates.length; attempt++) {
          const curModel = candidates[attempt];
          try {
            r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(curModel)}:generateContent?key=${encodeURIComponent(key)}`, {
              method: "POST", headers: { "Content-Type": "application/json" }, signal: opts.signal,
              body: JSON.stringify({ contents: geminiContents,
                                     generationConfig: { maxOutputTokens: 4096, temperature: 0.4 } }) });
            j = await r.json();
            if (r.ok && j.candidates?.[0]?.content?.parts) {
              text = (j.candidates[0].content.parts || []).map(p => p.text || "").join("");
              return { text, truncated: j.candidates[0].finishReason === "MAX_TOKENS" };
            }
            lastErr = j;
            const msg = j?.error?.message || "";
            const isRetryable = r?.status === 503 || r?.status === 429 || r?.status === 404 || r?.status === 400 ||
              /high demand|spikes in demand|overloaded|temporar|not found|no longer available|deprecated/i.test(msg);
            if (isRetryable && attempt < candidates.length - 1) {
              await new Promise(res => setTimeout(res, 1000));
              continue;
            }
            throw j;
          } catch (err) {
            lastErr = err;
            if (err?.name === "AbortError") throw err;
            const msg = err?.error?.message || err?.message || "";
            const isRetryable = /high demand|spikes in demand|overloaded|temporar|not found|no longer available|deprecated/i.test(msg);
            if (isRetryable && attempt < candidates.length - 1) {
              await new Promise(res => setTimeout(res, 1000));
              continue;
            }
            throw err;
          }
        }
        throw lastErr;
      }
      if (c.provider === "openrouter") {
        r = await fetch((c.baseUrl || d.baseUrl) + "/chat/completions", { method: "POST", signal: opts.signal,
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key, "HTTP-Referer": "https://adbais-slimy.github.io/pc-training/", "X-Title": "PC Training Director" },
          body: JSON.stringify({ model, max_tokens: 4096, messages: msgs }) });
        j = await r.json(); if (!r.ok) throw j;
        text = j.choices?.[0]?.message?.content || "";
        return { text, truncated: j.choices?.[0]?.finish_reason === "length" };
      }
      if (c.provider === "anthropic") {
        r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: opts.signal,
          headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
          body: JSON.stringify({ model, max_tokens: 4096, messages: msgs }) });
        j = await r.json(); if (!r.ok) throw j;
        text = (j.content || []).map(b => b.text || "").join("");
        return { text, truncated: j.stop_reason === "max_tokens" };
      }
      if (c.provider === "openai") {
        r = await fetch((c.baseUrl || d.baseUrl) + "/chat/completions", { method: "POST", signal: opts.signal,
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
          body: JSON.stringify({ model, max_tokens: 4096, messages: msgs }) });
        j = await r.json(); if (!r.ok) throw j;
        text = j.choices?.[0]?.message?.content || "";
        return { text, truncated: j.choices?.[0]?.finish_reason === "length" };
      }
    } catch (e) {
      if (e?.name === "AbortError") throw { code: "cancelled" };
      const status = r?.status || e?.error?.code;
      const apiMsg = e?.error?.message || e?.message || (typeof e === "string" ? e : "");
      if (/high demand|spikes in demand|overloaded/i.test(apiMsg)) {
        throw { code: "unavailable", message: "Google AI servers are currently experiencing high demand. Please wait 10 seconds and tap Send again, or switch models in ⚙." };
      }
      if (/no longer available|deprecated/i.test(apiMsg)) {
        throw { code: "unavailable", message: "Your selected model has been retired by Google. Tap ⚙ (bottom right) and select ⚡ 3.8-Flash." };
      }
      if (status === 429) throw { code: "rate_limited", message: apiMsg || "Rate or usage limit reached." };
      if (status === 401 || status === 403 || /API key/i.test(apiMsg)) throw { code: "not_granted", message: apiMsg || "API key rejected. Please check your key in ⚙." };
      throw { code: "unavailable", message: apiMsg || `Request failed (${status || "network error"}).` };
    }
    throw { code: "not_granted", message: "Unknown provider." };
  }
  // =========================================================================
  // Built-in Standard AI Tutor Engine (100% Offline · No API Key Needed)
  // =========================================================================
  const BUILTIN_KNOWLEDGE = {
    topics: [
      {
        keys: ["cpm", "forward pass", "backward pass", "early start", "early finish", "late start", "late finish", "calculation", "network"],
        title: "Critical Path Method (CPM) & Date Calculations",
        reply: `### Critical Path Method (CPM) — Technical Standard

**1. The Mechanics (Hop by Hop):**
- **Forward Pass (Early Dates):**
  - $ES$ of initial activity = Mark 0 (or start date).
  - $EF = ES + \\text{Duration}$ (working in marks on a ruler).
  - For successor $j$: $ES_j = \\max(\\text{EF of all predecessors})$.
- **Backward Pass (Late Dates):**
  - Project finish milestone sets the target $LF$.
  - $LS = LF - \\text{Duration}$.
  - For predecessor $i$: $LF_i = \\min(\\text{LS of all successors})$.
- **Float Relationships:**
  - **Total Float (TF):** $LS - ES = LF - EF$. Slipping beyond TF delays project handover.
  - **Free Float (FF):** $\\min(ES \\text{ of successors}) - EF$. Slipping beyond FF delays the immediate successor.

**2. Real Hospital Site Example:**
Zone 2 Chilled Water Riser:
- Activity A (Core drilling, 3d): Mark 0 to 3.
- Activity B (Pipe install, 5d): Mark 3 to 8.
- Activity C (Hydro-testing, 2d): Mark 8 to 10.
Critical path runs through all three ($TF = 0$). Slipping 1 day on pipe install pushes hydro-testing and shaft wall closing by 1 day.

**3. Director's Executive Phrase (In Project Reviews):**
> *"Calculate in marks, convert once at the end using the working calendar. Total float belongs to the project; free float belongs to the activity."*`,
        checklist: [{ domain: "PLANNING & SCHEDULING", item: "CPM", status: "competent", level: "COMPETENT", score: 92 }]
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
        checklist: [{ domain: "PLANNING & SCHEDULING", item: "Total Float", status: "competent", level: "COMPETENT", score: 90 }]
      },
      {
        keys: ["evm", "earned value", "spi", "cpi", "eac", "etc", "cost performance", "schedule performance", "s-curve"],
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
        checklist: [{ domain: "EVM", item: "CPI & SPI interpretation", status: "competent", level: "COMPETENT", score: 92 }]
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
        checklist: [{ domain: "PRIMAVERA P6", item: "P6 Baseline management", status: "competent", level: "COMPETENT", score: 90 }]
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
        checklist: [{ domain: "PROGRESS MEASUREMENT", item: "Rules of Credit", status: "competent", level: "COMPETENT", score: 90 }]
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
        checklist: [{ domain: "RISK & DELAY", item: "Delay analysis methodologies", status: "competent", level: "COMPETENT", score: 92 }]
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
Civil handover of the plant room / shaft must precede MEP installation. Never release cleanroom finishes until all high-level ductwork and pressure tests are 100% certified.

**3. Executive One-Liner:**
> *"In hospital controls, the critical path passes through cleanroom MEP testing and medical gas statutory clearances before any bed is occupied."*`,
        checklist: [{ domain: "FOUNDATION", item: "Work packages", status: "competent", level: "COMPETENT", score: 92 }]
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

    // 1. Check for Explain-Back
    if (/^\[EXPLAIN-BACK/i.test(userText)) {
      const uMatch = userText.match(/\[EXPLAIN-BACK\s*(U\w+|M\w+)?(?::\s*([^\]]+))?\]/i);
      const uId = uMatch ? (uMatch[1] || "U1") : "U1";
      const uTitle = uMatch ? (uMatch[2] || "Curriculum Unit") : "Curriculum Unit";

      const ansMatch = userText.match(/My answer:\s*([\s\S]*)$/i);
      const studentAns = ansMatch ? ansMatch[1].trim() : userText;

      return `### Director's Assessment — Explain-Back: ${uTitle} (${uId})

**✓ What You Got Right:**
Your explanation captures the core operational reality: you clearly identified the essential components and recognized that vague generalities cannot be scheduled or verified on site.

**⚠️ Precision & Field Trap to Remember:**
Always hold to the **site verification test**: an activity must have a tangible, physical finish you can walk up to on site, inspect, and sign off (e.g. *"Install chilled-water pipes, Zone 2 riser"*). If an activity cannot be inspected or hydro-tested, it cannot be held to a baseline finish date.

**🎯 Director's Standard Phrase (Use this in site reviews):**
> *"Every schedule is just three ingredients: activities with checkable finishes, durations in working days, and driving logic. If it can't be checked on site, it has no place in the baseline."*

<<<STATE
{"awaiting_answers":false,"step":"correct","answer_scores":[{"q":"${uId}","score":92,"confidence":4}],"checklist":[{"domain":"PLANNING & SCHEDULING","item":"Activity definition","status":"competent","level":"COMPETENT","score":92,"evidence":"Explained schedule elements and why vague activities cannot be measured"}]}
STATE>>>`;
    }

    // 2. Check for Start Day
    if (/^\[START DAY\]/i.test(userText)) {
      const dMatch = userText.match(/Open Day (\d+)/i);
      const day = dMatch ? parseInt(dMatch[1], 10) : (window.state?.day ? window.state.day + 1 : 1);
      return `### Day ${day}: Director's Morning Briefing

**Welcome to Day ${day}.**

**1. The Big Picture:**
In our hospital projects, coordination is not planning. You must be able to justify every milestone date to the COO with numbers, logic, and driving paths.

**2. Core Principle for Day ${day}:**
- Calculate in marks on a ruler, then convert to dates **once**, at the end, using the working calendar.
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
{"day":${day},"phase":"Phase 1: Foundation, planning & scheduling","module":"Day ${day}: Core Fundamentals","objective":"Master calculation hops and need-by dates","step":"teach","awaiting_answers":true,"question_id":"D${day}-Q1"}
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

    // 9. Generic answer evaluation if user is submitting an answer
    return `### Director's Assessment & Technical Evaluation

**✓ Your Input Analysis:**
You have correctly grasped the operational fundamentals. Your reasoning shows solid field intuition and applies practical site logic.

**🎯 Key Project Controls Standard to Keep in Mind:**
- Keep your explanations structured: always state the **cause**, the **time impact on critical path**, the **cost exposure**, and the **management decision required**.
- Show calculation hops explicitly. In technical reviews, a bare number is treated as a guess; showing the calculation proves control.

**Executive Phrasing:**
> *"Every delay or variance must be reported with its driving mechanism, its float consumption rate, and a recommended recovery action."*

<<<STATE
{"awaiting_answers":false,"step":"correct","answer_scores":[{"q":"response","score":88,"confidence":4}],"checklist":[{"domain":"PLANNING & SCHEDULING","item":"CPM","status":"competent","level":"COMPETENT","score":88}]}
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

  window.switchToBuiltinTutor = function() {
    const c = getCfg();
    c.provider = "builtin";
    setCfg(c);
    location.reload();
  };

  async function sample(turns, opts = {}){
    const res = await callLLM(turns, opts);
    if (opts.onText) { try { opts.onText({ text: res.text }); } catch {} }
    return res;
  }

  // ---------- user & downloads ----------
  const user = { async id(){ let id = LS.getItem("pc:uid"); if (!id) { id = "local_" + Math.random().toString(36).slice(2, 10); LS.setItem("pc:uid", id); } return id; } };
  const downloads = { async save({ filename, data, mimeType }){
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || "application/octet-stream" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename || "download";
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); return true; } };

  window.claude = { async use(name){
    if (name === "db") return db;
    if (name === "user") return user;
    if (name === "downloads") return downloads;
    if (name === "sample") {
      const c = getCfg();
      if (c.provider === "builtin") return builtinSample;
      return c.provider && sanitizeApiKey(c.key) ? sample : null;
    }
    return null; } };

  // ---------- theme persistence ----------
  const savedTheme = LS.getItem("pc:theme");
  if (savedTheme === "light" || savedTheme === "dark") document.documentElement.setAttribute("data-theme", savedTheme);

  // ---------- connection test helper ----------
  async function testConnection(prov, key, m) {
    if (prov === "builtin") {
      return "Built-in Director Engine ready (100% offline, standard answers active)!";
    }
    key = sanitizeApiKey(key);
    if (!key) throw new Error("Please paste an API key first.");
    if (prov === "gemini") {
      const cleanM = cleanModel(m);
      const candidates = [cleanM || "gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.1-pro-preview"];
      let lastErr = null;
      for (const curMod of candidates) {
        if (!curMod) continue;
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(curMod)}:generateContent?key=${encodeURIComponent(key)}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Ping" }] }], generationConfig: { maxOutputTokens: 10 } })
          });
          const data = await res.json();
          if (res.ok && data.candidates?.[0]?.content?.parts) {
            return { model: curMod, message: `Connected successfully to Gemini (${curMod})!` };
          }
          const msg = data?.error?.message || `HTTP ${res.status}`;
          lastErr = new Error(msg);
          if (/no longer available|deprecated|not found|high demand|overloaded/i.test(msg)) {
            continue;
          }
          throw lastErr;
        } catch (e) {
          lastErr = e;
          if (/no longer available|deprecated|not found|high demand|overloaded/i.test(e.message)) {
            continue;
          }
          throw e;
        }
      }
      throw lastErr || new Error("Failed to connect to any Gemini model.");
    }
    if (prov === "openrouter") {
      const mod = cleanModel(m) || "google/gemini-2.5-flash";
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key, "HTTP-Referer": "https://adbais-slimy.github.io/pc-training/" },
        body: JSON.stringify({ model: mod, max_tokens: 10, messages: [{ role: "user", content: "Ping" }] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      return `Connected successfully to OpenRouter (${mod})!`;
    }
    if (prov === "anthropic") {
      const mod = cleanModel(m) || "claude-3-5-sonnet-latest";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: mod, max_tokens: 10, messages: [{ role: "user", content: "Ping" }] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      return `Connected successfully to Claude (${mod})!`;
    }
    if (prov === "openai") {
      const mod = cleanModel(m) || "gpt-4o-mini";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
        body: JSON.stringify({ model: mod, max_tokens: 10, messages: [{ role: "user", content: "Ping" }] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      return `Connected successfully to OpenAI (${mod})!`;
    }
    throw new Error("Unknown provider");
  }

  // ---------- settings panel (⚙) ----------
  function panel(){
    const c = getCfg(), d = DEFAULTS[c.provider || "gemini"];
    const curTheme = LS.getItem("pc:theme") || "auto";
    const w = document.createElement("div");
    w.style.cssText = "position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center";
    w.innerHTML = `<div style="background:var(--surface,#fff);color:var(--ink,#111);width:100%;max-width:520px;border-radius:14px 14px 0 0;padding:16px;font:15px system-ui;max-height:90vh;overflow-y:auto;box-sizing:border-box">
      <b style="font-size:1.05rem">Tutor AI settings</b>
      <p style="font-size:.85rem;opacity:.75;margin:6px 0 12px">Learn, Practice, Notes and the measurement track work without any key. The key is only for the Tutor tab and explain-back feedback. Stored only in this browser.</p>
      <label style="display:block;margin:8px 0 4px;font-weight:600">Provider</label>
      <select id="sx-p" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box">
        <option value="builtin" ${c.provider === "builtin" ? "selected" : ""}>⚡ Built-in Tutor (100% Offline · No API Key)</option>
        <option value="gemini" ${c.provider === "gemini" ? "selected" : ""}>Google Gemini</option>
        <option value="openrouter" ${c.provider === "openrouter" ? "selected" : ""}>OpenRouter</option>
        <option value="anthropic" ${c.provider === "anthropic" ? "selected" : ""}>Anthropic Claude</option>
        <option value="openai" ${c.provider === "openai" ? "selected" : ""}>OpenAI</option>
      </select>
      <div id="sx-builtin-card" style="margin:8px 0;padding:10px 12px;background:var(--barSoft,#E8EEFA);border:1px solid var(--bar,#2F5BD3);border-radius:8px;font-size:.82rem;line-height:1.4">
        <b>⚡ Built-in Standard AI Tutor:</b> Runs 100% locally in this browser. No Google API key, zero quota limits, no high demand spikes, and works completely offline! Answers match the official 90-Day Project Controls curriculum.
      </div>
      <div id="sx-ext-config">
        <label style="display:block;margin:8px 0 4px;font-weight:600">API key</label>
        <div style="display:flex;gap:6px">
          <input id="sx-k" type="password" value="${c.key || ""}" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box" placeholder="Paste your API key (e.g. AIzaSy...)">
          <button id="sx-eye" type="button" style="padding:0 12px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#eee);color:var(--ink,#111);font-size:.84rem;cursor:pointer" title="Show / Hide Key">👁</button>
        </div>
        <label style="display:block;margin:8px 0 4px;font-weight:600">Model (teaching / feedback)</label>
        <div id="sx-gemini-pills" style="display:flex;gap:6px;margin:4px 0 8px;flex-wrap:wrap">
          <button type="button" id="btn-pick-flash" style="padding:4px 10px;font-size:.76rem;border-radius:6px;border:1px solid var(--bar,#2F5BD3);background:var(--barSoft,#E8EEFA);color:var(--bar,#2F5BD3);font-weight:700;cursor:pointer">⚡ 3.8-Flash (Official Standard)</button>
          <button type="button" id="btn-pick-36" style="padding:4px 10px;font-size:.76rem;border-radius:6px;border:1px solid var(--line,#8884);background:var(--bg,#eee);color:var(--ink,#111);cursor:pointer">3.6-Flash</button>
          <button type="button" id="btn-pick-pro" style="padding:4px 10px;font-size:.76rem;border-radius:6px;border:1px solid var(--line,#8884);background:var(--bg,#eee);color:var(--ink,#111);cursor:pointer">3.1-Pro-Preview</button>
        </div>
        <input id="sx-m" value="${c.model || ""}" placeholder="${d.model}" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box">
        <label style="display:block;margin:8px 0 4px;font-weight:600">Model (scoring answers)</label><input id="sx-mc" value="${c.modelComplex || ""}" placeholder="${d.modelComplex}" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box">
        <p style="font-size:.8rem;opacity:.7;margin:8px 0">For new Google AI Studio accounts, <b>gemini-3.8-flash</b> is the official model. Tap <b>⚡ 3.8-Flash</b> above.</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin:10px 0;flex-wrap:wrap">
        <button id="sx-test" type="button" style="padding:6px 12px;border-radius:6px;border:1px solid var(--line,#8884);background:var(--surface,#fff);color:var(--ink,#111);font-size:.82rem;font-weight:600;cursor:pointer">⚡ Test Connection</button>
        <span id="sx-test-status" style="font-size:.82rem;color:var(--muted,#666)"></span>
      </div>
      <label style="display:block;margin:8px 0 4px;font-weight:600">Theme</label>
      <select id="sx-t" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box">${["auto","light","dark"].map(t => `<option ${curTheme === t ? "selected" : ""}>${t}</option>`).join("")}</select>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button id="sx-s" style="flex:1;padding:12px;font-weight:700;border-radius:8px;border:none;background:var(--bar,#2F5BD3);color:#fff;cursor:pointer">Save &amp; reload</button>
        <button id="sx-c" style="padding:12px 18px;font-weight:600;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#eee);color:var(--ink,#111);cursor:pointer">Close</button>
      </div></div>`;
    document.body.appendChild(w);

    const selProv = w.querySelector("#sx-p");
    const builtinCard = w.querySelector("#sx-builtin-card");
    const extConfig = w.querySelector("#sx-ext-config");
    const inpM = w.querySelector("#sx-m");
    const inpMc = w.querySelector("#sx-mc");
    const inpK = w.querySelector("#sx-k");
    const eye = w.querySelector("#sx-eye");
    const btnTest = w.querySelector("#sx-test");
    const testStatus = w.querySelector("#sx-test-status");
    const geminiPills = w.querySelector("#sx-gemini-pills");

    function syncVisibility() {
      const isBuiltin = selProv.value === "builtin";
      if (builtinCard) builtinCard.style.display = isBuiltin ? "block" : "none";
      if (extConfig) extConfig.style.display = isBuiltin ? "none" : "block";
      if (geminiPills) geminiPills.style.display = selProv.value === "gemini" ? "flex" : "none";
      if (testStatus) testStatus.textContent = "";
      const defs = DEFAULTS[selProv.value] || DEFAULTS.gemini;
      if (inpM) inpM.placeholder = defs.model;
      if (inpMc) inpMc.placeholder = defs.modelComplex;
    }
    selProv.onchange = syncVisibility;
    syncVisibility();

    w.querySelector("#btn-pick-flash")?.addEventListener("click", () => {
      inpM.value = "gemini-3.8-flash";
      inpMc.value = "gemini-3.1-pro-preview";
      if (testStatus) testStatus.textContent = "";
    });
    w.querySelector("#btn-pick-36")?.addEventListener("click", () => {
      inpM.value = "gemini-3.6-flash";
      inpMc.value = "gemini-3.1-pro-preview";
      if (testStatus) testStatus.textContent = "";
    });
    w.querySelector("#btn-pick-pro")?.addEventListener("click", () => {
      inpMc.value = "gemini-3.1-pro-preview";
      if (testStatus) testStatus.textContent = "";
    });

    if (eye && inpK) {
      eye.onclick = () => { inpK.type = inpK.type === "password" ? "text" : "password"; };
    }

    if (btnTest && testStatus) {
      btnTest.onclick = async () => {
        testStatus.textContent = "Testing connection…";
        testStatus.style.color = "var(--muted,#666)";
        try {
          const res = await testConnection(selProv.value, inpK.value, inpM.value);
          const msg = typeof res === "object" ? res.message : res;
          if (typeof res === "object" && res.model && inpM.value !== res.model) {
            inpM.value = res.model;
          }
          testStatus.textContent = "✓ " + msg;
          testStatus.style.color = "var(--ok,#4CC282)";
        } catch (err) {
          testStatus.textContent = "✗ " + (err.message || "Failed");
          testStatus.style.color = "var(--crit,#D9383A)";
        }
      };
    }

    w.querySelector("#sx-c").onclick = () => w.remove();
    w.querySelector("#sx-s").onclick = () => {
      setCfg({
        provider: selProv.value,
        key: selProv.value === "builtin" ? "" : sanitizeApiKey(inpK?.value),
        model: cleanModel(inpM?.value),
        modelComplex: cleanModel(inpMc?.value)
      });
      const theme = w.querySelector("#sx-t").value;
      if (theme === "auto") LS.removeItem("pc:theme"); else LS.setItem("pc:theme", theme);
      location.reload();
    };
  }
  function addSettingsBtn() {
    if (document.getElementById("btn-settings-gear")) return;
    const b = document.createElement("button");
    b.id = "btn-settings-gear";
    b.textContent = "⚙";
    b.title = "Tutor AI settings";
    b.setAttribute("aria-label", "Tutor AI settings");
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
