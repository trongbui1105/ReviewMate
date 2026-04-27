import OpenAI from 'openai';
import { AIProvider, ProviderName, ReviewResult } from '../types';
import { buildPrompt, parseResponse, PromptOptions } from '../promptBuilder';

/**
 * AI provider backed by OpenAI.
 * Default model `gpt-4o-mini` is cheap (~$0.0001/review) and fast.
 * Users can switch to `gpt-4o`, `o1-mini`, etc. via `reviewmate.openaiModel`.
 */
export class OpenAIProvider implements AIProvider {
  public readonly name: ProviderName = 'openai';

  static readonly DEFAULT_MODEL = 'gpt-4o-mini';

  constructor(
    private readonly apiKey: string,
    private readonly model: string = OpenAIProvider.DEFAULT_MODEL
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
      const client = new OpenAI({ apiKey: this.apiKey });
      const prompt = buildPrompt(code, languageId, options);

      const response = await client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a senior code reviewer. Always respond with raw JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const text = response.choices[0]?.message?.content ?? '';
      return parseResponse(text, this.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenAI: ${message}`);
    }
  }
}
