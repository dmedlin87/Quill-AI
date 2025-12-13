import { describe, it, expect, vi } from 'vitest';
import {
  cleanJsonOutput,
  safeParseJson,
  safeParseJsonWithValidation,
  validators,
} from '@/services/gemini/resilientParser';

describe('cleanJsonOutput', () => {
  it('returns clean JSON when no markdown fences present', () => {
    const input = '{"key": "value"}';
    expect(cleanJsonOutput(input)).toBe('{"key": "value"}');
  });

  it('removes ```json code blocks', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(cleanJsonOutput(input)).toBe('{"key": "value"}');
  });

  it('removes plain ``` code blocks', () => {
    const input = '```\n{"key": "value"}\n```';
    expect(cleanJsonOutput(input)).toBe('{"key": "value"}');
  });

  it('removes leading/trailing backticks', () => {
    const input = '`{"key": "value"}`';
    expect(cleanJsonOutput(input)).toBe('{"key": "value"}');
  });

  it('handles whitespace around JSON', () => {
    const input = '  \n{"key": "value"}\n  ';
    expect(cleanJsonOutput(input)).toBe('{"key": "value"}');
  });

  it('handles nested JSON in code blocks', () => {
    const input = '```json\n{"nested": {"inner": "value"}}\n```';
    expect(cleanJsonOutput(input)).toBe('{"nested": {"inner": "value"}}');
  });
});

