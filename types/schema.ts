import { AnalysisResult, CharacterProfile } from '../types';

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