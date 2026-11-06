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
      if (c.provider === "gemini") {
        if (!c.model || /gemini-(1\.[05]|2\.[05]|3\.[0-9]-flash)/.test(c.model || "")) { c.model = "gemini-2.5-flash"; setCfg(c); }
        if (!c.modelComplex || /gemini-(1\.[05]|2\.[05]|3\.[0-9]-flash)/.test(c.modelComplex || "")) { c.modelComplex = "gemini-3.1-pro-preview"; setCfg(c); }
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

  // ---------- sample: one interface, four providers ----------
  const DEFAULTS = {
    gemini:    { model: "gemini-2.5-flash", modelComplex: "gemini-3.1-pro-preview" },
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
        const candidates = [model];
        ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.1-pro-preview"].forEach(m => {
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
            const isRetryable = r?.status === 503 || r?.status === 429 || r?.status === 404 || /high demand|spikes in demand|overloaded|temporar|not found|no longer available|deprecated/i.test(msg);
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
        throw { code: "unavailable", message: "Google AI servers are currently experiencing high demand across Flash models. Please wait 10 seconds and tap Send again, or switch to 'gemini-2.5-flash-lite' in ⚙." };
      }
      if (status === 429) throw { code: "rate_limited", message: apiMsg || "Rate or usage limit reached." };
      if (status === 401 || status === 403 || /API key/i.test(apiMsg)) throw { code: "not_granted", message: apiMsg || "API key rejected. Please check your key in ⚙." };
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
    if (name === "sample") { const c = getCfg(); return c.provider && sanitizeApiKey(c.key) ? sample : null; }
    return null; } };

  // ---------- theme persistence ----------
  const savedTheme = LS.getItem("pc:theme");
  if (savedTheme === "light" || savedTheme === "dark") document.documentElement.setAttribute("data-theme", savedTheme);

  // ---------- connection test helper ----------
  async function testConnection(prov, key, m) {
    key = sanitizeApiKey(key);
    if (!key) throw new Error("Please paste an API key first.");
    if (prov === "gemini") {
      const mod = cleanModel(m) || "gemini-2.5-flash";
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mod)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Ping" }] }], generationConfig: { maxOutputTokens: 10 } })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      return `Connected successfully to Gemini (${mod})!`;
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
      <select id="sx-p" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box">${["gemini","openrouter","anthropic","openai"].map(p => `<option ${c.provider === p ? "selected" : ""}>${p}</option>`).join("")}</select>
      <label style="display:block;margin:8px 0 4px;font-weight:600">API key</label>
      <div style="display:flex;gap:6px">
        <input id="sx-k" type="password" value="${c.key || ""}" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box" placeholder="Paste your API key (e.g. AIzaSy...)">
        <button id="sx-eye" type="button" style="padding:0 12px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#eee);color:var(--ink,#111);font-size:.84rem;cursor:pointer" title="Show / Hide Key">👁</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin:6px 0 10px;flex-wrap:wrap">
        <button id="sx-test" type="button" style="padding:6px 12px;border-radius:6px;border:1px solid var(--line,#8884);background:var(--surface,#fff);color:var(--ink,#111);font-size:.82rem;font-weight:600;cursor:pointer">⚡ Test Connection</button>
        <span id="sx-test-status" style="font-size:.82rem;color:var(--muted,#666)"></span>
      </div>
      <label style="display:block;margin:8px 0 4px;font-weight:600">Model (teaching / feedback)</label>
      <div id="sx-gemini-pills" style="display:flex;gap:6px;margin:4px 0 8px;flex-wrap:wrap">
        <button type="button" id="btn-pick-flash" style="padding:4px 10px;font-size:.76rem;border-radius:6px;border:1px solid var(--line,#8884);background:var(--bg,#eee);color:var(--ink,#111);cursor:pointer">Default: 2.5-Flash</button>
        <button type="button" id="btn-pick-lite" style="padding:4px 10px;font-size:.76rem;border-radius:6px;border:1px solid var(--bar,#2F5BD3);background:var(--barSoft,#E8EEFA);color:var(--bar,#2F5BD3);font-weight:700;cursor:pointer">⚡ 2.5-Flash-Lite (Fix High Demand)</button>
        <button type="button" id="btn-pick-pro" style="padding:4px 10px;font-size:.76rem;border-radius:6px;border:1px solid var(--line,#8884);background:var(--bg,#eee);color:var(--ink,#111);cursor:pointer">3.1-Pro-Preview</button>
      </div>
      <input id="sx-m" value="${c.model || ""}" placeholder="${d.model}" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box">
      <label style="display:block;margin:8px 0 4px;font-weight:600">Model (scoring answers)</label><input id="sx-mc" value="${c.modelComplex || ""}" placeholder="${d.modelComplex}" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line,#8884);background:var(--bg,#fff);color:var(--ink,#111);font:inherit;box-sizing:border-box">
      <p style="font-size:.8rem;opacity:.7;margin:8px 0">If Gemini servers report high demand, tap <b>⚡ 2.5-Flash-Lite</b> above for low-congestion fast responses.</p>
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
    const inpK = w.querySelector("#sx-k");
    const eye = w.querySelector("#sx-eye");
    const btnTest = w.querySelector("#sx-test");
    const testStatus = w.querySelector("#sx-test-status");
    const geminiPills = w.querySelector("#sx-gemini-pills");

    w.querySelector("#btn-pick-flash")?.addEventListener("click", () => {
      inpM.value = "gemini-2.5-flash";
      inpMc.value = "gemini-2.5-flash";
      if (testStatus) testStatus.textContent = "";
    });
    w.querySelector("#btn-pick-lite")?.addEventListener("click", () => {
      inpM.value = "gemini-2.5-flash-lite";
      inpMc.value = "gemini-2.5-flash-lite";
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
          const msg = await testConnection(selProv.value, inpK.value, inpM.value);
          testStatus.textContent = "✓ " + msg;
          testStatus.style.color = "var(--ok,#4CC282)";
        } catch (err) {
          testStatus.textContent = "✗ " + (err.message || "Failed");
          testStatus.style.color = "var(--crit,#D9383A)";
        }
      };
    }

    selProv.onchange = () => {
      const defs = DEFAULTS[selProv.value] || DEFAULTS.gemini;
      inpM.placeholder = defs.model;
      inpMc.placeholder = defs.modelComplex;
      if (geminiPills) geminiPills.style.display = selProv.value === "gemini" ? "flex" : "none";
      if (testStatus) testStatus.textContent = "";
    };

    w.querySelector("#sx-c").onclick = () => w.remove();
    w.querySelector("#sx-s").onclick = () => {
      setCfg({
        provider: selProv.value,
        key: sanitizeApiKey(inpK.value),
        model: cleanModel(inpM.value),
        modelComplex: cleanModel(inpMc.value)
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
