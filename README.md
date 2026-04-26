<div align="center">
  <img src="icon.png" alt="ReviewMate" width="128" height="128" />

  # ReviewMate — AI Code Reviewer

  AI-powered code reviews in VS Code. Bring your own provider — **Gemini**, **Groq**, **Claude**, or **local Ollama**.

  [![Marketplace](https://img.shields.io/badge/Marketplace-trongbui.reviewmate-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=trongbui.reviewmate)
  [![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
</div>

---

## What it does

Press **`Ctrl+Shift+R`** (`Cmd+Shift+R` on Mac) on any file and ReviewMate sends the code to your chosen AI provider for review. Issues come back as:

- 🔴🟡🔵 **Inline squiggles** (Error / Warning / Info)
- 💡 **Quick-fix suggestions** via the lightbulb
- 🗂️ A grouped list in the **sidebar**
- 📄 A **full-page report** opened in an editor tab
- 📜 An **output channel log** of every review you've run

Bring your own API key — ReviewMate doesn't proxy your code through any server. With Ollama, your code never leaves your machine.

## Supported providers

| Provider          | Free?                       | Quality          | How to get a key                                          |
|-------------------|-----------------------------|------------------|-----------------------------------------------------------|
| **Gemini Flash**  | ✅ 1M tokens/day             | Good             | https://aistudio.google.com/apikey                        |
| **Groq (Llama 3)**| ✅ ~14,400 req/day           | Good             | https://console.groq.com/keys                             |
| **Claude Haiku**  | ❌ Paid (~$0.001/review)     | Best             | https://console.anthropic.com/settings/keys               |
| **Ollama (local)**| ✅ Fully offline             | Varies by model  | https://ollama.com — install + `ollama pull codellama`    |

## Get started in 30 seconds

1. **Install** from the Marketplace: search "ReviewMate" or run
   ```
   code --install-extension trongbui.reviewmate
   ```
2. Open the command palette (`Cmd+Shift+P`) → **`ReviewMate: Change Provider`** → pick one → paste your API key.
3. Open any code file → press **`Cmd+Shift+R`**.

That's it. Issues appear inline and in the **ReviewMate** sidebar (Explorer panel).

## Commands

| Command                              | Default keybinding |
|--------------------------------------|--------------------|
| `ReviewMate: Review this code`       | `Cmd+Shift+R` / `Ctrl+Shift+R` |
| `ReviewMate: Change Provider`        | —                  |
| `ReviewMate: Open Full Report`       | —                  |
| `ReviewMate: Show Output Log`        | —                  |
| `ReviewMate: Clear Diagnostics`      | —                  |

## Settings

Open **Settings** (`Cmd+,`) and search "ReviewMate".

| Setting                       | Default                     | Description                                       |
|-------------------------------|-----------------------------|---------------------------------------------------|
| `reviewmate.provider`         | `gemini`                    | One of `gemini`, `groq`, `claude`, `ollama`       |
| `reviewmate.apiKey`           | `""`                        | API key for the selected provider (not Ollama)    |
| `reviewmate.ollamaModel`      | `codellama`                 | Model name when using Ollama                      |
| `reviewmate.ollamaUrl`        | `http://localhost:11434`    | Ollama server URL                                 |

## Documentation

- **[Skills](docs/skills.md)** — full feature reference and what every command does
- **[Architecture](docs/architecture.md)** — provider pattern, data flow, file responsibilities
- **[Technical](docs/technical.md)** — stack, build, models, release workflow

## Privacy

ReviewMate sends only the code you select (and the language ID) to the provider you choose. **No telemetry. No analytics. No proxy servers.** With Ollama, no data leaves your machine. Your API key lives in VS Code's local settings — never logged, never shared.

## Contributing

Issues and PRs welcome at https://github.com/trongbui1105/ReviewMate.

To run locally:

```bash
git clone https://github.com/trongbui1105/ReviewMate.git
cd ReviewMate
npm install
npm run compile
```

Then open the folder in VS Code and press **F5** to launch the Extension Development Host. See [docs/architecture.md](docs/architecture.md) for an overview of how the codebase is organized.

## License

[MIT](LICENSE)
