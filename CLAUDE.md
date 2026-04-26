# CLAUDE.md

Project-specific guidance for Claude Code (or any AI agent) working in this repository.

## What this is

**ReviewMate** is a VS Code extension that runs AI code reviews. Users pick a provider (Gemini / Groq / Claude / Ollama), bring their own API key, and trigger reviews with `Cmd+Shift+R`. Issues appear as inline diagnostics, in a sidebar, in a full-page report, and in an output channel.

Published as `trongbui.reviewmate` on the VS Code Marketplace.

## Common commands

```bash
npm install            # install deps (devDeps + provider SDKs)
npm run compile        # tsc -p ./   → outputs to ./out
npm run watch          # tsc in watch mode (during development)
vsce package           # produce reviewmate-<version>.vsix
```

To test locally:
1. Open this folder in VS Code
2. Press **F5** → opens the Extension Development Host
3. In the dev host: configure a provider via `ReviewMate: Change Provider`, then `Cmd+Shift+R` on a file

## Architecture in one paragraph

A single command (`reviewmate.reviewCode`) triggers `review()` in [src/reviewer.ts](src/reviewer.ts), which uses a factory ([src/providers/index.ts](src/providers/index.ts)) to instantiate the user's chosen `AIProvider`. Every provider implements the same interface defined in [src/types.ts](src/types.ts) — `review(code, languageId) → Promise<ReviewResult>`. The result fans out to four UI surfaces: diagnostics ([src/diagnostics.ts](src/diagnostics.ts)), sidebar webview ([src/sidebarPanel.ts](src/sidebarPanel.ts)), full-page report ([src/reportPanel.ts](src/reportPanel.ts)), and an output channel ([src/outputLog.ts](src/outputLog.ts)). See [docs/architecture.md](docs/architecture.md) for a full breakdown.

## Code style

- **TypeScript strict mode** is on. Don't disable it.
- **No `any`**. Use `unknown` + a narrowing function if a type is genuinely dynamic (see `parseResponse` in [src/promptBuilder.ts](src/promptBuilder.ts)).
- **JSDoc** on every exported function/class. One-line comments are fine; full param/return blocks aren't required.
- **No comments explaining WHAT** the code does — names should be self-evident. Comments only for non-obvious WHY.
- **Async functions** must be wrapped in try/catch. Errors surface to the user via `vscode.window.showErrorMessage` — never crash the extension on a provider failure.
- **No telemetry, no analytics, no network calls** other than the chosen provider. User code is sensitive.

## Adding a new provider

1. Create `src/providers/<Name>Provider.ts` implementing `AIProvider` from [src/types.ts](src/types.ts)
2. Add the name to the `ProviderName` union in [src/types.ts](src/types.ts)
3. Add a case in the factory switch in [src/providers/index.ts](src/providers/index.ts)
4. Add the provider to the `enum` for `reviewmate.provider` in [package.json](package.json)
5. Add a quick-pick entry in `PROVIDER_PICKS` in [src/extension.ts](src/extension.ts)
6. Add a label in `PROVIDER_LABELS` in [src/sidebarPanel.ts](src/sidebarPanel.ts) and [src/reportPanel.ts](src/reportPanel.ts)

The factory + interface make this self-contained; no other files need to know about the new provider.

## Releasing a new version

1. Bump version: `npm version patch` (or minor/major)
2. `npm run compile`
3. `vsce package`
4. Upload the resulting `.vsix` at https://marketplace.visualstudio.com/manage/publishers/trongbui

`vsce publish` from CLI requires a working PAT (see [docs/technical.md](docs/technical.md) for context on why we use the web upload flow instead).

## What NOT to do

- **Don't add a bundler** (webpack / esbuild). The codebase is small enough that `tsc` is fine and faster to debug.
- **Don't commit `node_modules/`, `out/`, or `*.vsix`** — `.gitignore` handles this.
- **Don't put API keys in source.** They live in VS Code settings (`reviewmate.apiKey`).
- **Don't break the `AIProvider` interface** without updating every provider class. The compiler catches this; respect the error.
- **Don't add features that send code anywhere except the chosen AI provider.** Privacy is a feature.

## Where to look for things

| If you need to… | Look at |
|---|---|
| Add a command | [src/extension.ts](src/extension.ts) + `contributes.commands` in [package.json](package.json) |
| Change the prompt | [src/promptBuilder.ts](src/promptBuilder.ts) |
| Change the sidebar UI | [src/sidebarPanel.ts](src/sidebarPanel.ts) |
| Change the full report UI | [src/reportPanel.ts](src/reportPanel.ts) |
| Change how diagnostics display | [src/diagnostics.ts](src/diagnostics.ts) |
| Add a new setting | `contributes.configuration` in [package.json](package.json) |
| Read a setting | `vscode.workspace.getConfiguration('reviewmate').get(...)` |
