# Skills (what ReviewMate can do)

Detailed feature reference. For installation and quick start, see the [README](../README.md).

## Run a code review

Trigger: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Win/Linux) — or `ReviewMate: Review this code` in the command palette.

- If you have a **selection**, only that range is reviewed.
- If nothing is selected, the **whole file** is reviewed (capped at 500 lines — bigger files require a selection).
- A progress notification appears at the top-right while the AI processes.
- After the response arrives, results land in **four places at once** — see below.

## Four ways to see results

### 1. Inline diagnostics (squiggles)

- 🔴 Red — `critical` issues (bugs, security, broken logic)
- 🟡 Yellow — `warning` issues (likely bugs, perf, bad practices)
- 🔵 Blue — `info` issues (style, minor improvements)

Hover any squiggle to see the full message and suggested fix. Click on the **Problems panel** (`Cmd+Shift+M`) to see a flat list — filter by `ReviewMate` source.

### 2. Quick-fix code actions

Click on a flagged line → lightbulb icon appears → **"ReviewMate: View fix suggestion"** → opens the suggested fix in a side-by-side editor tab.

The fix is always shown in a **new untitled document** rather than auto-applied — you stay in control of what actually lands in your file.

### 3. Sidebar panel

Open the Explorer view (`Cmd+Shift+E`) → scroll to the **REVIEWMATE** section.

What's there:
- **Header** — extension name + active provider badge
- **"Full report"** link — opens the polished full-page view (only visible after a review)
- **"Change provider"** link — quick provider switcher
- **Summary** — 1–2 sentence overall assessment
- **Issues grouped by severity** — Critical first, then Warning, then Info, with counts
- **"Reviewed by <provider>"** credit at the bottom

### 4. Full-page report

Triggered by clicking **"Full report"** in the sidebar, or via the command palette → `ReviewMate: Open Full Report`.

Opens in a real editor tab (not a sidebar) with:
- Stats header showing total + per-severity counts as colored chips
- Wider, more readable issue cards with separated "Suggested fix" sections
- Reuses the same panel across reviews — doesn't stack tabs

### Bonus: output log

`View → Output → "ReviewMate"` (or run `ReviewMate: Show Output Log` from the command palette).

Plain-text scrollable history of **every review you've run this session**, with timestamp, file path, summary, severity counts, and every issue with its fix. Useful for:
- Comparing what different providers said about the same code
- Reviewing prior runs without re-reviewing
- Debugging when an AI response looks off

## Switch providers on the fly

`ReviewMate: Change Provider` in the command palette → quick-pick:

- **Gemini Flash** — Free, 1M tokens/day from Google AI Studio
- **Groq (Llama 3)** — Free, ~14,400 requests/day from console.groq.com
- **Claude Haiku** — Paid (cheap, ~$0.001/review), best response quality
- **Ollama (local)** — Free, fully offline, runs on your machine

After picking a provider, you'll be prompted for an API key (skipped for Ollama). The key is stored in VS Code settings (per-machine, never synced anywhere).

You can also change provider directly in **Settings → ReviewMate** without going through the picker.

## Clear diagnostics

`ReviewMate: Clear Diagnostics` — removes all ReviewMate squiggles from every open file. The sidebar and report keep their last result; only the inline annotations are cleared.

## Configurable settings

| Setting | Default | What it does |
|---|---|---|
| `reviewmate.provider` | `gemini` | Which AI to use (`gemini`, `groq`, `claude`, `ollama`) |
| `reviewmate.apiKey` | `""` | API key for the chosen provider — required except for Ollama |
| `reviewmate.ollamaModel` | `codellama` | Model name when using Ollama |
| `reviewmate.ollamaUrl` | `http://localhost:11434` | Ollama server URL |

Settings live in `Cmd+,` → search "ReviewMate".

## Privacy

ReviewMate sends **only the code you select** (and the language ID) to **only the provider you chose**. No telemetry, no analytics, no other network calls. With Ollama, no data ever leaves your machine.

Your API key is stored in VS Code's local settings. It's never logged, never sent to any third party — it's used only to authenticate the request to your provider.

## What ReviewMate does not do (yet)

- ❌ Auto-apply fixes (intentional — fixes always show in a side panel for you to copy)
- ❌ Review across multiple files at once
- ❌ Track issues over time / measure progress
- ❌ Compare two providers in a single run
- ❌ Persistent review history across sessions (output log clears when VS Code restarts)
- ❌ Custom prompts per language

These are deliberate v0.1 scope choices, not blockers. Issues / PRs welcome at https://github.com/trongbui1105/ReviewMate.
