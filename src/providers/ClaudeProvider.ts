import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, ProviderName, ReviewResult } from '../types';
import { buildPrompt, parseResponse, PromptOptions } from '../promptBuilder';

/**
 * AI provider backed by Anthropic Claude.
 * Paid usage. Default model `claude-haiku-4-5-20251001` is cheap and fast;
 * users can switch to a stronger model via `reviewmate.claudeModel`.
 */
export class ClaudeProvider implements AIProvider {
  public readonly name: ProviderName = 'claude';

  static readonly DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

  constructor(
    private readonly apiKey: string,
    private readonly model: string = ClaudeProvider.DEFAULT_MODEL
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
      const client = new Anthropic({ apiKey: this.apiKey });
      const prompt = buildPrompt(code, languageId, options);

      const response = await client.messages.create({
        model: this.model,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });

      const block = response.content.find((b) => b.type === 'text');
      const text = block && block.type === 'text' ? block.text : '';
      return parseResponse(text, this.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Claude: ${message}`);
    }
  }
}
