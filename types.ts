export interface AnalysisResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  
  pacing: {
    score: number;
    analysis: string;
    slowSections: string[];
    fastSections: string[];
  };

  plotIssues: Array<{
    issue: string;
    location: string;
    suggestion: string;
  }>;

  characters: Array<{
    name: string;
    bio: string;
    arc: string;
    arcStages: Array<{
      stage: string;
      description: string;
    }>;
    relationships: Array<{
      name: string;
      type: string;
      dynamic: string;
    }>;
    plotThreads: string[];
    inconsistencies: string[];
    developmentSuggestion: string;
  }>;
  
  generalSuggestions: string[];
}

export interface PlotSuggestion {
  title: string;
  description: string;
  reasoning: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  toolCalls?: any[];
}

export interface RecentFile {
  name: string;
  content: string;
  timestamp: number;
}

// Agent & Editor Types
export interface EditorContext {
  cursorPosition: number;
  selection: { start: number; end: number; text: string } | null;
  totalLength: number;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  description: string;
  author: 'User' | 'Agent';
  previousContent: string;
  newContent: string;
}

export enum AppMode {
  UPLOAD = 'UPLOAD',
  EDITOR = 'EDITOR',
}

export enum SidebarTab {
  ANALYSIS = 'ANALYSIS',
  CHAT = 'CHAT',
  VOICE = 'VOICE',
  HISTORY = 'HISTORY',
}
