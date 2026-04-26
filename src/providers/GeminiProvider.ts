import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, ProviderName, ReviewResult } from '../types';
import { buildPrompt, parseResponse } from '../promptBuilder';

/**
 * AI provider backed by Google Gemini Flash.
 * Free tier: 15 requests/minute, ~1M tokens/day.
 */
export class GeminiProvider implements AIProvider {
  public readonly name: ProviderName = 'gemini';

  private static readonly MODEL = 'gemini-2.5-flash';

  constructor(private readonly apiKey: string) {}

  async review(code: string, languageId: string): Promise<ReviewResult> {
    const empty: ReviewResult = { issues: [], summary: '', provider: this.name };

    if (!this.apiKey) {
      return empty;
    }

    try {
      const client = new GoogleGenerativeAI(this.apiKey);
      const model = client.getGenerativeModel({ model: GeminiProvider.MODEL });
      const prompt = buildPrompt(code, languageId);

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return parseResponse(text, this.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Gemini: ${message}`);
    }
  }
}
