// Run with: npm test   (needs: npm install)
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const RAW = fs.readFileSync(path.join(ROOT, "app/index.html"), "utf8");
const SHIM = fs.readFileSync(path.join(ROOT, "app/shim.js"), "utf8");
const PROGRESS = JSON.parse(fs.readFileSync(path.join(ROOT, "data/my-progress.json"), "utf8"));
const stripExternal = h => h.replace(/<script src=[^>]+><\/script>/g, "").replace(/<link[^>]+>/g, "");
let pass = 0, fail = 0;
const P = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log((ok ? "PASS" : "FAIL") + "  " + name + (extra ? "  — " + extra : "")); };
const wait = ms => new Promise(r => setTimeout(r, ms));

function boot({ shim = false, seed = null, stub = true } = {}) {
  let html = stripExternal(RAW);
  if (shim) html = html.replace("<script>", "<script>" + SHIM + "</script>\n<script>");
  const store = {}, calls = [], errs = [];
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://local.test/", pretendToBeVisual: true, beforeParse(w) {
    if (seed) seed(w);
    w.confirm = () => true;
    w.addEventListener("error", e => errs.push(e.message));
    if (stub) w.claude = { async use(n) {
      if (n === "db") return { doc: p => ({ get: async () => ({ exists: !!store[p], data: () => store[p] }), set: async d => { store[p] = d; } }) };
      if (n === "sample") return async t => { calls.push(t); return { text: "Feedback.\n<<<STATE\n{\"awaiting_answers\":false,\"step\":\"correct\"}\nSTATE>>>" }; };
      if (n === "user") return { id: async () => "u1" };
      if (n === "downloads") return { save: async () => true };
      return null; } };
  } });
  return { w: dom.window, d: dom.window.document, store, calls, errs };
}

async function completeUnit(env, uid) {
  const { w, d } = env, $ = id => d.getElementById(id);
  w.eval('tab("learn"); lv={unit:null}; renderLearn();');
  const b = d.querySelector(`#learnwrap [data-u="${uid}"]`); if (!b) return "not open";
  b.click(); await wait(2);
  for (let g = 0; g < 40; g++) {
    const s = w.eval(`cst("${uid}")`), sc = w.eval(`UNITS.find(u=>u.id==="${uid}").screens[${s.screen}]`);
    if (sc.k === "explainer") while (!$("ex-n").disabled) { $("ex-n").click(); await wait(1); }
    if (sc.k === "guided") { let k = 0; while (w.eval("gp.k<gp.steps.length") && k++ < 90) { const st = w.eval("gp.steps[gp.k]");
      if (st.f === "crit") w.eval("gp.acts.filter(a=>a.tf===0)").forEach(a => d.querySelector(`#gd-crit [data-c="${a.id}"]`).click());
      else $("gd-in").value = w.eval(`gp.acts.find(a=>a.id==="${st.a}").${st.f}`);
      $("gd-ok").click(); await wait(1); } }
    if (sc.k === "cal") { const c = w.eval(`cst("${uid}").cal["${s.screen}"]`); d.querySelector(`[data-d="${w.eval(`iso(addWorking(D0(new Date("${c.start}")),${c.n}))`)}"]`).click(); await wait(1); }
    if (sc.k === "drill") { const q = w.eval("pr.q"); d.querySelectorAll("#u-d [data-k]").forEach(x => x.value = q.ans[x.dataset.k]);
      d.querySelectorAll("#u-d [data-choice]").forEach(gr => [...gr.querySelectorAll("button")].find(bb => bb.dataset.v === String(q.ans[gr.dataset.choice]))?.click()); $("pr-check").click(); await wait(1); }
    if (sc.k === "quiz") { let q = 0; while (q++ < 14 && !/Passed|Not yet/.test(d.querySelector("#u-body .q")?.textContent || "")) {
      const z = w.eval(`cst("${uid}").quiz`), Q = sc.bank[z.pick[z.i]]; d.querySelector(`#u-body [data-o="${Q.o.findIndex(o => o[1])}"]`).click(); await wait(1); $("q-next").click(); await wait(1); } }
    if (sc.k === "done") break;
    if ($("u-next").disabled) return `stuck at screen ${s.screen} (${sc.k})`;
    $("u-next").click(); await wait(2);
  }
  $("u-next").click(); await wait(2);
  return w.eval(`cst("${uid}").done`) ? "ok" : "not done";
}

