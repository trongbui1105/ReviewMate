# Technical reference

## Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript 5+ (strict) | VS Code's recommended path; catches the JSON-shape mistakes that AI responses love to make |
| Build | `tsc` (no bundler) | Codebase is ~2k LOC; bundler is over-engineering. Faster debug, no source-map dance. |
| Runtime | Node (via VS Code's host) | VS Code 1.85+ ships with Node 18+, so global `fetch` is available |
| API surface | VS Code Extension API ^1.85.0 | Webview views, diagnostics, code actions, output channel — all stable APIs |

## Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "@google/generative-ai": "^0.21.0",
    "groq-sdk": "^0.9.0"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@types/node": "^20",
    "typescript": "^5"
  }
}
```

**Ollama uses `fetch` directly** — no SDK needed. Saves a dep and a transitive tree.

## Build pipeline

```
src/*.ts ──┐
           │   tsc -p ./
.vscodeignore   ───────►  out/*.js   ─── vsce package ──► reviewmate-X.Y.Z.vsix
package.json ──┘                              ↑
                                       (excludes src/, node_modules/,
                                        per .vscodeignore)
```

- `npm run compile` → `tsc -p ./` → emits to `./out`
- `vsce package` → bundles everything except what's in `.vscodeignore` → produces `.vsix`
- The `.vsix` is what gets uploaded to the Marketplace

## File outputs by stage

| Stage | Files produced | Committed? |
|---|---|---|
| Source authoring | `src/**/*.ts` | ✅ yes |
| `npm install` | `node_modules/`, `package-lock.json` | `package-lock.json` only |
| `tsc -p ./` | `out/**/*.js`, `out/**/*.js.map` | ❌ ignored |
| `vsce package` | `reviewmate-X.Y.Z.vsix` | ❌ ignored |

## TypeScript config

```json
{
  "target": "ES2020",
  "module": "commonjs",
  "outDir": "./out",
  "rootDir": "./src",
  "strict": true,
  "esModuleInterop": true,
  "skipLibCheck": true,
  "sourceMap": true
}
```

- **`module: commonjs`** is required by the VS Code extension host.
- **`target: ES2020`** matches what Node 18+ supports natively. Anything newer needs verification.
- **`skipLibCheck: true`** is a deliberate cost/benefit call — we trust upstream `.d.ts` files instead of type-checking them on every build.

## Models in use

| Provider | Model ID | As of |
|---|---|---|
| Gemini | `gemini-2.5-flash` | Apr 2026 |
| Groq | `llama3-70b-8192` | Apr 2026 |
| Claude | `claude-haiku-4-5-20251001` | Apr 2026 |
| Ollama | user-configurable, default `codellama` | n/a |

Hardcoded in each provider's class. To upgrade, change `MODEL` in the relevant file and bump the extension version.

## Publishing — current flow

We **do not use `vsce publish`** because the publisher account `trongbui` is tied to a personal Microsoft Account, while the Azure DevOps PAT is issued under a different identity (Entra tenant). Until those identities are unified, the working flow is:

1. `npm version patch` (or minor/major)
2. `npm run compile`
3. `vsce package`
4. Drag the resulting `.vsix` into https://marketplace.visualstudio.com/manage/publishers/trongbui

This is the reason `gh auth` and `vsce login` aren't part of the standard release path.

## VS Code engine compatibility

Declared in [package.json](../package.json):

```json
"engines": { "vscode": "^1.85.0" }
```

This means VS Code 1.85 (Nov 2023) and newer. We use only stable APIs from that version — no proposed APIs, no insiders-only features. Anyone on a recent VS Code can install this.

## Activation

```json
"activationEvents": ["onStartupFinished"]
```

The extension activates **after** VS Code finishes its main startup, not on a specific command. This adds zero perceived latency to startup but means the sidebar view is registered the moment VS Code is idle. Trade-off: the extension uses memory even if the user never runs a review. Worth it for instant `Cmd+Shift+R` response.

## Storage

| Mechanism | What's stored | Lifetime |
|---|---|---|
| `globalState` (`UsageTracker`) | `rm_usage_<YYYY-MM-DD>` (number) | Forever (per machine) |
| `OutputChannel` | Plain-text log of reviews | Until VS Code restart |
| `WebviewPanel` (report) | Last `ReviewResult` | Until extension deactivates |
| `WebviewView` (sidebar) | Last `ReviewResult` | Until extension deactivates |

**No `secretStorage` used yet** — API keys live in regular settings, which sync across machines if the user has Settings Sync turned on. If keys-via-syncing concerns ever come up, the migration is one file.

## Testing strategy

There are **no automated tests** in v0.1. The codebase is small, the surface area is human-driven (UI), and provider responses are non-deterministic — making test ROI low. The release ritual is:

1. Compile cleanly (`tsc` is the test)
2. Press **F5** in VS Code, run a review against a known-buggy file in the dev host
3. Verify all four UI surfaces update (diagnostics, sidebar, report, output)
4. Switch provider, run again — verify no leftover diagnostics from previous provider
5. Package + install the `.vsix` in a real VS Code window — repeat step 3 once

This catches every release-blocker we've ever shipped. If/when the codebase grows past ~3k LOC, automated tests (using `@vscode/test-electron`) become worth the setup.

## Known sharp edges

- **Provider switching doesn't auto-clear `apiKey`.** If you go from Gemini to Groq via Settings UI, the old Gemini key remains. The `Change Provider` quick-pick prompts for a new key, which avoids this. Future improvement: per-provider key storage.
- **OllamaProvider has no health check.** If the local server isn't running, you get a generic fetch error. Future improvement: check `/api/tags` before sending the review.
- **JSON parsing can swallow valid issues** if the AI emits a single malformed entry in an otherwise-good response. `parseResponse` filters per-issue, so most malformed entries get dropped silently rather than tanking the whole review.
- **No streaming.** Every provider waits for the full response. Fine for short reviews, slower for long files. Streaming would require restructuring all four UI surfaces to handle partial state.
