import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, ProviderName, ReviewResult } from '../types';
import { buildPrompt, parseResponse } from '../promptBuilder';

/**
 * AI provider backed by Anthropic Claude Haiku.
 * Paid usage — best response quality and JSON adherence.
 */
export class ClaudeProvider implements AIProvider {
  public readonly name: ProviderName = 'claude';

  private static readonly MODEL = 'claude-haiku-4-5-20251001';

  constructor(private readonly apiKey: string) {}

  async review(code: string, languageId: string): Promise<ReviewResult> {
    const empty: ReviewResult = { issues: [], summary: '', provider: this.name };

    if (!this.apiKey) {
      return empty;
    }

    try {
      const client = new Anthropic({ apiKey: this.apiKey });
      const prompt = buildPrompt(code, languageId);

      const response = await client.messages.create({
        model: ClaudeProvider.MODEL,
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