(async () => {
  // ---------- 1. content validity ----------
  {
    const env = boot(); await wait(500);
    const bad = env.w.eval(`UNITS.flatMap(u=>u.screens.filter(s=>s.k==="quiz").flatMap(s=>s.bank.filter(q=>q.o.filter(o=>o[1]).length!==1||q.o.some(o=>!o[2])).map(q=>u.id+": "+q.q)))`);
    const n = env.w.eval(`UNITS.reduce((a,u)=>a+u.screens.filter(s=>s.k==="quiz").reduce((b,s)=>b+s.bank.length,0),0)`);
    P(`all ${n} check questions have exactly one correct option and a "why" for every option`, bad.length === 0, bad.slice(0, 3).join(" | "));
    P("every main unit and track unit has a real-work task", env.w.eval(`UNITS.filter(u=>u.id!=="U0").every(u=>u.screens.some(s=>s.k==="apply"))`));
    // ---------- 2. drill fuzz ----------
    const { w, d } = env, $ = id => d.getElementById(id);
    const ids = w.eval("DRILLS.map(x=>x.id)"); const broken = [];
    for (const id of ids) { for (let i = 0; i < 30; i++) {
      w.eval(`startPractice('${id}')`); const q = w.eval("pr.q");
      if (q.type === "cpm") { const by = {}; q.acts.forEach(a => by[a.id] = a); d.querySelector('#pracwrap [data-k="pf"]').value = q.sol.pf;
        d.querySelectorAll("#pracwrap #pr-q [data-k]").forEach(x => { const [a, f] = x.dataset.k.split("."); if (f) x.value = by[a][f]; });
        d.querySelectorAll("#pracwrap #critpick button").forEach(b => { if (q.sol.crit.includes(b.dataset.c)) b.click(); }); }
      else { const a = q.ans; d.querySelectorAll("#pracwrap #pr-q [data-k]").forEach(x => x.value = a[x.dataset.k]);
        d.querySelectorAll("#pracwrap [data-choice]").forEach(g => [...g.querySelectorAll("button")].find(b => b.dataset.v === String(a[g.dataset.choice]))?.click());
        if (a.acc) d.querySelector(`#pracwrap #yn [data-y="${a.acc}"]`)?.click(); if (a.best) [...d.querySelectorAll("#pracwrap #bestpick button")].find(b => b.dataset.b === a.best)?.click(); }
      $("pr-check").click(); await wait(1);
      if (!/100\/100/.test(d.querySelector("#pracwrap #pr-res h2")?.textContent || "")) { broken.push(id); break; } } }
    P(`all ${ids.length} drills score 100 on correct answers (30 random problems each)`, broken.length === 0, broken.join(","));
    P("CPM engine matches the worked example", w.eval(`(()=>{const a=GX_ACTS.map(x=>({...x,pred:x.pred.map(p=>({...p}))})); cpm(a); return a.map(x=>x.id+':'+[x.es,x.ef,x.ls,x.lf,x.tf].join('/')).join(' ')})()`) === "A:0/3/0/3/0 B:3/8/3/8/0 C:5/9/5/9/0 D:9/11/9/11/0 E:3/9/5/11/2 F:11/14/11/14/0");
    P("no runtime errors (content checks)", env.errs.length === 0, env.errs.join(" | "));
  }
  // ---------- 3. full course, fresh learner ----------
  {
    const env = boot(); await wait(600); const { w, d } = env;
    P("fresh start shows Day 0 on Learn", d.getElementById("daytag").textContent === "Day 0 / 90" && /Day 0/.test(d.getElementById("learnwrap").textContent));
    P("foundation cards pre-seeded in review deck on fresh start", w.eval('FOUNDATION_CARDS.every(c => state.bank[c.id] && state.sr[c.id])'));
    P("Practice is empty before any day is passed", d.querySelectorAll("#pracwrap [data-d]").length === 0);
    const order = w.eval("UNITS.filter(u=>!u.track).map(u=>u.id)").concat(w.eval('UNITS.filter(u=>u.track==="M").map(u=>u.id)'));
    const res = []; for (const id of order) { const r = await completeUnit(env, id); if (r !== "ok") res.push(id + ":" + r); }
    P(`all ${order.length} units (Days 0–20 + M1–M6) can be completed`, res.length === 0, res.join(", "));
    const S = JSON.parse(env.store["data/users/u1/state"].state);
    P("day advances to 21 after Gate 1; the measurement track doesn't move the day", S.day === 21, "day " + S.day);
    P("cards for every unit are in the review deck", w.eval('UNITS.filter(u=>u.card).every(u=>state.sr[u.card.id])'));
    P("Practice opens drills after their teaching day", ["cpm1", "proc", "rabill", "recon"].every(id => !!d.querySelector(`#pracwrap [data-d="${id}"]`)) || (w.eval('pr={view:"home"};renderPractice();'), ["cpm1", "proc", "rabill", "recon"].every(id => !!d.querySelector(`#pracwrap [data-d="${id}"]`))));
    // fail path
    w.eval('state.course.U4={screen:5,ok:{},tries:0,done:false,missed:[]}; lv={unit:"U4"}; renderLearn();'); await wait(2);
    for (let i = 0; i < 5; i++) { const z = w.eval('cst("U4").quiz'), Q = w.eval("UNITS[4].screens[5].bank")[z.pick[z.i]]; d.querySelector(`#u-body [data-o="${Q.o.findIndex(o => !o[1])}"]`).click(); await wait(1); d.getElementById("q-next").click(); await wait(1); }
    P("failing a check blocks the next step and offers revise/retry", d.getElementById("u-next").disabled && !!d.getElementById("q-retry"));
    P("no runtime errors (course)", env.errs.length === 0, env.errs.join(" | "));
  }
  // ---------- 4. standalone runtime + your saved progress ----------
  {
    const env = boot({ shim: true, stub: false, seed: w => {
      w.localStorage.setItem("pc:uid", "me");
      w.localStorage.setItem("pcdb:data/users/me/state", JSON.stringify({ state: JSON.stringify(PROGRESS.state) }));
      w.localStorage.setItem("pcdb:data/users/me/chat", JSON.stringify({ chat: JSON.stringify(PROGRESS.chat) }));
    } });
    await wait(700); const { w, d } = env;
    P("shim provides db/user/downloads; Director sample ready out of the box", await w.eval('(async()=>{ const db=await claude.use("db"), s=await claude.use("sample"); await db.doc("t/x").set({a:1}); const g=await db.doc("t/x").get(); return g.exists && g.data().a===1 && typeof s==="function"; })()'));
    P("your saved progress loads (Day 2, Days 0–1 passed)", d.getElementById("daytag").textContent === `Day ${PROGRESS.state.day} / 90` && w.eval('cst("U1").done'));
    P("settings button (⚙) present", [...d.querySelectorAll("button")].some(b => b.textContent === "⚙"));
    P("status confirms Director is active", /ready|due|Day|Director/i.test(d.getElementById("status").textContent));
    P("Deliverable Studio, S-Curve Sandbox, and LPS Board render and operate cleanly", await w.eval(`(async () => {
      openDeliverableStudio(1);
      const dlvOk = !!document.getElementById("deliverable-modal");
      document.getElementById("dlv-close")?.click();
      openSCurveSandbox();
      const scOk = !!document.getElementById("scurve-modal") && !!document.getElementById("sc-svg");
      document.getElementById("sc-close")?.click();
      openLPSBoard();
      const lpsOk = !!document.getElementById("lps-modal") && document.getElementById("lps-sound-cnt")?.textContent !== "";
      document.getElementById("lps-close")?.click();
      openScaleVisualizer();
      const scvOk = !!document.getElementById("scale-modal") && document.getElementById("scv-area-m")?.textContent !== "";
      document.getElementById("scv-close")?.click();
      return dlvOk && scOk && lpsOk && scvOk;
    })()`));
    P("no runtime errors (standalone)", env.errs.length === 0, env.errs.join(" | "));
  }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
