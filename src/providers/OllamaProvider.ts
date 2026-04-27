import { AIProvider, ProviderName, ReviewResult } from '../types';
import { buildPrompt, parseResponse, PromptOptions } from '../promptBuilder';

interface OllamaGenerateResponse {
  response?: string;
  error?: string;
}

/**
 * AI provider backed by a local Ollama server (no SDK, plain REST).
 * Free — runs entirely on the user's machine.
 */
export class OllamaProvider implements AIProvider {
  public readonly name: ProviderName = 'ollama';

  static readonly DEFAULT_MODEL = 'codellama';

  constructor(
    private readonly baseUrl: string,
    private readonly modelName: string
  ) {}

  async review(
    code: string,
    languageId: string,
    options: PromptOptions = {}
  ): Promise<ReviewResult> {
    try {
      const prompt = buildPrompt(code, languageId, options);
      const url = `${this.baseUrl.replace(/\/+$/, '')}/api/generate`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt,
          stream: false,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const json = (await res.json()) as OllamaGenerateResponse;
      if (json.error) {
        throw new Error(json.error);
      }

      return parseResponse(json.response ?? '', this.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Ollama: ${message}`);
    }
  }
}
