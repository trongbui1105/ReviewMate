import { ReviewResult, Issue, ProviderName } from './types';

const VALID_SEVERITIES: ReadonlySet<string> = new Set(['critical', 'warning', 'info']);
const VALID_CATEGORIES: ReadonlySet<string> = new Set(['bug', 'security', 'performance', 'style']);

/**
 * Builds a single-string prompt to send to any AI provider for code review.
 *
 * @param code        - Source code to be reviewed.
 * @param languageId  - VS Code language identifier (e.g. "typescript", "python").
 */
export function buildPrompt(code: string, languageId: string): string {
  return `You are a senior software engineer performing a code review.

Respond ONLY with valid JSON. No markdown, no code fences, no preamble, no explanation.

The JSON must have this exact shape:
{
  "issues": [
    {
      "line": <1-based integer line number>,
      "endLine": <1-based integer line number or null>,
      "severity": "critical" | "warning" | "info",
      "category": "bug" | "security" | "performance" | "style",
      "message": "<short description of the problem>",
      "fix": "<concrete, actionable fix>"
    }
  ],
  "summary": "<1-2 sentence overall assessment>"
}

Severity guide:
- critical: crashes, data loss, security vulnerabilities, incorrect logic
- warning: likely bugs, performance issues, bad practices
- info: style improvements, minor inefficiencies

Focus on real issues only. Skip style nitpicks unless they create confusion or genuine harm.

Language: ${languageId}

Code:
\`\`\`${languageId}
${code}
\`\`\``;
}

/**
 * Strips accidental markdown fences (```json ... ``` or ``` ... ```) from a string.
 */
function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

function isValidIssue(value: unknown): value is Issue {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.line === 'number' &&
    typeof v.severity === 'string' &&
    VALID_SEVERITIES.has(v.severity) &&
    typeof v.category === 'string' &&
    VALID_CATEGORIES.has(v.category) &&
    typeof v.message === 'string' &&
    typeof v.fix === 'string'
  );
}

/**
 * Parses a raw AI response into a ReviewResult. Never throws — on any failure,
 * returns a result with empty issues and a default summary.
 *
 * @param raw       - Raw text returned by the AI provider.
 * @param provider  - Provider name to embed in the result (for sidebar credit).
 */
export function parseResponse(raw: string, provider: ProviderName): ReviewResult {
  const empty: ReviewResult = { issues: [], summary: '', provider };

  try {
    const cleaned = stripFences(raw);
    if (!cleaned) {
      return empty;
    }

    const parsed: unknown = JSON.parse(cleaned);
    if (typeof parsed !== 'object' || parsed === null) {
      return empty;
    }

    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.issues)) {
      return empty;
    }

    const issues: Issue[] = obj.issues.filter(isValidIssue).map((issue) => ({
      line: issue.line,
      endLine: typeof issue.endLine === 'number' ? issue.endLine : issue.line,
      severity: issue.severity,
      category: issue.category,
      message: issue.message,
      fix: issue.fix,
    }));

    return {
      issues,
      summary: typeof obj.summary === 'string' ? obj.summary : '',
      provider,
    };
  } catch {
    return empty;
  }
}
