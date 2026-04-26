import * as vscode from 'vscode';
import { review } from './reviewer';
import { DiagnosticsManager } from './diagnostics';
import { UsageTracker } from './usageTracker';
import { SidebarPanel } from './sidebarPanel';
import { ReportPanel } from './reportPanel';
import { OutputLog } from './outputLog';
import { ProviderName } from './types';

const LARGE_FILE_LINE_THRESHOLD = 500;

interface ProviderPickItem extends vscode.QuickPickItem {
  value: ProviderName;
  needsKey: boolean;
}

const PROVIDER_PICKS: ProviderPickItem[] = [
  { label: 'Gemini Flash',   description: 'Free — 1M tokens/day',         value: 'gemini', needsKey: true  },
  { label: 'Groq (Llama 3)', description: 'Free — 14,400 req/day',        value: 'groq',   needsKey: true  },
  { label: 'Claude Haiku',   description: 'Paid — best quality',          value: 'claude', needsKey: true  },
  { label: 'Ollama (local)', description: 'Free — runs on your machine',  value: 'ollama', needsKey: false },
];

/** Extension activation entry point. */
export function activate(context: vscode.ExtensionContext): void {
  const diagnosticsManager = new DiagnosticsManager(context);
  const usageTracker = new UsageTracker(context);
  const sidebarPanel = new SidebarPanel(usageTracker);
  const reportPanel = new ReportPanel();
  const outputLog = new OutputLog(context);

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

  // ── reviewmate.reviewCode ──────────────────────────────────────────────
  const reviewCmd = vscode.commands.registerCommand('reviewmate.reviewCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('ReviewMate: Open a file to review.');
      return;
    }

    const selection = editor.selection;
    let code = selection.isEmpty
      ? editor.document.getText()
      : editor.document.getText(selection);

    if (!code.trim()) {
      vscode.window.showWarningMessage('ReviewMate: Nothing to review — selection is empty.');
      return;
    }

    // For very large files, require a selection rather than blasting the whole doc.
    if (selection.isEmpty && editor.document.lineCount > LARGE_FILE_LINE_THRESHOLD) {
      vscode.window.showWarningMessage(
        `ReviewMate: File is over ${LARGE_FILE_LINE_THRESHOLD} lines. Select the section you want to review.`
      );
      return;
    }

    const languageId = editor.document.languageId;
    diagnosticsManager.clear();

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'ReviewMate: reviewing…',
        cancellable: false,
      },
      async () => {
        const result = await review(code, languageId, context);
        const fileName = vscode.workspace.asRelativePath(editor.document.uri);
        diagnosticsManager.showIssues(result.issues, editor);
        sidebarPanel.update(result);
        reportPanel.update(result, fileName);
        outputLog.logReview(result, fileName);
        usageTracker.increment();

        const count = result.issues.length;
        const message =
          count === 0
            ? 'ReviewMate: No issues found.'
            : `ReviewMate: ${count} issue${count === 1 ? '' : 's'} found.`;
        vscode.window.setStatusBarMessage(message, 5000);
      }
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
      await config.update(
        'provider',
        pick.value,
        vscode.ConfigurationTarget.Global
      );

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

  // ── reviewmate.clearDiagnostics ────────────────────────────────────────
  const clearCmd = vscode.commands.registerCommand('reviewmate.clearDiagnostics', () => {
    diagnosticsManager.clear();
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
    changeProviderCmd,
    clearCmd,
    openReportCmd,
    showLogCmd,
    { dispose: () => diagnosticsManager.dispose() }
  );
}

/** Extension deactivation hook. */
export function deactivate(): void {
  // DiagnosticsManager is disposed via context.subscriptions.
}
