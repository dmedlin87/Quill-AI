import { db } from '../db';
import { processManuscript } from '../intelligence';
import { checkNarrativeDrift } from './driftDetector';
import { getOrCreateBedsideNote, evolveBedsideNote } from '../memory';
import { ManuscriptIntelligence } from '@/types/intelligence';
import { BedsideNoteContent } from '@/services/memory/types';

/**
 * Orchestrates the "Living Bible" check.
 * 
 * 1. Fetches the latest Bedside Note (Intent).
 * 2. Fetches the active chapter content (Reality).
 * 3. Processing the chapter (Intelligence). // In a real app, this might be offloaded to a worker
 * 4. Compares them (Drift Detection).
 * 5. Updates Bedside Note if conflicts are found.
 */
export async function runNarrativeAlignmentCheck(
  projectId: string,
  chapterId: string
): Promise<void> {
  try {
    // 1. Fetch Resources
    const [bedsideNote, chapter] = await Promise.all([
      getOrCreateBedsideNote(projectId),
      db.chapters.get(chapterId)
    ]);

    if (!chapter) {
      console.warn(`[NarrativeAlignment] Chapter ${chapterId} not found.`);
      return;
    }

    // 2. Process Manuscript (Reality)
    // We assume the stored content in DB is the latest "significant" state.
    // If the editor state is ahead of DB, we might miss the very latest keystrokes, 
    // but SignificantEditMonitor usually fires after some accumulation, so DB save likely happened or will happen.
    // For this implementation, we rely on DB content.
    const intelligence: ManuscriptIntelligence = processManuscript(
      chapter.content,
      chapter.id
    );

    // 3. Get Plan (Intent)
    const plan = bedsideNote.structuredContent as BedsideNoteContent | undefined;
    if (!plan) {
      // No structured plan - nothing to compare against yet.
      // We could try to parse the text, but Phase 4 goal is strict structure.
      return;
    }

    // 4. Check for Drift
    const conflicts = checkNarrativeDrift(intelligence, plan);

    if (conflicts.length === 0) {
      // No drift detected.
      // Optionally, we could still evolve to say "Alignment check passed", but that might be spammy.
      // For now, we only act on conflicts.
      return;
    }

    // 5. Evolve Bedside Note with Conflicts
    const conflictSummary = conflicts
      .map(c => `Conflict: ${c.previous} ↔ ${c.current}`)
      .join('\n');

    await evolveBedsideNote(projectId, `Narrative drift detected:\n${conflictSummary}`, {
      changeReason: 'narrative_alignment',
      structuredContent: {
        conflicts: conflicts
      },
      chapterId: chapterId,
      extraTags: ['conflict:detected']
    });

    console.log(`[NarrativeAlignment] Evolved bedside note with ${conflicts.length} conflicts.`);

  } catch (error) {
    console.error('[NarrativeAlignment] Failed to run check:', error);
  }
}
