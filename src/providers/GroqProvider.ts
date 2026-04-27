import Groq from 'groq-sdk';
import { AIProvider, ProviderName, ReviewResult } from '../types';
import { buildPrompt, parseResponse, PromptOptions } from '../promptBuilder';

/**
 * AI provider backed by Groq.
 * Free tier on `llama3-70b-8192`: ~14,400 requests/day.
 */
export class GroqProvider implements AIProvider {
  public readonly name: ProviderName = 'groq';

  static readonly DEFAULT_MODEL = 'llama-3.3-70b-versatile';

  constructor(
    private readonly apiKey: string,
    private readonly model: string = GroqProvider.DEFAULT_MODEL
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
      const client = new Groq({ apiKey: this.apiKey });
      const prompt = buildPrompt(code, languageId, options);

      const response = await client.chat.completions.create({
        model: this.model,
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
