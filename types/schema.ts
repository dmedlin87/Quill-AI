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

/**
 * Branch - Version control for chapter content
 */
export interface Branch {
  id: string;
  name: string;
  content: string;
  baseContent?: string; // Content of main when branch was created
  createdAt: number;
}

/**
 * InlineComment - AI critique markers stored with content
 */
export interface InlineComment {
  id: string;
  type: 'plot' | 'setting' | 'character' | 'pacing' | 'prose';
  issue: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
  quote: string;
  startIndex: number;
  endIndex: number;
  dismissed: boolean;
  createdAt: number;
}

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  content: string;
  order: number;
  lastAnalysis?: AnalysisResult;
  updatedAt: number;
  // Quill AI 3.0: Branching
  branches?: Branch[];
  activeBranchId?: string | null;
  // Quill AI 3.0: Inline Comments
  comments?: InlineComment[];
}

export interface AppState {
    activeProjectId: string | null;
    activeChapterId: string | null;
}
