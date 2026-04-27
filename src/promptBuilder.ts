import { ReviewResult, Issue, ProviderName, PromptOptions } from './types';

const VALID_SEVERITIES: ReadonlySet<string> = new Set(['critical', 'warning', 'info']);
const VALID_CATEGORIES: ReadonlySet<string> = new Set(['bug', 'security', 'performance', 'style']);

/**
 * Builds a single-string prompt to send to any AI provider for code review.
 *
 * @param code        - Source code (or unified diff in `mode: 'diff'`).
 * @param languageId  - VS Code language identifier (e.g. "typescript", "python").
 * @param options     - Optional custom instructions and mode toggle.
 */
export function buildPrompt(
  code: string,
  languageId: string,
  options: PromptOptions = {}
): string {
  const customSection = options.customInstructions?.trim()
    ? `\n\nAdditional project-specific instructions from the user:\n${options.customInstructions.trim()}`
    : '';

  const modeSection =
    options.mode === 'diff'
      ? `\n\nThe input below is a unified diff. Review ONLY the changed lines (lines starting with "+" in the new file). Use the new-file line numbers in your "line" fields. Ignore unchanged context lines.`
      : '';

  const lineRangeSection =
    options.totalLines && options.mode !== 'diff'
      ? `\n\nIMPORTANT: The file has exactly ${options.totalLines} lines (numbered 1 to ${options.totalLines}). Every "line" and "endLine" value you return MUST be an integer between 1 and ${options.totalLines} inclusive. Do not invent line numbers beyond the file's length. Count carefully.`
      : '';

  const codeBlock =
    options.mode === 'diff'
      ? `\`\`\`diff\n${code}\n\`\`\``
      : `\`\`\`${languageId}\n${code}\n\`\`\``;

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

Focus on real issues only. Skip style nitpicks unless they create confusion or genuine harm.${lineRangeSection}${modeSection}${customSection}

Language: ${languageId}

Code:
${codeBlock}`;
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

// Re-export for backward compatibility with provider files that imported
// `PromptOptions` from this module before the consolidation.
export type { PromptOptions } from './types';
