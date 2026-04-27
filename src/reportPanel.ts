import * as vscode from 'vscode';
import { ReviewResult, Issue, ProviderName } from './types';

const PROVIDER_LABELS: Record<ProviderName, string> = {
  gemini: 'Gemini',
  groq: 'Groq',
  claude: 'Claude',
  openai: 'OpenAI',
  ollama: 'Ollama (local)',
};

const SEVERITY_ORDER: ReadonlyArray<Issue['severity']> = ['critical', 'warning', 'info'];

/**
 * Owns a singleton WebviewPanel that shows the current review as a full
 * editor tab. Reusing the same panel avoids stacking up tabs as the user
 * runs multiple reviews.
 */
export class ReportPanel {
  private panel?: vscode.WebviewPanel;
  private lastResult?: ReviewResult;
  private lastFileName?: string;

  /** Updates the cached result; refreshes the panel if it's currently open. */
  update(result: ReviewResult, fileName: string): void {
    this.lastResult = result;
    this.lastFileName = fileName;
    if (this.panel) {
      this.panel.webview.html = this.buildHtml();
    }
  }

  /** Returns the last review result, or undefined if no review has run. */
  getLastResult(): { result: ReviewResult; fileName: string } | undefined {
    if (!this.lastResult) {
      return undefined;
    }
    return { result: this.lastResult, fileName: this.lastFileName ?? '' };
  }

  /**
   * Reveals the report panel, creating it if needed. If there is no review
   * yet, shows an informational message instead.
   */
  show(): void {
    if (!this.lastResult) {
      vscode.window.showInformationMessage(
        'ReviewMate: Run a review first (Ctrl+Shift+R), then open the report.'
      );
      return;
    }

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'reviewmateReport',
      'ReviewMate Report',
      vscode.ViewColumn.Active,
      { enableScripts: false, retainContextWhenHidden: true }
    );
    this.panel.webview.html = this.buildHtml();

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private buildHtml(): string {
    const result = this.lastResult;
    if (!result) {
      return '<p>No review available.</p>';
    }

    const providerLabel = PROVIDER_LABELS[result.provider];
    const total = result.issues.length;

    const counts = SEVERITY_ORDER.reduce<Record<Issue['severity'], number>>(
      (acc, sev) => {
        acc[sev] = result.issues.filter((i) => i.severity === sev).length;
        return acc;
      },
      { critical: 0, warning: 0, info: 0 }
    );

    const groups = SEVERITY_ORDER.map((sev) => {
      const items = result.issues.filter((i) => i.severity === sev);
      if (items.length === 0) {
        return '';
      }
      const label = sev.charAt(0).toUpperCase() + sev.slice(1);
      return `
        <section class="group ${sev}">
          <h2>${label} <span class="count">${items.length}</span></h2>
          ${items.map(renderIssue).join('')}
        </section>`;
    }).join('');

    const body =
      total === 0
        ? `<p class="no-issues">No issues found. </p>`
        : groups;

    const fileLine = this.lastFileName
      ? `<p class="meta">File: <code>${escapeHtml(this.lastFileName)}</code></p>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family, -apple-system, sans-serif);
      font-size: 14px;
      line-height: 1.5;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      max-width: 880px;
      margin: 0 auto;
      padding: 32px 24px 64px;
    }

    header {
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    h1 { font-size: 1.6rem; margin-bottom: 4px; }
    .meta {
      font-size: 0.85rem;
      color: var(--vscode-descriptionForeground);
    }
    .meta code {
      font-family: var(--vscode-editor-font-family, monospace);
    }

    .stats {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin: 12px 0 8px;
    }
    .stat {
      padding: 4px 12px;
      border-radius: 14px;
      font-size: 0.78rem;
      font-weight: 500;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .stat.critical { background: #5a1d1d; color: #f8b8b8; }
    .stat.warning  { background: #5a4a0e; color: #f5e08c; }
    .stat.info     { background: #1c3a5e; color: #b3d4f1; }
    .stat.total    { background: var(--vscode-editorWidget-background, #2d2d2d); }

    .summary {
      font-style: italic;
      color: var(--vscode-descriptionForeground);
      margin: 16px 0;
      padding: 12px 16px;
      border-left: 3px solid var(--vscode-textLink-foreground);
      background: var(--vscode-editorWidget-background, rgba(255,255,255,0.04));
      border-radius: 0 6px 6px 0;
    }

    .group {
      margin-bottom: 32px;
    }
    .group h2 {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .group.critical h2 { color: var(--vscode-editorError-foreground, #f44747); }
    .group.warning  h2 { color: var(--vscode-editorWarning-foreground, #cca700); }
    .group.info     h2 { color: var(--vscode-editorInfo-foreground, #75beff); }

    .count {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 8px;
      border-radius: 10px;
      font-size: 0.72rem;
    }

    .issue {
      border-left: 3px solid transparent;
      padding: 12px 16px;
      margin-bottom: 12px;
      background: var(--vscode-editorWidget-background, rgba(255,255,255,0.04));
      border-radius: 0 6px 6px 0;
    }
    .issue.critical { border-color: var(--vscode-editorError-foreground, #f44747); }
    .issue.warning  { border-color: var(--vscode-editorWarning-foreground, #cca700); }
    .issue.info     { border-color: var(--vscode-editorInfo-foreground, #75beff); }

    .issue-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
      flex-wrap: wrap;
    }
    .tag {
      font-size: 0.72rem;
      padding: 2px 8px;
      border-radius: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .line-ref {
      font-size: 0.78rem;
      color: var(--vscode-descriptionForeground);
      margin-left: auto;
      font-family: var(--vscode-editor-font-family, monospace);
    }

    .issue-message {
      font-size: 0.95rem;
      margin-bottom: 8px;
    }

    .fix-label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    .fix {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.85rem;
      background: var(--vscode-textCodeBlock-background, rgba(0,0,0,0.3));
      padding: 8px 12px;
      border-radius: 4px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .no-issues {
      text-align: center;
      padding: 64px 0;
      color: var(--vscode-descriptionForeground);
      font-size: 1rem;
    }

    footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-panel-border);
      font-size: 0.78rem;
      color: var(--vscode-descriptionForeground);
      text-align: center;
    }
  </style>
</head>
<body>
  <header>
    <h1>Review Report</h1>
    ${fileLine}
    <div class="stats">
      <span class="stat total">${total} ${total === 1 ? 'issue' : 'issues'}</span>
      ${counts.critical > 0 ? `<span class="stat critical">${counts.critical} critical</span>` : ''}
      ${counts.warning  > 0 ? `<span class="stat warning">${counts.warning} warning</span>` : ''}
      ${counts.info     > 0 ? `<span class="stat info">${counts.info} info</span>` : ''}
    </div>
  </header>

  ${result.summary ? `<p class="summary">${escapeHtml(result.summary)}</p>` : ''}

  ${body}

  <footer>Reviewed by ${escapeHtml(providerLabel)}</footer>
</body>
</html>`;
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
    <span class="tag">${escapeHtml(issue.category)}</span>
    <span class="line-ref">${lineRef}</span>
  </div>
  <p class="issue-message">${escapeHtml(issue.message)}</p>
  <p class="fix-label">Suggested fix</p>
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
