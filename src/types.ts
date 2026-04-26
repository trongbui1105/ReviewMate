export type Severity = 'critical' | 'warning' | 'info';
export type Category = 'bug' | 'security' | 'performance' | 'style';
export type ProviderName = 'gemini' | 'groq' | 'claude' | 'ollama';

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

export interface AIProvider {
  readonly name: ProviderName;
  review(code: string, languageId: string): Promise<ReviewResult>;
}
