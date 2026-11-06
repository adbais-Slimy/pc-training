/* Standalone runtime for the PC Training app (outside Claude).
   Recreates the four capabilities the app expects from window.claude:
   db (local document store), sample (LLM call), user (local id), downloads (file save).
   Your API key stays in this browser's localStorage only. */
(function(){
  if (window.claude) return; // tests may inject their own stub
  const LS = window.localStorage;
  const cfgKey = "pc:llm";
  const getCfg = () => { try { return JSON.parse(LS.getItem(cfgKey) || "{}"); } catch { return {}; } };
  const setCfg = c => LS.setItem(cfgKey, JSON.stringify(c));

  // ---------- db: documents stored in localStorage under "pcdb:<path>" ----------
  const db = { doc(path){ const k = "pcdb:" + path; return {
    async get(){ const v = LS.getItem(k); return { exists: v != null, data: () => (v ? JSON.parse(v) : undefined) }; },
    async set(data){ try { LS.setItem(k, JSON.stringify(data)); } catch(e){ throw { code: "quota_exceeded", message: String(e) }; } }
  }; } };

  // ---------- sample: one interface, three providers ----------
  const DEFAULTS = {
    gemini:    { model: "gemini-2.5-flash", modelComplex: "gemini-2.5-pro" },
    anthropic: { model: "claude-sonnet-4-5", modelComplex: "claude-sonnet-4-5" },
    openai:    { model: "gpt-4o-mini", modelComplex: "gpt-4o", baseUrl: "https://api.openai.com/v1" }
  };
  async function callLLM(turns, opts = {}){
    const c = getCfg(); if (!c.provider || !c.key) throw { code: "not_granted", message: "No API key set. Tap ⚙ to add one." };
    const d = DEFAULTS[c.provider] || {};
    const model = (opts.modelTier === "complex" ? (c.modelComplex || d.modelComplex) : (c.model || d.model));
    const msgs = turns.map(t => ({ role: t.role, content: typeof t.content === "string" ? t.content : JSON.stringify(t.content) }));
    let r, j, text = "";
    try {
      if (c.provider === "gemini") {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(c.key)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: opts.signal,
          body: JSON.stringify({ contents: msgs.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
                                 generationConfig: { maxOutputTokens: 4096, temperature: 0.4 } }) });
        j = await r.json(); if (!r.ok) throw j;
        text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
        return { text, truncated: j.candidates?.[0]?.finishReason === "MAX_TOKENS" };
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
      if (status === 429) throw { code: "rate_limited", message: "Rate or usage limit reached." };
      if (status === 401 || status === 403) throw { code: "not_granted", message: "API key rejected." };
      throw { code: "unavailable", message: (e?.error?.message || e?.message || String(e)) };
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

  // ---------- auto-restore: seed localStorage from auto-restore.json on first visit ----------
  // Runs once silently. If the user already has progress (any pcdb: state key) it does nothing.
  (async function autoRestore(){
    try {
      // Mirror user.id() so we write to the same key the app will read.
      let id = LS.getItem("pc:uid");
      if (!id) { id = "local_" + Math.random().toString(36).slice(2, 10); LS.setItem("pc:uid", id); }
      const stateKey = "pcdb:data/users/" + id + "/state";
      const chatKey  = "pcdb:data/users/" + id + "/chat";
      if (LS.getItem(stateKey)) return; // already have progress — leave it alone
      const r = await fetch("auto-restore.json");
      if (!r.ok) return;
      const j = await r.json();
      if (!j || !j.state || !Array.isArray(j.chat)) return;
      // Store in the same shape save() uses: { state: "<json string>" } / { chat: "<json string>" }
      LS.setItem(stateKey, JSON.stringify({ state: JSON.stringify(j.state) }));
      LS.setItem(chatKey,  JSON.stringify({ chat:  JSON.stringify(j.chat)  }));
      console.info("[pc-training] Auto-restored Day-2 progress from auto-restore.json");
    } catch(_) { /* silent — missing file or quota error */ }
  })();

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
      <label style="display:block;margin:8px 0 4px">Provider</label>
      <select id="sx-p" style="width:100%;padding:8px">${["gemini","anthropic","openai"].map(p => `<option ${c.provider === p ? "selected" : ""}>${p}</option>`).join("")}</select>
      <label style="display:block;margin:8px 0 4px">API key</label><input id="sx-k" type="password" value="${c.key || ""}" style="width:100%;padding:8px" placeholder="Paste your API key">
      <label style="display:block;margin:8px 0 4px">Model (teaching / feedback)</label><input id="sx-m" value="${c.model || ""}" placeholder="${d.model}" style="width:100%;padding:8px">
      <label style="display:block;margin:8px 0 4px">Model (scoring answers)</label><input id="sx-mc" value="${c.modelComplex || ""}" placeholder="${d.modelComplex}" style="width:100%;padding:8px">
      <p style="font-size:.8rem;opacity:.7;margin:8px 0">Model names change. Check the current ones in Google AI Studio, the Anthropic console or OpenAI before relying on the defaults. On free tiers, don't paste client-confidential figures.</p>
      <label style="display:block;margin:8px 0 4px">Theme</label>
      <select id="sx-t" style="width:100%;padding:8px">${["auto","light","dark"].map(t => `<option ${curTheme === t ? "selected" : ""}>${t}</option>`).join("")}</select>
      <div style="display:flex;gap:8px;margin-top:10px"><button id="sx-s" style="flex:1;padding:10px;font-weight:700">Save & reload</button><button id="sx-c" style="padding:10px">Close</button></div></div>`;
    document.body.appendChild(w);
    w.querySelector("#sx-c").onclick = () => w.remove();
    w.querySelector("#sx-s").onclick = () => { setCfg({ provider: w.querySelector("#sx-p").value, key: w.querySelector("#sx-k").value.trim(),
      model: w.querySelector("#sx-m").value.trim(), modelComplex: w.querySelector("#sx-mc").value.trim() });
      const theme = w.querySelector("#sx-t").value; if (theme === "auto") LS.removeItem("pc:theme"); else LS.setItem("pc:theme", theme);
      location.reload(); };
  }
  document.addEventListener("DOMContentLoaded", () => {
    const b = document.createElement("button"); b.textContent = "⚙"; b.title = "Tutor AI settings"; b.setAttribute("aria-label", "Tutor AI settings");
    b.style.cssText = "position:fixed;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:40;width:40px;height:40px;border-radius:20px;border:1px solid #8884;background:var(--surface,#fff);font-size:18px";
    b.onclick = panel; document.body.appendChild(b);
  });
})();
