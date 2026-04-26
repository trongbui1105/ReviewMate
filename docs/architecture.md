# Architecture

## Provider pattern

The defining design choice in ReviewMate is the **provider pattern**: every AI backend implements one interface, and the rest of the codebase doesn't know which one is in use.

```
                  ┌──────────────────┐
                  │   extension.ts   │  ← command handlers, UI wiring
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │   reviewer.ts    │  ← reads settings, picks provider, runs review
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ providers/index  │  ← factory: name → instance
                  └────────┬─────────┘
                           │
        ┌──────────────────┼─────────────────┬──────────────────┐
        ▼                  ▼                 ▼                  ▼
 GeminiProvider    GroqProvider       ClaudeProvider     OllamaProvider
        │                  │                 │                  │
        └─────────┬────────┴────────┬────────┴────────┬─────────┘
                  ▼                 ▼                 ▼
           buildPrompt()      parseResponse()    AIProvider interface
                            (strict, never throws)
```

The `AIProvider` interface (in [src/types.ts](../src/types.ts)) is two members:

```typescript
interface AIProvider {
  readonly name: ProviderName;
  review(code: string, languageId: string): Promise<ReviewResult>;
}
```

Adding a fifth provider (Mistral, OpenAI, etc.) requires zero changes to the rest of the codebase — the factory, settings enum, and pick list pull it in.

## Data flow on a single review

1. **User triggers** `reviewmate.reviewCode` (Ctrl+Shift+R) — handler in [src/extension.ts](../src/extension.ts).
2. **Code selection** — selected text, or whole document (warning if >500 lines and nothing selected).
3. **`review(code, languageId, context)`** → reads `reviewmate.provider` and `reviewmate.apiKey` from settings.
4. **Factory** creates the right provider instance.
5. **`provider.review(code, languageId)`** internally calls `buildPrompt()` to produce a single string prompt, sends it to the provider's API, and pipes the response through `parseResponse()`.
6. **`parseResponse()`** strips markdown fences, JSON.parses, validates each issue's shape. Returns an empty result on any failure — **it never throws**.
7. The result fans out to four UI surfaces (next section).
8. `usageTracker.increment()` bumps today's count in `globalState`.

## Four UI surfaces

Every successful review updates **all four**, so users see issues wherever they look:

| Surface | File | What it shows |
|---|---|---|
| **Diagnostics** | [src/diagnostics.ts](../src/diagnostics.ts) | Inline squiggles + Problems panel + quick-fix lightbulbs |
| **Sidebar** | [src/sidebarPanel.ts](../src/sidebarPanel.ts) | Compact issue list grouped by severity, in Explorer panel |
| **Report** | [src/reportPanel.ts](../src/reportPanel.ts) | Polished full-page report opened on demand in an editor tab |
| **Output log** | [src/outputLog.ts](../src/outputLog.ts) | Plain-text scrollable history (`View → Output → ReviewMate`) |

Each surface holds the latest `ReviewResult` independently — the report panel and sidebar don't share state with each other. This is intentional: it keeps each surface trivially simple. Cost: ~100 LOC of duplicated rendering helpers between sidebar and report. Not worth abstracting yet.

## File-by-file responsibilities

```
src/
├── extension.ts          activate(): registers commands, webviews, and disposables
├── reviewer.ts           top-level review() — handles missing keys, surfaces errors
├── promptBuilder.ts      buildPrompt() + parseResponse() — the only place prompts live
├── types.ts              Issue, ReviewResult, AIProvider, ProviderName, Severity, Category
├── diagnostics.ts        DiagnosticsManager + CodeActionProvider for "View fix suggestion"
├── sidebarPanel.ts       SidebarPanel: WebviewViewProvider for the Explorer view
├── reportPanel.ts        ReportPanel: singleton WebviewPanel opened in editor area
├── outputLog.ts          OutputLog: wraps vscode.OutputChannel
├── usageTracker.ts       Daily counter in globalState (no enforcement currently — gated future)
└── providers/
    ├── index.ts          createProvider() factory
    ├── GeminiProvider.ts gemini-2.5-flash via @google/generative-ai
    ├── GroqProvider.ts   llama3-70b-8192 via groq-sdk
    ├── ClaudeProvider.ts claude-haiku-4-5-20251001 via @anthropic-ai/sdk
    └── OllamaProvider.ts plain fetch → /api/generate (no SDK)
```

## Boundary discipline

- **Settings reads happen in two places**: [src/reviewer.ts](../src/reviewer.ts) (provider + apiKey) and [src/providers/index.ts](../src/providers/index.ts) (Ollama url/model). UI code (sidebar/report) reads display-only values via `usageTracker.getProviderName()` — never reaches into settings directly.
- **Prompts live in one file**: [src/promptBuilder.ts](../src/promptBuilder.ts). All four providers send the same prompt. If you want provider-specific prompts later, this is where to branch.
- **Parsing is shared**: every provider calls `parseResponse(text, this.name)`. JSON validation only exists once.
- **No global state**: `globalState` (used by `UsageTracker`) is the only persistent storage. No singletons, no module-level mutable state.

## Failure modes and how they're handled

| What goes wrong | Where caught | User sees |
|---|---|---|
| Missing API key | [src/reviewer.ts](../src/reviewer.ts) | Modal error with "Open Settings" button |
| Provider 4xx/5xx | Provider class | `ReviewMate: <Provider>: <message>` toast |
| Malformed JSON from AI | `parseResponse()` | Empty result, "No issues found" — no crash |
| File too large (>500 lines) | [src/extension.ts](../src/extension.ts) | Warning asking user to select a chunk |
| Empty selection | [src/extension.ts](../src/extension.ts) | Warning, no API call made |

The extension is designed to **degrade gracefully**: a provider outage shows a friendly message and lets the user retry or switch providers — it never breaks VS Code or leaves diagnostics in a half-updated state.
