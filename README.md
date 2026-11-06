# PC Training: standalone export (for Google Antigravity or any editor)

Your 90-day Planning & Project Controls programme, exported from Claude. It runs in any browser. The AI tutor works with your own Gemini, Anthropic or OpenAI key.

## 1. Open it in Antigravity
1. Unzip this folder.
2. In Antigravity: **Open Folder → `pc-training`**. Antigravity automatically reads `AGENTS.md` and `.agents/rules/*.md`, so its agent knows how the app works, how the tutor must answer, and the content standards.
3. Start a fresh agent task (so the rules load) and say, for example:
   *"Run the tests, then serve the app on port 8080."*

## 2. Run it
- In the terminal: `npx serve app` (or `python -m http.server -d app 8080`), then open the address it prints. Use your phone (same Wi-Fi) or a narrow browser window.
- Tests: `npm install`, then `npm test`.

## 3. Bring your progress across
In the app: **More → Restore backup → choose `data/my-progress.json`**. You'll be back on **Day 2**, with Day 0 and Day 1 passed, your cards and your Tutor chat.

## 4. Turn on the Tutor (optional)
Tap **⚙** (bottom right): choose a provider, paste your API key, and save.
- **Gemini:** get a key in Google AI Studio. Free-tier limits are low and Google may use free-tier data for training, so keep client-confidential figures out.
- **Anthropic / OpenAI:** paid keys.
- Model names change. If a call fails, check the current model names and enter them in ⚙.

Learn, Practice, Notes and the Site measurement track **work without any key**.

## What's inside
| Path | What it is |
|---|---|
| `app/index.html` | The app (Learn days 0–20 + Gate 1, measurement track M1–M6, Practice, Notes, Tutor) |
| `app/shim.js` | Local storage, AI provider and downloads (replaces Claude's runtime) |
| `AGENTS.md` | Project rules for Antigravity's agent: architecture, non-negotiables, roadmap |
| `.agents/rules/tutor-style.md` | Exactly how the AI tutor must answer you |
| `.agents/rules/content-standards.md` | How new days, checks, drills and real-work tasks must be written |
| `docs/PROGRAMME.md` | Your original 90-day brief |
| `docs/TUTOR_SYSTEM_PROMPT.md` | The full tutor protocol the app sends |
| `data/my-progress.json` | Your progress as of the export |
| `tests/` | Automated checks (course flow, drills, measurement, standalone runtime) |

## Notes
- Your data stays in the browser you use (localStorage). Use **More → Download backup** regularly, especially before switching browsers or devices.
- Next content to build: **Block 2 (Days 21–50)**, after you pass Gate 1. Ask Antigravity's agent to write it following `content-standards.md`, or come back to Claude.
