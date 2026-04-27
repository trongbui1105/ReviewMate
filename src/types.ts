export type Severity = 'critical' | 'warning' | 'info';
export type Category = 'bug' | 'security' | 'performance' | 'style';
export type ProviderName = 'gemini' | 'groq' | 'claude' | 'openai' | 'ollama';

export interface Issue {
  /** 1-based line number where the issue starts. */
  line: number;
  /** 1-based line number where the issue ends (optional, defaults to `line`). */
  endLine?: number;
  severity: Severity;
  category: Category;
  message: string;
  fix: string;
}

export interface ReviewResult {
  issues: Issue[];
  summary: string;
  provider: ProviderName;
}

export interface PromptOptions {
  /** Free-form user-provided instructions appended to the system prompt. */
  customInstructions?: string;
  /** Whether the input is a full file or a unified diff. */
  mode?: 'full' | 'diff';
}

export interface AIProvider {
  readonly name: ProviderName;
  review(
    code: string,
    languageId: string,
    options?: PromptOptions
  ): Promise<ReviewResult>;
}
