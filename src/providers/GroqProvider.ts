import Groq from 'groq-sdk';
import { AIProvider, ProviderName, ReviewResult } from '../types';
import { buildPrompt, parseResponse } from '../promptBuilder';

/**
 * AI provider backed by Groq running Llama 3 70B.
 * Free tier: ~14,400 requests/day.
 */
export class GroqProvider implements AIProvider {
  public readonly name: ProviderName = 'groq';

  private static readonly MODEL = 'llama3-70b-8192';

  constructor(private readonly apiKey: string) {}

  async review(code: string, languageId: string): Promise<ReviewResult> {
    const empty: ReviewResult = { issues: [], summary: '', provider: this.name };

    if (!this.apiKey) {
      return empty;
    }

    try {
      const client = new Groq({ apiKey: this.apiKey });
      const prompt = buildPrompt(code, languageId);

      const response = await client.chat.completions.create({
        model: GroqProvider.MODEL,
        messages: [
          { role: 'system', content: 'You are a senior code reviewer. Always respond with raw JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      });

      const text = response.choices[0]?.message?.content ?? '';
      return parseResponse(text, this.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Groq: ${message}`);
    }
  }
}
