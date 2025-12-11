import { create } from 'zustand';
import { ReaderPersona, DEFAULT_READERS } from '@/types/personas';
import { InlineComment } from '@/types/schema';
import { readerService } from '@/services/agent/readerService';

interface ReaderState {
  activePersona: ReaderPersona;
  reactions: InlineComment[];
  isReading: boolean;
  isVisible: boolean; // Is the Shadow Reader panel open?

  // Actions
  setActivePersona: (personaId: string) => void;
  toggleVisibility: () => void;
  generateReactions: (text: string, context?: string) => Promise<void>;
  clearReactions: () => void;
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  activePersona: DEFAULT_READERS[0], // Skimmer by default
  reactions: [],
  isReading: false,
  isVisible: false,

  setActivePersona: (personaId) => {
    const persona = DEFAULT_READERS.find(p => p.id === personaId);
    if (persona) {
      set({ activePersona: persona });
    }
  },

  toggleVisibility: () => set(state => ({ isVisible: !state.isVisible })),

  generateReactions: async (text, context) => {
    set({ isReading: true });
    try {
      const { activePersona } = get();
      const newReactions = await readerService.generateReactions(text, activePersona, context);
      set({ reactions: newReactions });
    } catch (error) {
      console.error('Reader Store Error:', error);
    } finally {
      set({ isReading: false });
    }
  },

  clearReactions: () => set({ reactions: [] }),
}));
