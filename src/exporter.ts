import { ReviewResult, Issue, ProviderName } from './types';

const PROVIDER_LABELS: Record<ProviderName, string> = {
  gemini: 'Gemini',
  groq: 'Groq',
  claude: 'Claude',
  openai: 'OpenAI',
  ollama: 'Ollama',
};

const SEVERITY_ORDER: ReadonlyArray<Issue['severity']> = ['critical', 'warning', 'info'];

/**
 * Renders a ReviewResult as a Markdown document suitable for committing,
 * pasting into a PR description, or sharing on Slack.
 */
export function renderMarkdown(result: ReviewResult, fileName: string): string {
  const lines: string[] = [];
  const total = result.issues.length;
  const counts = SEVERITY_ORDER.reduce<Record<Issue['severity'], number>>(
    (acc, sev) => {
      acc[sev] = result.issues.filter((i) => i.severity === sev).length;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 }
  );

  lines.push(`# Code Review`);
  lines.push('');
  lines.push(`**File:** \`${fileName}\``);
  lines.push(`**Reviewed by:** ${PROVIDER_LABELS[result.provider]}`);
  lines.push(`**Date:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push(`**Total issues:** ${total} — ${counts.critical} critical, ${counts.warning} warning, ${counts.info} info`);
  lines.push('');

  if (result.summary) {
    lines.push(`## Summary`);
    lines.push('');
    lines.push(`> ${result.summary}`);
    lines.push('');
  }

  if (total === 0) {
    lines.push('No issues found.');
    lines.push('');
    return lines.join('\n');
  }

  for (const sev of SEVERITY_ORDER) {
    const group = result.issues.filter((i) => i.severity === sev);
    if (group.length === 0) {
      continue;
    }

    const label = sev.charAt(0).toUpperCase() + sev.slice(1);
    lines.push(`## ${label} (${group.length})`);
    lines.push('');

    for (const issue of group) {
      const lineRef =
        !issue.endLine || issue.endLine === issue.line
          ? `Line ${issue.line}`
          : `Lines ${issue.line}–${issue.endLine}`;

      lines.push(`### ${lineRef} — \`${issue.category}\``);
      lines.push('');
      lines.push(issue.message);
      lines.push('');
      lines.push('**Suggested fix:**');
      lines.push('');
      lines.push('```');
      lines.push(issue.fix);
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}
