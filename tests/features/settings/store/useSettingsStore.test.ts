import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSettingsStore } from '@/features/settings/store/useSettingsStore';

const initialState = useSettingsStore.getState();

describe('useSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState(initialState, true);
    vi.clearAllMocks();
    vi.restoreAllMocks(); // Ensure spies are gone
  });

  // ---------------------------------------------------------------------------
  // Persistence & Storage Logic
  // ---------------------------------------------------------------------------

  it('persists state to localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    useSettingsStore.getState().setExperienceLevel('pro');

    expect(setItemSpy).toHaveBeenCalledWith(
      'quill-settings',
      expect.stringContaining('"experienceLevel":"pro"')
    );
  });

  it('handles localStorage write errors (quota exceeded)', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    // Should not throw
    expect(() => {
      useSettingsStore.getState().setExperienceLevel('novice');
    }).not.toThrow();

    // Verify state still updates in memory
    expect(useSettingsStore.getState().experienceLevel).toBe('novice');

    expect(consoleErrorSpy).toHaveBeenCalledWith('LocalStorage write error:', expect.any(Error));
  });

  it('handles localStorage read errors', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('ReadError');
    });

    // We can't easily re-init the store to trigger internal getItem, but we can access the storage directly 
    // if we want to test the safeLocalStorage object isolated, or we accept testing via side effect.
    // However, the store is already initialized. 
    // To properly test the `safeLocalStorage.getItem` embedded in the store, we would need to inspect `useSettingsStore.persist.getOptions().storage`.
    // Let's try to access the storage wrapper directly if exposed by zustand's persist middleware options.
    
    const storage = useSettingsStore.persist.getOptions().storage;
    if (storage) {
        // Direct test of the wrapper
        const result = storage.getItem('key');
        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith('LocalStorage read error:', expect.any(Error));
    }

    getItemSpy.mockRestore(); // Restore for other tests
  });

  it('handles localStorage remove errors', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('RemoveError');
    });

    const storage = useSettingsStore.persist.getOptions().storage;
    if (storage) {
        expect(() => storage.removeItem('key')).not.toThrow();
        expect(consoleErrorSpy).toHaveBeenCalledWith('LocalStorage remove error:', expect.any(Error));
    }
  });

  it('merges old settings schemas (migration v0)', () => {
    // To test migration, we can direct pass a persisted state to the migrate function
    const migrate = useSettingsStore.persist.getOptions().migrate;
    
    if (migrate) {
        const oldState = {
            experienceLevel: 'pro'
            // Missing all other fields
        };
        
        // Migrate as version 0
        const migratedState = migrate(oldState, 0) as any;
        
        // Should have merged with initial state
        expect(migratedState.experienceLevel).toBe('pro');
        expect(migratedState.critiqueIntensity).toBe(initialState.critiqueIntensity); // Should be default
        expect(migratedState.nativeSpellcheckEnabled).toBe(true);
    }
  });
  
  it('returns persisted state as-is for unknown versions', () => {
      const migrate = useSettingsStore.persist.getOptions().migrate;
      if (migrate) {
          const unknownState = { foo: 'bar' };
          const result = migrate(unknownState, 99);
          expect(result).toBe(unknownState);
      }
  });

  // ---------------------------------------------------------------------------
  // Action Setters
  // ---------------------------------------------------------------------------

  it('resets suggestion weights to defaults', () => {
    useSettingsStore.getState().updateSuggestionWeight('plot', 0.5);
    expect(useSettingsStore.getState().suggestionWeights.plot).toBe(0.5);

    useSettingsStore.getState().resetSuggestionWeights();
    // Assuming defaults have plot = 1.0 (checking against initial state)
    // Actually we should check keys to be safe
    const defaultWeight = initialState.suggestionWeights['plot'] || 1.0;
    expect(useSettingsStore.getState().suggestionWeights.plot).toBe(defaultWeight);
  });

  it('updates suggestion weight for a specific category', () => {
    useSettingsStore.getState().updateSuggestionWeight('character', 1.5);
    expect(useSettingsStore.getState().suggestionWeights.character).toBe(1.5);
    expect(useSettingsStore.getState().suggestionWeights.plot).toBeDefined();
  });

  describe('Simple Setters (Branch Coverage)', () => {
    it('updates critique intensity', () => {
      useSettingsStore.getState().setCritiqueIntensity('intensive');
      expect(useSettingsStore.getState().critiqueIntensity).toBe('intensive');
      
      // Idempotency check (cov: state === intensity ? state ...)
      const state1 = useSettingsStore.getState();
      useSettingsStore.getState().setCritiqueIntensity('intensive');
      expect(useSettingsStore.getState()).toBe(state1);
    });

    it('updates experience level', () => {
        useSettingsStore.getState().setExperienceLevel('pro');
        expect(useSettingsStore.getState().experienceLevel).toBe('pro');
        
        const state1 = useSettingsStore.getState();
        useSettingsStore.getState().setExperienceLevel('pro');
        expect(useSettingsStore.getState()).toBe(state1);
    });

    it('updates autonomy mode', () => {
      useSettingsStore.getState().setAutonomyMode('copilot');
      expect(useSettingsStore.getState().autonomyMode).toBe('copilot');
      
      const state1 = useSettingsStore.getState();
      useSettingsStore.getState().setAutonomyMode('copilot');
      expect(useSettingsStore.getState()).toBe(state1);
    });

    it('updates budget threshold', () => {
      useSettingsStore.getState().setBudgetThreshold(5.0);
      expect(useSettingsStore.getState().budgetThreshold).toBe(5.0);
      
      const state1 = useSettingsStore.getState();
      useSettingsStore.getState().setBudgetThreshold(5.0);
      expect(useSettingsStore.getState()).toBe(state1);
    });

    it('updates native spellcheck enabled', () => {
      useSettingsStore.getState().setNativeSpellcheckEnabled(false);
      expect(useSettingsStore.getState().nativeSpellcheckEnabled).toBe(false);
      
      const state1 = useSettingsStore.getState();
      useSettingsStore.getState().setNativeSpellcheckEnabled(false);
      expect(useSettingsStore.getState()).toBe(state1);
      
      // Toggle back
      useSettingsStore.getState().setNativeSpellcheckEnabled(true);
      expect(useSettingsStore.getState().nativeSpellcheckEnabled).toBe(true);
    });

    it('updates developer mode enabled', () => {
      useSettingsStore.getState().setDeveloperModeEnabled(true);
      expect(useSettingsStore.getState().developerModeEnabled).toBe(true);
      
      const state1 = useSettingsStore.getState();
      useSettingsStore.getState().setDeveloperModeEnabled(true);
      expect(useSettingsStore.getState()).toBe(state1);
    });

    it('updates model build', () => {
      useSettingsStore.getState().setModelBuild('cheap');
      expect(useSettingsStore.getState().modelBuild).toBe('cheap');
      
      const state1 = useSettingsStore.getState();
      useSettingsStore.getState().setModelBuild('cheap');
      expect(useSettingsStore.getState()).toBe(state1);
    });

    it('updates free api key', () => {
      useSettingsStore.getState().setFreeApiKey('test-free-key');
      expect(useSettingsStore.getState().freeApiKey).toBe('test-free-key');
      
      const state1 = useSettingsStore.getState();
      useSettingsStore.getState().setFreeApiKey('test-free-key');
      expect(useSettingsStore.getState()).toBe(state1);
    });

    it('updates paid api key', () => {
      useSettingsStore.getState().setPaidApiKey('test-paid-key');
      expect(useSettingsStore.getState().paidApiKey).toBe('test-paid-key');
      
      const state1 = useSettingsStore.getState();
      useSettingsStore.getState().setPaidApiKey('test-paid-key');
      expect(useSettingsStore.getState()).toBe(state1);
    });
  });
});
