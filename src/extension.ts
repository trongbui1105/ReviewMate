import * as vscode from 'vscode';
import { review } from './reviewer';
import { DiagnosticsManager } from './diagnostics';
import { UsageTracker } from './usageTracker';
import { SidebarPanel } from './sidebarPanel';
import { ReportPanel } from './reportPanel';
import { OutputLog } from './outputLog';
import { ProviderName, ReviewResult } from './types';
import { getDiff } from './git';
import { renderMarkdown } from './exporter';

const LARGE_FILE_LINE_THRESHOLD = 500;

interface ProviderPickItem extends vscode.QuickPickItem {
  value: ProviderName;
  needsKey: boolean;
}

const PROVIDER_PICKS: ProviderPickItem[] = [
  { label: 'Gemini',         description: 'Free — 1M tokens/day',         value: 'gemini', needsKey: true  },
  { label: 'Groq (Llama 3)', description: 'Free — 14,400 req/day',        value: 'groq',   needsKey: true  },
  { label: 'Claude',         description: 'Paid — top quality',           value: 'claude', needsKey: true  },
  { label: 'OpenAI',         description: 'Paid — broad model lineup',    value: 'openai', needsKey: true  },
  { label: 'Ollama (local)', description: 'Free — runs on your machine',  value: 'ollama', needsKey: false },
];