describe('safeParseJson', () => {
  it('parses valid JSON directly', () => {
    const result = safeParseJson('{"key": "value"}', {});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ key: 'value' });
    expect(result.sanitized).toBeUndefined();
  });

  it('parses JSON wrapped in markdown code blocks', () => {
    const result = safeParseJson('```json\n{"key": "value"}\n```', {});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ key: 'value' });
    expect(result.sanitized).toBe(true);
  });

  it('extracts JSON from text with preamble', () => {
    const result = safeParseJson('Here is the JSON: {"key": "value"}', {});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ key: 'value' });
  });

  it('extracts JSON from text with trailing explanation', () => {
    const input = '{"key": "value"}\n\nThis is the response you asked for.';
    const result = safeParseJson(input, {});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ key: 'value' });
  });

  it('returns fallback for empty response', () => {
    const fallback = { default: true };
    const result = safeParseJson('', fallback);
    expect(result.success).toBe(false);
    expect(result.data).toEqual(fallback);
    expect(result.error).toBe('Empty response received');
  });

  it('returns fallback for null response', () => {
    const fallback = { default: true };
    const result = safeParseJson(null, fallback);
    expect(result.success).toBe(false);
    expect(result.data).toEqual(fallback);
  });

  it('returns fallback for undefined response', () => {
    const fallback = { default: true };
    const result = safeParseJson(undefined, fallback);
    expect(result.success).toBe(false);
    expect(result.data).toEqual(fallback);
  });

  it('returns fallback for completely invalid JSON', () => {
    const fallback = { default: true };
    const result = safeParseJson('not json at all', fallback);
    expect(result.success).toBe(false);
    expect(result.data).toEqual(fallback);
    expect(result.error).toContain('Failed to parse JSON');
  });

  it('extracts JSON object using boundary search when sanitization fails', () => {
    const fallback = { default: true };
    const text = 'Preamble that is not removed {"key": "value"} trailing notes that are not stripped';

    const result = safeParseJson(text, fallback);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ key: 'value' });
    expect(result.sanitized).toBe(true);
  });

  it('parses arrays correctly', () => {
    const result = safeParseJson('[1, 2, 3]', []);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it('extracts array from surrounding text', () => {
    const result = safeParseJson('The items are: [1, 2, 3] as requested.', []);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it('returns fallback when array extraction finds invalid JSON', () => {
    const fallback = { default: true };
    const text = 'Items: [not, valid, json] end of response';

    const result = safeParseJson(text, fallback);

    expect(result.success).toBe(false);
    expect(result.data).toEqual(fallback);
    expect(result.error).toContain('Failed to parse JSON after sanitization');
  });

  it('handles complex nested structures', () => {
    const complex = {
      users: [
        { id: 1, name: 'Alice', roles: ['admin', 'user'] },
        { id: 2, name: 'Bob', roles: ['user'] },
      ],
      metadata: { version: '1.0', generated: true },
    };
    const result = safeParseJson(JSON.stringify(complex), {});
    expect(result.success).toBe(true);
    expect(result.data).toEqual(complex);
  });

  it('falls back when parsing extracted JSON fails after extraction', () => {
    const fallback = { default: true };
    const originalParse = JSON.parse;

    let callCount = 0;
    (JSON as any).parse = vi.fn((input: string) => {
      callCount += 1;
      if (callCount === 1) {
        throw new SyntaxError('direct parse failed');
      }
      if (callCount === 2) {
        return { ok: true };
      }
      if (callCount === 3) {
        throw new SyntaxError('parse after extraction failed');
      }
      return originalParse(input as any);
    });

    try {
      const result = safeParseJson('{"ok": true}', fallback);
      expect(result.success).toBe(false);
      expect(result.data).toEqual(fallback);
      expect(result.error).toContain('Failed to parse JSON after sanitization');
    } finally {
      (JSON as any).parse = originalParse;
    }
  });
});

describe('safeParseJsonWithValidation', () => {
  const isStringArray = (data: unknown): data is string[] =>
    Array.isArray(data) && data.every(item => typeof item === 'string');

  it('returns data when validation passes', () => {
    const result = safeParseJsonWithValidation(
      '["a", "b", "c"]',
      isStringArray,
      []
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual(['a', 'b', 'c']);
  });

  it('returns fallback when validation fails', () => {
    const result = safeParseJsonWithValidation(
      '[1, 2, 3]',
      isStringArray,
      ['default']
    );
    expect(result.success).toBe(false);
    expect(result.data).toEqual(['default']);
    expect(result.error).toBe('Response does not match expected schema');
  });

  it('returns fallback for invalid JSON', () => {
    const result = safeParseJsonWithValidation(
      'not json',
      isStringArray,
      ['default']
    );
    expect(result.success).toBe(false);
    expect(result.data).toEqual(['default']);
  });

  it('returns fallback with a defined error when response is JSON null', () => {
    const result = safeParseJsonWithValidation(
      'null',
      isStringArray,
      ['default']
    );

    expect(result.success).toBe(false);
    expect(result.data).toEqual(['default']);
    expect(result.error).toBeTypeOf('string');
    expect(result.error?.length).toBeGreaterThan(0);
  });
});

describe('validators', () => {
  describe('isArray', () => {
    it('returns true for arrays', () => {
      expect(validators.isArray([])).toBe(true);
      expect(validators.isArray([1, 2, 3])).toBe(true);
    });

    it('returns false for non-arrays', () => {
      expect(validators.isArray({})).toBe(false);
      expect(validators.isArray('array')).toBe(false);
      expect(validators.isArray(null)).toBe(false);
    });
  });

  describe('isObject', () => {
    it('returns true for plain objects', () => {
      expect(validators.isObject({})).toBe(true);
      expect(validators.isObject({ key: 'value' })).toBe(true);
    });

    it('returns false for arrays', () => {
      expect(validators.isObject([])).toBe(false);
    });

    it('returns false for null', () => {
      expect(validators.isObject(null)).toBe(false);
    });

    it('returns false for primitives', () => {
      expect(validators.isObject('string')).toBe(false);
      expect(validators.isObject(123)).toBe(false);
    });
  });

  describe('hasProperty', () => {
    it('returns true when property exists', () => {
      expect(validators.hasProperty({ name: 'test' }, 'name')).toBe(true);
    });

    it('returns false when property does not exist', () => {
      expect(validators.hasProperty({ name: 'test' }, 'age')).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(validators.hasProperty(null, 'name')).toBe(false);
      expect(validators.hasProperty([], 'name')).toBe(false);
    });
  });

  describe('isVariationsResponse', () => {
    it('returns true for valid variations response', () => {
      expect(validators.isVariationsResponse({ variations: ['a', 'b'] })).toBe(true);
    });

    it('returns false when variations is not array', () => {
      expect(validators.isVariationsResponse({ variations: 'not array' })).toBe(false);
    });

    it('returns false when variations property missing', () => {
      expect(validators.isVariationsResponse({ other: [] })).toBe(false);
    });
  });
});
