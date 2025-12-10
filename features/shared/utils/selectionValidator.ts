/**
 * Selection validation utilities for ensuring text selections remain fresh
 * and haven't been modified since capture.
 */

export interface SelectionRange {
  start: number;
  end: number;
  text: string;
}

export interface SelectionValidation {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Validates that a captured selection still matches the current document state.
 * Used to detect when text has changed since a selection was captured,
 * preventing stale edits from being applied.
 *
 * @param currentText - The current full document text
 * @param selection - The captured selection with start, end, and original text
 * @returns Validation result indicating if the selection is still valid
 *
 * @example
 * ```ts
 * const validation = validateSelectionFreshness(
 *   document.getText(),
 *   { start: 10, end: 20, text: 'original' }
 * );
 * if (!validation.isValid) {
 *   showError(validation.errorMessage);
 * }
 * ```
 */
export function validateSelectionFreshness(
  currentText: string,
  selection: SelectionRange
): SelectionValidation {
  const actualText = currentText.substring(selection.start, selection.end);

  if (actualText !== selection.text) {
    return {
      isValid: false,
      errorMessage: 'Text has changed since selection. Please re-select and try again.',
    };
  }

  return { isValid: true };
}

/**
 * Validates selection freshness specifically for grammar operations.
 * Returns a more specific error message for grammar check contexts.
 *
 * @param currentText - The current full document text
 * @param selection - The captured selection with start, end, and original text
 * @returns Validation result with grammar-specific error message
 */
export function validateGrammarSelectionFreshness(
  currentText: string,
  selection: SelectionRange
): SelectionValidation {
  const actualText = currentText.substring(selection.start, selection.end);

  if (actualText !== selection.text) {
    return {
      isValid: false,
      errorMessage: 'Text has changed since grammar check. Please re-run.',
    };
  }

  return { isValid: true };
}
