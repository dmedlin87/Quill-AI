/**
 * Centralized heuristics and thresholds used across AppBrain subsystems.
 * Keeping these here avoids scattered magic numbers and makes tuning safer.
 */
export const INCREMENTAL_SCENE_MATCH_BUFFER = 100;
export const INCREMENTAL_CHANGE_SIZE_THRESHOLD = 2000;
export const DUPLICATE_TEXT_OVERLAP_THRESHOLD = 0.6;
