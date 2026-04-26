import * as vscode from 'vscode';
import { ReviewResult, ProviderName } from './types';
import { createProvider } from './providers';

/**
 * Top-level review function used by the extension command. Selects the
 * configured provider, runs the review, and surfaces any failures as
 * VS Code error messages instead of throwing.
 *
 * @param code        - Source code to review.
 * @param languageId  - VS Code language identifier.
 * @param context     - Extension context (forwarded to the provider factory).
 */
export async function review(
  code: string,
  languageId: string,
  context: vscode.ExtensionContext
): Promise<ReviewResult> {
  const config = vscode.workspace.getConfiguration('reviewmate');
  const providerName = config.get<ProviderName>('provider', 'gemini');
  const apiKey = config.get<string>('apiKey', '');

  const empty: ReviewResult = { issues: [], summary: '', provider: providerName };

  if (providerName !== 'ollama' && !apiKey) {
    const action = await vscode.window.showErrorMessage(
      `ReviewMate: No API key configured for ${providerName}.`,
      'Open Settings'
    );
    if (action === 'Open Settings') {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'reviewmate.apiKey'
      );
    }
    return empty;
  }

  try {
    const provider = createProvider(context);
    return await provider.review(code, languageId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`ReviewMate: ${message}`);
    return empty;
  }
}
