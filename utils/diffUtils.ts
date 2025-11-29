import { diff_match_patch } from "diff-match-patch";

export function calculateDiff(text1: string, text2: string) {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(text1, text2);
  dmp.diff_cleanupSemantic(diffs);
  return diffs;
}