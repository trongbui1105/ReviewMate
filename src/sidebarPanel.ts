import * as vscode from 'vscode';
import { ReviewResult, Issue, ProviderName } from './types';
import { UsageTracker } from './usageTracker';

const PROVIDER_LABELS: Record<ProviderName, string> = {
  gemini: 'Gemini',
  groq: 'Groq',
  claude: 'Claude',
  openai: 'OpenAI',
  ollama: 'Ollama (local)',
};

const SEVERITY_ORDER: ReadonlyArray<Issue['severity']> = ['critical', 'warning', 'info'];

/**
 * Sidebar webview that displays the most recent review and the active provider.
 */
export class SidebarPanel implements vscode.WebviewViewProvider {
  public static readonly viewId = 'reviewmateView';

  private view?: vscode.WebviewView;
  private lastResult?: ReviewResult;

  constructor(private readonly usageTracker: UsageTracker) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.render();

    webviewView.webview.onDidReceiveMessage((msg: { command: string }) => {
      if (msg.command === 'changeProvider') {
        void vscode.commands.executeCommand('reviewmate.changeProvider');
      } else if (msg.command === 'openReport') {
        void vscode.commands.executeCommand('reviewmate.openReport');
      }
    });
  }

  /** Pushes a new review result into the sidebar and re-renders. */
  update(result: ReviewResult): void {
    this.lastResult = result;
    this.render();
  }

  private render(): void {
    if (!this.view) {
      return;
    }
    this.view.webview.html = this.buildHtml();
  }

  private buildHtml(): string {
    const providerName = this.usageTracker.getProviderName();
    const providerLabel = PROVIDER_LABELS[providerName];
    const result = this.lastResult;

    const body =
      !result || result.issues.length === 0
        ? this.placeholderBody(result)
        : this.resultBody(result);

    const credit = result
      ? `<p class="credit">Reviewed by ${escapeHtml(PROVIDER_LABELS[result.provider])}</p>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      color: var(--vscode-editor-foreground);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 100vh;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    header h2 { font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .provider-badge {
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 8px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-weight: 500;
      text-transform: lowercase;
    }
    .header-links { display: flex; gap: 10px; }
    header a {
      font-size: 0.78rem;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      text-decoration: none;
    }
    header a:hover { text-decoration: underline; }

    .summary {
      font-style: italic;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }

    .placeholder {
      color: var(--vscode-descriptionForeground);
      text-align: center;
      padding: 24px 0;
      line-height: 1.5;
    }
    kbd {
      background: var(--vscode-keybindingLabel-background, #333);
      color: var(--vscode-keybindingLabel-foreground, #ccc);
      border: 1px solid var(--vscode-keybindingLabel-border, #555);
      border-radius: 3px;
      padding: 1px 5px;
      font-size: 0.8em;
      font-family: monospace;
    }

    .group-title {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 8px 0 4px;
      color: var(--vscode-descriptionForeground);
    }

    .issue {
      border-left: 3px solid transparent;
      padding: 6px 8px;
      margin-bottom: 6px;
      background: var(--vscode-editorWidget-background, rgba(255,255,255,0.04));
      border-radius: 0 4px 4px 0;
    }
    .issue.critical { border-color: var(--vscode-editorError-foreground, #f44747); }
    .issue.warning  { border-color: var(--vscode-editorWarning-foreground, #cca700); }
    .issue.info     { border-color: var(--vscode-editorInfo-foreground, #75beff); }

    .issue-header {
      display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot.critical { background: var(--vscode-editorError-foreground, #f44747); }
    .dot.warning  { background: var(--vscode-editorWarning-foreground, #cca700); }
    .dot.info     { background: var(--vscode-editorInfo-foreground, #75beff); }

    .tag {
      font-size: 0.68rem;
      padding: 1px 6px;
      border-radius: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .line-ref {
      font-size: 0.72rem;
      color: var(--vscode-descriptionForeground);
      margin-left: auto;
    }

    .issue-message { font-size: 0.85rem; line-height: 1.3; margin-bottom: 4px; }

    .fix {
      font-size: 0.78rem;
      font-family: var(--vscode-editor-font-family, monospace);
      background: var(--vscode-textCodeBlock-background, rgba(0,0,0,0.3));
      padding: 4px 6px;
      border-radius: 3px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .credit {
      margin-top: auto;
      padding-top: 10px;
      border-top: 1px solid var(--vscode-panel-border);
      font-size: 0.72rem;
      color: var(--vscode-descriptionForeground);
      text-align: center;
    }
  </style>
</head>
<body>
  <header>
    <h2>ReviewMate <span class="provider-badge">${escapeHtml(providerName)}</span></h2>
    <div class="header-links">
      ${result ? `<a onclick="send('openReport')">Full report</a>` : ''}
      <a onclick="send('changeProvider')">Change provider</a>
    </div>
  </header>

  <main>${body}</main>

  ${credit}

  <script>
    const vscode = acquireVsCodeApi();
    function send(command) { vscode.postMessage({ command }); }
  </script>
</body>
</html>`;
  }

  private placeholderBody(result: ReviewResult | undefined): string {
    if (result && result.summary) {
      return `<p class="summary">${escapeHtml(result.summary)}</p>
              <p class="placeholder">No issues found. </p>`;
    }
    return `<p class="placeholder">Select code → press <kbd>Ctrl+Shift+R</kbd> to review.</p>`;
  }

  private resultBody(result: ReviewResult): string {
    const groups = new Map<Issue['severity'], Issue[]>();
    for (const sev of SEVERITY_ORDER) {
      groups.set(sev, []);
    }
    for (const issue of result.issues) {
      groups.get(issue.severity)?.push(issue);
    }

    const groupHtml = SEVERITY_ORDER.map((sev) => {
      const list = groups.get(sev) ?? [];
      if (list.length === 0) {
        return '';
      }
      const label = sev.charAt(0).toUpperCase() + sev.slice(1);
      return `<div class="group-title">${label} (${list.length})</div>${list.map(renderIssue).join('')}`;
    }).join('');

    const summary = result.summary
      ? `<p class="summary">${escapeHtml(result.summary)}</p>`
      : '';

    return `${summary}${groupHtml}`;
  }
}

function renderIssue(issue: Issue): string {
  const lineRef =
    !issue.endLine || issue.endLine === issue.line
      ? `Line ${issue.line}`
      : `Lines ${issue.line}–${issue.endLine}`;

  return `
<div class="issue ${escapeHtml(issue.severity)}">
  <div class="issue-header">
    <span class="dot ${escapeHtml(issue.severity)}"></span>
    <span class="tag">${escapeHtml(issue.category)}</span>
    <span class="line-ref">${lineRef}</span>
  </div>
  <p class="issue-message">${escapeHtml(issue.message)}</p>
  <pre class="fix">${escapeHtml(issue.fix)}</pre>
</div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
