import { create } from 'zustand';

export type FocusGoalType = 'none' | 'time' | 'words';

interface FocusState {
  isSessionActive: boolean;
  startTime: number | null;
  endTime: number | null; // For time-based goals

  goalType: FocusGoalType;
  goalTarget: number; // minutes or word count

  startWordCount: number;
  currentWordCount: number;
}

interface FocusActions {
  startSession: (config: { goalType: FocusGoalType; goalTarget: number; currentWordCount: number }) => void;
  endSession: () => void;
  updateCurrentWordCount: (count: number) => void;
  reset: () => void;
}

const initialState: FocusState = {
  isSessionActive: false,
  startTime: null,
  endTime: null,
  goalType: 'none',
  goalTarget: 0,
  startWordCount: 0,
  currentWordCount: 0,
};

export const useFocusStore = create<FocusState & FocusActions>((set) => ({
  ...initialState,

  startSession: ({ goalType, goalTarget, currentWordCount }) => {
    const now = Date.now();
    let endTime = null;

    if (goalType === 'time') {
      endTime = now + (goalTarget * 60 * 1000);
    }

    set({
      isSessionActive: true,
      startTime: now,
      endTime,
      goalType,
      goalTarget,
      startWordCount: currentWordCount,
      currentWordCount: currentWordCount,
    });
  },

  endSession: () => {
    set({ isSessionActive: false });
  },

  updateCurrentWordCount: (count: number) => {
    set({ currentWordCount: count });
  },

  reset: () => {
    set(initialState);
  },
}));
