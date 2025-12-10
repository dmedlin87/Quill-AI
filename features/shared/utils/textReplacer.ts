/**
 * Text replacement utilities for document editing operations.
 * Provides pure functions for replacing text ranges within strings.
 */

/**
 * Replaces a range of text within a string with new content.
 *
 * @param text - The original text
 * @param start - The start index of the range to replace
 * @param end - The end index of the range to replace
 * @param replacement - The text to insert in place of the range
 * @returns The text with the replacement applied
 *
 * @example
 * ```ts
 * const result = replaceTextRange('Hello world', 6, 11, 'universe');
 * // result: 'Hello universe'
 * ```
 */
export function replaceTextRange(
  text: string,
  start: number,
  end: number,
  replacement: string
): string {
  return text.substring(0, start) + replacement + text.substring(end);
}

/**
 * Applies multiple text replacements in reverse order (from end to start).
 * This ensures that earlier replacements don't shift the positions of later ones.
 *
 * @param text - The original text
 * @param replacements - Array of replacements to apply, each with start, end, and replacement
 * @returns The text with all replacements applied
 *
 * @example
 * ```ts
 * const result = applyReplacementsReversed('Hello world, hello!', [
 *   { start: 0, end: 5, replacement: 'Hi' },
 *   { start: 13, end: 18, replacement: 'hi' },
 * ]);
 * // result: 'Hi world, hi!'
 * ```
 */
export function applyReplacementsReversed(
  text: string,
  replacements: Array<{ start: number; end: number; replacement: string }>
): string {
  // Sort in reverse order by start position
  const sorted = [...replacements].sort((a, b) => b.start - a.start);

  let result = text;
  for (const { start, end, replacement } of sorted) {
    result = replaceTextRange(result, start, end, replacement);
  }

  return result;
}
