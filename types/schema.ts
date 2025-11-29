import { AnalysisResult, CharacterProfile } from '../types';

export interface EntityAttribute {
  value: string;
  chapterId: string;
  position: number;
}

export interface CharacterIndex {
  name: string;
  attributes: Record<string, EntityAttribute[]>; 
  firstMention: { chapterId: string; position: number };
  mentions: Array<{ chapterId: string; position: number }>;
}

export interface Contradiction {
  type: 'character_attribute' | 'timeline' | 'location';
  characterName?: string;
  attribute?: string;
  originalValue: string;
  originalChapterId: string;
  newValue: string;
  newChapterId: string;
  position: number;
}

export interface ManuscriptIndex {
  characters: Record<string, CharacterIndex>;
  lastUpdated: Record<string, number>;
}

export interface Lore {
  characters: CharacterProfile[];
  worldRules: string[];
}

export interface Project {
  id: string;
  title: string;
  author: string;
  setting?: {
    timePeriod: string;
    location: string;
  };
  lore?: Lore;
  manuscriptIndex?: ManuscriptIndex;
  createdAt: number;
  updatedAt: number;
}

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  content: string;
  order: number;
  lastAnalysis?: AnalysisResult;
  updatedAt: number;
}

export interface AppState {
    activeProjectId: string | null;
    activeChapterId: string | null;
}