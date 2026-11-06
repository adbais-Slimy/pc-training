/* Standalone runtime for the PC Training app (outside Claude).
   Recreates the four capabilities the app expects from window.claude:
   db (local document store), sample (LLM call), user (local id), downloads (file save).
   Your API key stays in this browser's localStorage only. */
(function(){
  if (window.claude) return; // tests may inject their own stub
  const LS = window.localStorage;
  const cfgKey = "pc:llm";
  const getCfg = () => {
    try {
      const c = JSON.parse(LS.getItem(cfgKey) || "{}");
      if (c.provider === "gemini") {
        if (/gemini-(1\.[05]|2\.[05])/.test(c.model || "")) { c.model = "gemini-3.8-flash"; setCfg(c); }
        if (/gemini-(1\.[05]|2\.[05])/.test(c.modelComplex || "")) { c.modelComplex = "gemini-3.8-flash"; setCfg(c); }
      }
      return c;
    } catch { return {}; }
  };
  const setCfg = c => LS.setItem(cfgKey, JSON.stringify(c));

  // ---------- db: documents stored in localStorage under "pcdb:<path>" ----------
  const db = { doc(path){ const k = "pcdb:" + path; return {
    async get(){ const v = LS.getItem(k); return { exists: v != null, data: () => (v ? JSON.parse(v) : undefined) }; },
    async set(data){ try { LS.setItem(k, JSON.stringify(data)); } catch(e){ throw { code: "quota_exceeded", message: String(e) }; } }
  }; } };

  // ---------- sample: one interface, three providers ----------
  const DEFAULTS = {
    gemini:    { model: "gemini-3.8-flash", modelComplex: "gemini-3.8-flash" },
    anthropic: { model: "claude-3-5-sonnet-latest", modelComplex: "claude-3-5-sonnet-latest" },
    openai:    { model: "gpt-4o-mini", modelComplex: "gpt-4o", baseUrl: "https://api.openai.com/v1" }
  };
  async function callLLM(turns, opts = {}){
    const c = getCfg(); if (!c.provider || !c.key) throw { code: "not_granted", message: "No API key set. Tap ⚙ to add one." };
    const d = DEFAULTS[c.provider] || DEFAULTS.gemini;
    const model = (opts.modelTier === "complex" ? (c.modelComplex || d.modelComplex) : (c.model || d.model));
    const msgs = turns.map(t => ({ role: t.role, content: typeof t.content === "string" ? t.content : JSON.stringify(t.content) }));
    let r, j, text = "";
    try {
      if (c.provider === "gemini") {
        const candidates = [model];
        if (model === "gemini-3.8-flash") candidates.push("gemini-3.6-flash");
        else if (!candidates.includes("gemini-3.8-flash")) candidates.push("gemini-3.8-flash");

        let lastErr = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const curModel = candidates[Math.min(attempt, candidates.length - 1)];
          try {
            r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(curModel)}:generateContent?key=${encodeURIComponent(c.key)}`, {
              method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": c.key }, signal: opts.signal,
              body: JSON.stringify({ contents: msgs.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
                                     generationConfig: { maxOutputTokens: 4096, temperature: 0.4 } }) });
            j = await r.json();
            if (r.ok && j.candidates?.[0]?.content?.parts) {
              text = (j.candidates[0].content.parts || []).map(p => p.text || "").join("");
              return { text, truncated: j.candidates[0].finishReason === "MAX_TOKENS" };
            }
            lastErr = j;
            const msg = j?.error?.message || "";
            const isHighDemand = r?.status === 503 || r?.status === 429 || /high demand|spikes in demand|overloaded|temporar/i.test(msg);
            if (isHighDemand && attempt < 2) {
              await new Promise(res => setTimeout(res, 1200 * (attempt + 1)));
              continue;
            }
            throw j;
          } catch (err) {
            lastErr = err;
            if (err?.name === "AbortError") throw err;
            const msg = err?.error?.message || err?.message || "";
            const isHighDemand = /high demand|spikes in demand|overloaded|temporar/i.test(msg);
            if (isHighDemand && attempt < 2) {
              await new Promise(res => setTimeout(res, 1200 * (attempt + 1)));
              continue;
            }
            throw err;
          }
        }
        throw lastErr;
      }
      if (c.provider === "anthropic") {
        r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: opts.signal,
          headers: { "Content-Type": "application/json", "x-api-key": c.key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
          body: JSON.stringify({ model, max_tokens: 4096, messages: msgs }) });
        j = await r.json(); if (!r.ok) throw j;
        text = (j.content || []).map(b => b.text || "").join("");
        return { text, truncated: j.stop_reason === "max_tokens" };
      }
      if (c.provider === "openai") {
        r = await fetch((c.baseUrl || d.baseUrl) + "/chat/completions", { method: "POST", signal: opts.signal,
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + c.key },
          body: JSON.stringify({ model, max_tokens: 4096, messages: msgs }) });
        j = await r.json(); if (!r.ok) throw j;
        text = j.choices?.[0]?.message?.content || "";
        return { text, truncated: j.choices?.[0]?.finish_reason === "length" };
      }
    } catch (e) {
      if (e?.name === "AbortError") throw { code: "cancelled" };
      const status = r?.status;
      const apiMsg = e?.error?.message || e?.message || (typeof e === "string" ? e : "");
      if (/high demand|spikes in demand|overloaded/i.test(apiMsg)) {
        throw { code: "unavailable", message: "Google AI servers are experiencing temporary high demand right now. Please tap Send again in a few seconds, or switch provider in ⚙." };
      }
      if (status === 429) throw { code: "rate_limited", message: apiMsg || "Rate or usage limit reached." };
      if (status === 401 || status === 403) throw { code: "not_granted", message: apiMsg || "API key rejected." };
      throw { code: "unavailable", message: apiMsg || `Request failed (${status || "network error"}).` };
    }
    throw { code: "not_granted", message: "Unknown provider." };
  }
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
    if (name === "sample") { const c = getCfg(); return c.provider && c.key ? sample : null; }
    return null; } };

  // ---------- theme persistence ----------
  const savedTheme = LS.getItem("pc:theme");
  if (savedTheme === "light" || savedTheme === "dark") document.documentElement.setAttribute("data-theme", savedTheme);

  // ---------- settings panel (⚙) ----------
  function panel(){
    const c = getCfg(), d = DEFAULTS[c.provider || "gemini"];
    const curTheme = LS.getItem("pc:theme") || "auto";
    const w = document.createElement("div");
    w.style.cssText = "position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center";
    w.innerHTML = `<div style="background:var(--surface,#fff);color:var(--ink,#111);width:100%;max-width:520px;border-radius:14px 14px 0 0;padding:16px;font:15px system-ui">
      <b style="font-size:1.05rem">Tutor AI settings</b>
      <p style="font-size:.85rem;opacity:.75;margin:6px 0 12px">Learn, Practice, Notes and the measurement track work without any key. The key is only for the Tutor tab and explain-back feedback. It's stored only in this browser.</p>
      <label style="display:block;margin:8px 0 4px;font-weight:600">Provider</label>
      <select id="sx-p" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box">${["gemini","anthropic","openai"].map(p => `<option ${c.provider === p ? "selected" : ""}>${p}</option>`).join("")}</select>
      <label style="display:block;margin:8px 0 4px;font-weight:600">API key</label><input id="sx-k" type="password" value="${c.key || ""}" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box" placeholder="Paste your API key">
      <label style="display:block;margin:8px 0 4px;font-weight:600">Model (teaching / feedback)</label><input id="sx-m" value="${c.model || ""}" placeholder="${d.model}" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box">
      <label style="display:block;margin:8px 0 4px;font-weight:600">Model (scoring answers)</label><input id="sx-mc" value="${c.modelComplex || ""}" placeholder="${d.modelComplex}" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box">
      <p style="font-size:.8rem;opacity:.7;margin:8px 0">On free tiers, don't paste client-confidential figures. Leave models blank to use the recommended defaults.</p>
      <label style="display:block;margin:8px 0 4px;font-weight:600">Theme</label>
      <select id="sx-t" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box">${["auto","light","dark"].map(t => `<option ${curTheme === t ? "selected" : ""}>${t}</option>`).join("")}</select>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button id="sx-s" style="flex:1;padding:12px;font-weight:700;border-radius:8px;border:none;background:var(--bar,#2F5BD3);color:#fff;cursor:pointer">Save &amp; reload</button>
        <button id="sx-c" style="padding:12px 18px;font-weight:600;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#eee);color:var(--ink,#111);cursor:pointer">Close</button>
      </div></div>`;
    document.body.appendChild(w);

    const selProv = w.querySelector("#sx-p");
    const inpM = w.querySelector("#sx-m");
    const inpMc = w.querySelector("#sx-mc");
    selProv.onchange = () => {
      const defs = DEFAULTS[selProv.value] || DEFAULTS.gemini;
      inpM.placeholder = defs.model;
      inpMc.placeholder = defs.modelComplex;
    };

    w.querySelector("#sx-c").onclick = () => w.remove();
    w.querySelector("#sx-s").onclick = () => { setCfg({ provider: w.querySelector("#sx-p").value, key: w.querySelector("#sx-k").value.trim(),
      model: w.querySelector("#sx-m").value.trim(), modelComplex: w.querySelector("#sx-mc").value.trim() });
      const theme = w.querySelector("#sx-t").value; if (theme === "auto") LS.removeItem("pc:theme"); else LS.setItem("pc:theme", theme);
      location.reload(); };
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
