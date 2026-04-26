import * as vscode from 'vscode';
import { ReviewResult, Issue } from './types';

/**
 * Wraps a VS Code OutputChannel and provides a helper for logging review
 * results in a readable, scrollable plain-text format.
 */
export class OutputLog {
  private readonly channel: vscode.OutputChannel;

  constructor(context: vscode.ExtensionContext) {
    this.channel = vscode.window.createOutputChannel('ReviewMate');
    context.subscriptions.push(this.channel);
  }

  /**
   * Logs a single review run. Includes timestamp, provider, file, summary,
   * counts by severity, and every individual issue.
   */
  logReview(result: ReviewResult, fileName: string): void {
    const ts = new Date().toISOString();
    const total = result.issues.length;
    const critical = result.issues.filter((i) => i.severity === 'critical').length;
    const warning = result.issues.filter((i) => i.severity === 'warning').length;
    const info = result.issues.filter((i) => i.severity === 'info').length;

    this.channel.appendLine('═══════════════════════════════════════════════════════════');
    this.channel.appendLine(`[${ts}] ${result.provider}  →  ${fileName}`);
    this.channel.appendLine('───────────────────────────────────────────────────────────');
    if (result.summary) {
      this.channel.appendLine(`Summary: ${result.summary}`);
    }
    this.channel.appendLine(
      `Issues:  ${total} total  (${critical} critical, ${warning} warning, ${info} info)`
    );
    this.channel.appendLine('');

    for (const issue of result.issues) {
      this.channel.appendLine(this.formatIssue(issue));
      this.channel.appendLine('');
    }
  }

  /** Reveals the output panel and switches to the ReviewMate channel. */
  show(): void {
    this.channel.show(true);
  }

  private formatIssue(issue: Issue): string {
    const lineRef =
      !issue.endLine || issue.endLine === issue.line
        ? `line ${issue.line}`
        : `lines ${issue.line}-${issue.endLine}`;

    return [
      `  [${issue.severity.toUpperCase()}] [${issue.category}] ${lineRef}`,
      `    ${issue.message}`,
      `    Fix: ${issue.fix}`,
    ].join('\n');
  }
}
