import { EntityNode } from '@/types/intelligence';

const dismissedLoreEntities = new Set<string>();
const surfacedLoreEntities = new Set<string>();

export interface LoreEntityCandidate {
  name: string;
  type: EntityNode['type'];
  firstMention?: number;
}

const normalize = (value: string): string => value.trim().toLowerCase();

export const markLoreEntityDismissed = (name: string): void => {
  dismissedLoreEntities.add(normalize(name));
};

export const resetLoreEntityTracking = (): void => {
  dismissedLoreEntities.clear();
  surfacedLoreEntities.clear();
};

export const filterNovelLoreEntities = (
  entities: EntityNode[],
  existingGraphNames: string[] = [],
): LoreEntityCandidate[] => {
  const existing = new Set(existingGraphNames.map(normalize));
  const results: LoreEntityCandidate[] = [];

  for (const entity of entities) {
    const key = normalize(entity.name);
    if (existing.has(key)) continue;
    if (dismissedLoreEntities.has(key)) continue;
    if (surfacedLoreEntities.has(key)) continue;
    if (entity.mentionCount < 2) continue;

    surfacedLoreEntities.add(key);
    results.push({
      name: entity.name,
      type: entity.type,
      firstMention: entity.firstMention,
    });
  }

  return results;
};
