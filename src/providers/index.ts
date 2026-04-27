import * as vscode from 'vscode';
import { AIProvider, ProviderName } from '../types';
import { GeminiProvider } from './GeminiProvider';
import { GroqProvider } from './GroqProvider';
import { ClaudeProvider } from './ClaudeProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { OllamaProvider } from './OllamaProvider';

/**
 * Factory that reads the user's settings and returns the configured AI
 * provider. Each provider's model can be overridden via a per-provider
 * setting (`reviewmate.<provider>Model`); the provider's `DEFAULT_MODEL`
 * applies if the override is empty.
 */
export function createProvider(_context: vscode.ExtensionContext): AIProvider {
  const config = vscode.workspace.getConfiguration('reviewmate');
  const provider = config.get<ProviderName>('provider', 'gemini');
  const apiKey = config.get<string>('apiKey', '');

  switch (provider) {
    case 'gemini': {
      const model = config.get<string>('geminiModel', '') || GeminiProvider.DEFAULT_MODEL;
      return new GeminiProvider(apiKey, model);
    }
    case 'groq': {
      const model = config.get<string>('groqModel', '') || GroqProvider.DEFAULT_MODEL;
      return new GroqProvider(apiKey, model);
    }
    case 'claude': {
      const model = config.get<string>('claudeModel', '') || ClaudeProvider.DEFAULT_MODEL;
      return new ClaudeProvider(apiKey, model);
    }
    case 'openai': {
      const model = config.get<string>('openaiModel', '') || OpenAIProvider.DEFAULT_MODEL;
      return new OpenAIProvider(apiKey, model);
    }
    case 'ollama': {
      const url = config.get<string>('ollamaUrl', 'http://localhost:11434');
      const model = config.get<string>('ollamaModel', '') || OllamaProvider.DEFAULT_MODEL;
      return new OllamaProvider(url, model);
    }
    default:
      return new GeminiProvider(apiKey, GeminiProvider.DEFAULT_MODEL);
  }
}

export {
  GeminiProvider,
  GroqProvider,
  ClaudeProvider,
  OpenAIProvider,
  OllamaProvider,
};
