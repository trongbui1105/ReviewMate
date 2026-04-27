import * as vscode from 'vscode';
import { ReviewResult, ProviderName, PromptOptions } from './types';
import { createProvider } from './providers';

/**
 * Top-level review function used by the extension command. Selects the
 * configured provider, runs the review, and surfaces failures as VS Code
 * error messages instead of throwing.
 *
 * Reads `reviewmate.customInstructions` from settings and forwards it to
 * the provider's prompt unless the caller explicitly overrides via `options`.
 */
export async function review(
  code: string,
  languageId: string,
  context: vscode.ExtensionContext,
  options: PromptOptions = {}
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

  // Merge user-configured custom instructions with any caller-supplied ones.
  const settingInstructions = config.get<string>('customInstructions', '').trim();
  const callerInstructions = options.customInstructions?.trim() ?? '';
  const merged = [settingInstructions, callerInstructions].filter(Boolean).join('\n\n');

  const finalOptions: PromptOptions = {
    ...options,
    customInstructions: merged || undefined,
  };

  try {
    const provider = createProvider(context);
    return await provider.review(code, languageId, finalOptions);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`ReviewMate: ${message}`);
    return empty;
  }
}
