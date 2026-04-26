import * as vscode from 'vscode';
import { Issue } from './types';

/**
 * Owns the ReviewMate DiagnosticCollection and the CodeActionProvider that
 * exposes "View fix suggestion" quick-fixes for each diagnostic.
 */
export class DiagnosticsManager {
  private readonly collection: vscode.DiagnosticCollection;
  private readonly subscriptions: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.collection = vscode.languages.createDiagnosticCollection('reviewmate');
    this.subscriptions.push(this.collection);

    // CodeActionProvider for the "View fix suggestion" quick-fix.
    const provider = vscode.languages.registerCodeActionsProvider(
      { scheme: '*' },
      {
        provideCodeActions(
          document: vscode.TextDocument,
          _range: vscode.Range,
          ctx: vscode.CodeActionContext
        ): vscode.CodeAction[] {
          return ctx.diagnostics
            .filter((d) => d.source === 'ReviewMate' && typeof d.code === 'string' && d.code)
            .map((d) => {
              const action = new vscode.CodeAction(
                'ReviewMate: View fix suggestion',
                vscode.CodeActionKind.QuickFix
              );
              action.diagnostics = [d];
              action.command = {
                command: 'reviewmate.openSuggestion',
                title: 'Open fix suggestion',
                arguments: [d.code as string, document.languageId],
              };
              return action;
            });
        },
      },
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
    );
    this.subscriptions.push(provider);

    const openSuggestion = vscode.commands.registerCommand(
      'reviewmate.openSuggestion',
      async (fixText: string, languageId: string) => {
        const doc = await vscode.workspace.openTextDocument({
          content: fixText,
          language: languageId,
        });
        await vscode.window.showTextDocument(doc, {
          preview: true,
          viewColumn: vscode.ViewColumn.Beside,
        });
      }
    );
    this.subscriptions.push(openSuggestion);

    context.subscriptions.push(...this.subscriptions);
  }

  /**
   * Renders the given issues as diagnostics on the editor's document.
   * Replaces any existing ReviewMate diagnostics on that document.
   */
  showIssues(issues: Issue[], editor: vscode.TextEditor): void {
    const lineCount = editor.document.lineCount;
    const diagnostics: vscode.Diagnostic[] = issues.map((issue) => {
      const startLine = Math.max(0, issue.line - 1);
      const endLine = Math.max(
        startLine,
        Math.min((issue.endLine ?? issue.line) - 1, lineCount - 1)
      );
      const range = new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);

      const diag = new vscode.Diagnostic(
        range,
        `[${issue.category}] ${issue.message} — Fix: ${issue.fix}`,
        DiagnosticsManager.severityFor(issue.severity)
      );
      diag.source = 'ReviewMate';
      diag.code = issue.fix;
      return diag;
    });

    this.collection.set(editor.document.uri, diagnostics);
  }

  /** Clears all ReviewMate diagnostics from every document. */
  clear(): void {
    this.collection.clear();
  }

  /** Disposes the diagnostic collection and registered providers. */
  dispose(): void {
    for (const sub of this.subscriptions) {
      sub.dispose();
    }
  }

  private static severityFor(severity: Issue['severity']): vscode.DiagnosticSeverity {
    switch (severity) {
      case 'critical':
        return vscode.DiagnosticSeverity.Error;
      case 'warning':
        return vscode.DiagnosticSeverity.Warning;
      default:
        return vscode.DiagnosticSeverity.Information;
    }
  }
}
