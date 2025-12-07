import { describe, it, expect } from 'vitest';
import {
  INCREMENTAL_SCENE_MATCH_BUFFER,
  INCREMENTAL_CHANGE_SIZE_THRESHOLD,
  DUPLICATE_TEXT_OVERLAP_THRESHOLD,
} from '@/config/heuristics';

describe('heuristics config', () => {
  it('exports INCREMENTAL_SCENE_MATCH_BUFFER as number', () => {
    expect(typeof INCREMENTAL_SCENE_MATCH_BUFFER).toBe('number');
    expect(INCREMENTAL_SCENE_MATCH_BUFFER).toBe(100);
  });

  it('exports INCREMENTAL_CHANGE_SIZE_THRESHOLD as number', () => {
    expect(typeof INCREMENTAL_CHANGE_SIZE_THRESHOLD).toBe('number');
    expect(INCREMENTAL_CHANGE_SIZE_THRESHOLD).toBe(2000);
  });

  it('exports DUPLICATE_TEXT_OVERLAP_THRESHOLD as number', () => {
    expect(typeof DUPLICATE_TEXT_OVERLAP_THRESHOLD).toBe('number');
    expect(DUPLICATE_TEXT_OVERLAP_THRESHOLD).toBe(0.6);
  });

  it('DUPLICATE_TEXT_OVERLAP_THRESHOLD is between 0 and 1', () => {
    expect(DUPLICATE_TEXT_OVERLAP_THRESHOLD).toBeGreaterThanOrEqual(0);
    expect(DUPLICATE_TEXT_OVERLAP_THRESHOLD).toBeLessThanOrEqual(1);
  });
});