/** Extension activation entry point. */
export function activate(context: vscode.ExtensionContext): void {
  const diagnosticsManager = new DiagnosticsManager(context);
  const usageTracker = new UsageTracker(context);
  const sidebarPanel = new SidebarPanel(usageTracker);
  const reportPanel = new ReportPanel();
  const outputLog = new OutputLog(context);

  // ── Status bar item ─────────────────────────────────────────────────────
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBar.command = 'reviewmate.reviewCode';
  statusBar.text = '$(eye) ReviewMate';
  statusBar.tooltip = 'Run ReviewMate on the active file (Cmd+Shift+R)';
  statusBar.show();
  context.subscriptions.push(statusBar);

  function updateStatusBar(result: ReviewResult): void {
    const count = result.issues.length;
    const critical = result.issues.filter((i) => i.severity === 'critical').length;
    if (count === 0) {
      statusBar.text = '$(check) ReviewMate: clean';
    } else if (critical > 0) {
      statusBar.text = `$(error) ReviewMate: ${count} (${critical} critical)`;
    } else {
      statusBar.text = `$(warning) ReviewMate: ${count}`;
    }
  }

  // ── Sidebar webview registration ───────────────────────────────────────
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarPanel.viewId, sidebarPanel)
  );

  // Re-render the sidebar when the user changes the provider in settings.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('reviewmate.provider')) {
        sidebarPanel.update({
          issues: [],
          summary: '',
          provider: usageTracker.getProviderName(),
        });
      }
    })
  );

  // ── Shared review-runner used by both reviewCode and reviewDiff ────────
  async function runReview(
    code: string,
    languageId: string,
    editor: vscode.TextEditor,
    progressTitle: string,
    mode: 'full' | 'diff'
  ): Promise<void> {
    diagnosticsManager.clear();
    const totalLines = editor.document.lineCount;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: progressTitle,
        cancellable: false,
      },
      async () => {
        const raw = await review(code, languageId, context, { mode, totalLines });

        // Defensive filter: drop any issue with a line number outside the
        // file. Weaker models occasionally hallucinate line numbers past
        // the end of the file. Skip this filter in diff mode since line
        // numbers there refer to the new-file state which we can't validate.
        const result =
          mode === 'diff'
            ? raw
            : {
                ...raw,
                issues: raw.issues.filter(
                  (i) => i.line >= 1 && i.line <= totalLines
                ),
              };

        const fileName = vscode.workspace.asRelativePath(editor.document.uri);
        diagnosticsManager.showIssues(result.issues, editor);
        sidebarPanel.update(result);
        reportPanel.update(result, fileName);
        outputLog.logReview(result, fileName);
        usageTracker.increment();
        updateStatusBar(result);

        const dropped = raw.issues.length - result.issues.length;
        const count = result.issues.length;
        const droppedNote = dropped > 0 ? ` (${dropped} hallucinated line numbers dropped)` : '';
        const message =
          count === 0
            ? `ReviewMate: No issues found.${droppedNote}`
            : `ReviewMate: ${count} issue${count === 1 ? '' : 's'} found.${droppedNote}`;
        vscode.window.setStatusBarMessage(message, 5000);
      }
    );
  }

  // ── reviewmate.reviewCode ──────────────────────────────────────────────
  const reviewCmd = vscode.commands.registerCommand('reviewmate.reviewCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('ReviewMate: Open a file to review.');
      return;
    }

    const selection = editor.selection;
    const code = selection.isEmpty
      ? editor.document.getText()
      : editor.document.getText(selection);

    if (!code.trim()) {
      vscode.window.showWarningMessage('ReviewMate: Nothing to review — selection is empty.');
      return;
    }

    if (selection.isEmpty && editor.document.lineCount > LARGE_FILE_LINE_THRESHOLD) {
      vscode.window.showWarningMessage(
        `ReviewMate: File is over ${LARGE_FILE_LINE_THRESHOLD} lines. Select the section you want to review.`
      );
      return;
    }

    await runReview(code, editor.document.languageId, editor, 'ReviewMate: reviewing…', 'full');
  });

  // ── reviewmate.reviewDiff ──────────────────────────────────────────────
  const reviewDiffCmd = vscode.commands.registerCommand('reviewmate.reviewDiff', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('ReviewMate: Open a file to review.');
      return;
    }

    if (editor.document.uri.scheme !== 'file') {
      vscode.window.showWarningMessage(
        'ReviewMate: Diff review only works on saved files.'
      );
      return;
    }

    let diff: string;
    try {
      diff = await getDiff(editor.document.uri.fsPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`ReviewMate: ${message}`);
      return;
    }

    if (!diff.trim()) {
      vscode.window.showInformationMessage(
        'ReviewMate: No uncommitted changes to review on this file.'
      );
      return;
    }

    await runReview(
      diff,
      editor.document.languageId,
      editor,
      'ReviewMate: reviewing diff…',
      'diff'
    );
  });

  // ── reviewmate.changeProvider ──────────────────────────────────────────
  const changeProviderCmd = vscode.commands.registerCommand(
    'reviewmate.changeProvider',
    async () => {
      const pick = await vscode.window.showQuickPick(PROVIDER_PICKS, {
        title: 'ReviewMate: Choose a provider',
        placeHolder: 'Select the AI you want to use for code review',
      });
      if (!pick) {
        return;
      }

      const config = vscode.workspace.getConfiguration('reviewmate');
      await config.update('provider', pick.value, vscode.ConfigurationTarget.Global);

      if (pick.needsKey) {
        const existing = config.get<string>('apiKey', '');
        const key = await vscode.window.showInputBox({
          title: `Enter API key for ${pick.label}`,
          placeHolder: existing ? '(leave empty to keep current key)' : 'sk-...',
          password: true,
          ignoreFocusOut: true,
        });
        if (typeof key === 'string' && key.length > 0) {
          await config.update('apiKey', key, vscode.ConfigurationTarget.Global);
        }
      }

      vscode.window.showInformationMessage(
        `ReviewMate: Provider set to ${pick.label}. You're ready to review!`
      );
    }
  );

  // ── reviewmate.exportReport ────────────────────────────────────────────
  const exportCmd = vscode.commands.registerCommand('reviewmate.exportReport', async () => {
    const last = reportPanel.getLastResult();
    if (!last) {
      vscode.window.showWarningMessage(
        'ReviewMate: Run a review first, then export.'
      );
      return;
    }

    const md = renderMarkdown(last.result, last.fileName);

    const editor = vscode.window.activeTextEditor;
    const defaultUri =
      editor && editor.document.uri.scheme === 'file'
        ? vscode.Uri.file(`${editor.document.uri.fsPath}.review.md`)
        : undefined;

    const target = await vscode.window.showSaveDialog({
      title: 'Save ReviewMate report',
      defaultUri,
      filters: { Markdown: ['md'] },
    });
    if (!target) {
      return;
    }

    await vscode.workspace.fs.writeFile(target, Buffer.from(md, 'utf8'));
    const open = await vscode.window.showInformationMessage(
      `ReviewMate: Report saved to ${vscode.workspace.asRelativePath(target)}`,
      'Open'
    );
    if (open === 'Open') {
      const doc = await vscode.workspace.openTextDocument(target);
      await vscode.window.showTextDocument(doc);
    }
  });

  // ── reviewmate.clearDiagnostics ────────────────────────────────────────
  const clearCmd = vscode.commands.registerCommand('reviewmate.clearDiagnostics', () => {
    diagnosticsManager.clear();
    statusBar.text = '$(eye) ReviewMate';
  });

  // ── reviewmate.openReport ──────────────────────────────────────────────
  const openReportCmd = vscode.commands.registerCommand('reviewmate.openReport', () => {
    reportPanel.show();
  });

  // ── reviewmate.showLog ─────────────────────────────────────────────────
  const showLogCmd = vscode.commands.registerCommand('reviewmate.showLog', () => {
    outputLog.show();
  });

  context.subscriptions.push(
    reviewCmd,
    reviewDiffCmd,
    changeProviderCmd,
    clearCmd,
    openReportCmd,
    showLogCmd,
    exportCmd,
    { dispose: () => diagnosticsManager.dispose() }
  );
}

/** Extension deactivation hook. */
export function deactivate(): void {
  // DiagnosticsManager is disposed via context.subscriptions.
}
