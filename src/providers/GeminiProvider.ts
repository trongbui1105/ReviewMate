import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, ProviderName, ReviewResult } from '../types';
import { buildPrompt, parseResponse, PromptOptions } from '../promptBuilder';

/**
 * AI provider backed by Google Gemini.
 * Free tier on `gemini-2.5-flash`: 15 requests/minute, ~1M tokens/day.
 */
export class GeminiProvider implements AIProvider {
  public readonly name: ProviderName = 'gemini';

  static readonly DEFAULT_MODEL = 'gemini-2.5-flash';

  constructor(
    private readonly apiKey: string,
    private readonly model: string = GeminiProvider.DEFAULT_MODEL
  ) {}

  async review(
    code: string,
    languageId: string,
    options: PromptOptions = {}
  ): Promise<ReviewResult> {
    const empty: ReviewResult = { issues: [], summary: '', provider: this.name };

    if (!this.apiKey) {
      return empty;
    }

    try {
      const client = new GoogleGenerativeAI(this.apiKey);
      const model = client.getGenerativeModel({ model: this.model });
      const prompt = buildPrompt(code, languageId, options);

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return parseResponse(text, this.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Gemini: ${message}`);
    }
  }
}
