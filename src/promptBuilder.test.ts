import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, parseResponse } from './promptBuilder';

describe('parseResponse', () => {
  test('parses a valid JSON response', () => {
    const raw = JSON.stringify({
      issues: [
        {
          line: 5,
          endLine: 5,
          severity: 'critical',
          category: 'bug',
          message: 'off-by-one',
          fix: 'use < instead of <=',
        },
      ],
      summary: 'looks bad',
    });

    const result = parseResponse(raw, 'gemini');

    assert.equal(result.issues.length, 1);
    assert.equal(result.summary, 'looks bad');
    assert.equal(result.provider, 'gemini');
    assert.equal(result.issues[0].line, 5);
    assert.equal(result.issues[0].severity, 'critical');
    assert.equal(result.issues[0].category, 'bug');
  });

  test('strips ```json markdown fences', () => {
    const raw = '```json\n{"issues": [], "summary": "ok"}\n```';
    const result = parseResponse(raw, 'claude');
    assert.equal(result.summary, 'ok');
    assert.equal(result.issues.length, 0);
  });

  test('strips plain ``` fences without the json tag', () => {
    const raw = '```\n{"issues": [], "summary": "ok"}\n```';
    const result = parseResponse(raw, 'groq');
    assert.equal(result.summary, 'ok');
  });

  test('returns empty result for an empty string', () => {
    const result = parseResponse('', 'gemini');
    assert.deepEqual(result, { issues: [], summary: '', provider: 'gemini' });
  });

  test('returns empty result for whitespace-only input', () => {
    const result = parseResponse('   \n\n', 'ollama');
    assert.equal(result.issues.length, 0);
    assert.equal(result.summary, '');
    assert.equal(result.provider, 'ollama');
  });

  test('returns empty result for malformed JSON without throwing', () => {
    const result = parseResponse('{ this is not json', 'gemini');
    assert.deepEqual(result, { issues: [], summary: '', provider: 'gemini' });
  });

  test('returns empty result when issues field is missing', () => {
    const raw = JSON.stringify({ summary: 'no issues array here' });
    const result = parseResponse(raw, 'gemini');
    assert.equal(result.issues.length, 0);
    // summary is dropped because the outer shape is rejected
    assert.equal(result.summary, '');
  });

  test('filters out an issue with invalid severity', () => {
    const raw = JSON.stringify({
      issues: [
        { line: 1, severity: 'fatal', category: 'bug', message: 'x', fix: 'y' },
        { line: 2, severity: 'warning', category: 'bug', message: 'a', fix: 'b' },
      ],
      summary: 's',
    });

    const result = parseResponse(raw, 'gemini');

    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].severity, 'warning');
    assert.equal(result.issues[0].line, 2);
  });

  test('filters out an issue with invalid category', () => {
    const raw = JSON.stringify({
      issues: [
        { line: 1, severity: 'info', category: 'bikeshed', message: 'm', fix: 'f' },
        { line: 2, severity: 'info', category: 'style',    message: 'm', fix: 'f' },
      ],
      summary: '',
    });

    const result = parseResponse(raw, 'gemini');

    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].category, 'style');
  });

  test('filters out an issue missing required fields', () => {
    const raw = JSON.stringify({
      issues: [
        { line: 1, severity: 'info' }, // missing message, fix, category
        { line: 2, severity: 'info', category: 'style', message: 'm', fix: 'f' },
      ],
      summary: 's',
    });

    const result = parseResponse(raw, 'gemini');

    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].line, 2);
  });

  test('defaults endLine to line when omitted', () => {
    const raw = JSON.stringify({
      issues: [
        { line: 7, severity: 'info', category: 'style', message: 'm', fix: 'f' },
      ],
      summary: '',
    });

    const result = parseResponse(raw, 'gemini');

    assert.equal(result.issues[0].endLine, 7);
  });

  test('preserves explicit endLine', () => {
    const raw = JSON.stringify({
      issues: [
        { line: 3, endLine: 9, severity: 'warning', category: 'bug', message: 'm', fix: 'f' },
      ],
      summary: '',
    });

    const result = parseResponse(raw, 'gemini');

    assert.equal(result.issues[0].endLine, 9);
  });

  test('preserves the provider name on every code path', () => {
    assert.equal(parseResponse('', 'ollama').provider, 'ollama');
    assert.equal(parseResponse('garbage', 'claude').provider, 'claude');
    assert.equal(parseResponse('{"issues":[]}', 'groq').provider, 'groq');
  });

  test('ignores extra unknown fields on issues', () => {
    const raw = JSON.stringify({
      issues: [
        {
          line: 1,
          severity: 'info',
          category: 'style',
          message: 'm',
          fix: 'f',
          confidence: 0.99, // unknown
          tags: ['x'],      // unknown
        },
      ],
      summary: 's',
    });

    const result = parseResponse(raw, 'gemini');

    assert.equal(result.issues.length, 1);
    assert.equal(result.summary, 's');
  });
});

describe('buildPrompt', () => {
  test('includes the language ID in the prompt', () => {
    const prompt = buildPrompt('print("hi")', 'python');
    assert.match(prompt, /python/);
  });

  test('includes the verbatim code', () => {
    const code = 'const x = 1; // unique-marker-9183';
    const prompt = buildPrompt(code, 'typescript');
    assert.ok(prompt.includes(code), 'expected prompt to contain the code');
  });

  test('describes the JSON response shape', () => {
    const prompt = buildPrompt('x', 'js');
    assert.match(prompt, /"issues":/);
    assert.match(prompt, /"severity":/);
    assert.match(prompt, /"summary":/);
    assert.match(prompt, /"line":/);
    assert.match(prompt, /"fix":/);
  });

  test('lists all valid severities and categories', () => {
    const prompt = buildPrompt('x', 'js');
    for (const sev of ['critical', 'warning', 'info']) {
      assert.match(prompt, new RegExp(sev), `severity "${sev}" should appear in the prompt`);
    }
    for (const cat of ['bug', 'security', 'performance', 'style']) {
      assert.match(prompt, new RegExp(cat), `category "${cat}" should appear in the prompt`);
    }
  });
});
