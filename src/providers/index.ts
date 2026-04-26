import * as vscode from 'vscode';
import { AIProvider, ProviderName } from '../types';
import { GeminiProvider } from './GeminiProvider';
import { GroqProvider } from './GroqProvider';
import { ClaudeProvider } from './ClaudeProvider';
import { OllamaProvider } from './OllamaProvider';

/**
 * Factory that reads the user's settings and returns the configured AI provider.
 * Defaults to Gemini if the configured provider is unrecognized.
 */
export function createProvider(_context: vscode.ExtensionContext): AIProvider {
  const config = vscode.workspace.getConfiguration('reviewmate');
  const provider = config.get<ProviderName>('provider', 'gemini');
  const apiKey = config.get<string>('apiKey', '');

  switch (provider) {
    case 'gemini':
      return new GeminiProvider(apiKey);
    case 'groq':
      return new GroqProvider(apiKey);
    case 'claude':
      return new ClaudeProvider(apiKey);
    case 'ollama': {
      const url = config.get<string>('ollamaUrl', 'http://localhost:11434');
      const model = config.get<string>('ollamaModel', 'codellama');
      return new OllamaProvider(url, model);
    }
    default:
      return new GeminiProvider(apiKey);
  }
}

export { GeminiProvider, GroqProvider, ClaudeProvider, OllamaProvider };
