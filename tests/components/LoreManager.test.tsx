import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LoreManager } from '@/features/lore';
import { useProjectStore } from '@/features/project';
import type { CharacterProfile } from '@/types';
import type { Lore } from '@/types/schema';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- Mocks ---

vi.mock('@/features/project', () => ({
  useProjectStore: vi.fn(),
}));

const mockedUseProjectStore = vi.mocked(useProjectStore);
const updateProjectLore = vi.fn();

// --- Helpers & Setup ---

const baseCharacter: CharacterProfile = {
  name: 'Alice',
  bio: 'Explorer',
  arc: 'Growth',
  arcStages: [],
  relationships: [],
  plotThreads: [],
  inconsistencies: [],
  developmentSuggestion: '',
};

const renderLoreManager = (initialLore: Lore = { characters: [], worldRules: [] }) => {
  mockedUseProjectStore.mockReturnValue({
    currentProject: {
      id: 'project-1',
      lore: initialLore,
    },
    updateProjectLore,
  } as any);

  return render(<LoreManager />);
};

const findInputByLabel = (labelText: string, selector = 'input') => {
  // Helper to find inputs that might be nested or associated by label text
  // Since the component uses "label" tags followed by inputs, we can try finding by label text
  // or traverse the DOM if needed.
  // The component structure is: <div><label>...</label><input ... /></div>
  const label = screen.getByText(labelText);
  const container = label.parentElement;
  return container?.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
};

describe('LoreManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- World Rules Tab Tests ---

  describe('World Rules Tab', () => {
    it('switches to World Rules tab and shows empty state', () => {
      renderLoreManager();

      // Switch to World Rules tab
      fireEvent.click(screen.getByRole('button', { name: /world rules/i }));

      // Verify empty state message
      expect(screen.getByText(/no world rules defined yet/i)).toBeInTheDocument();
    });

    it('adds a new world rule', () => {
      renderLoreManager();
      fireEvent.click(screen.getByRole('button', { name: /world rules/i }));

      const input = screen.getByPlaceholderText(/add a world rule/i);
      const addButton = screen.getByRole('button', { name: /^add$/i });

      // Type and Click Add
      fireEvent.change(input, { target: { value: 'Magic has a cost' } });
      fireEvent.click(addButton);

      expect(updateProjectLore).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          worldRules: ['Magic has a cost'],
        })
      );
    });

    it('adds a new world rule via Enter key', () => {
      renderLoreManager();
      fireEvent.click(screen.getByRole('button', { name: /world rules/i }));

      const input = screen.getByPlaceholderText(/add a world rule/i);

      // Type and Press Enter
      fireEvent.change(input, { target: { value: 'Gravity is optional' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      expect(updateProjectLore).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          worldRules: ['Gravity is optional'],
        })
      );
    });

    it('edits an existing world rule', () => {
      renderLoreManager({ characters: [], worldRules: ['Rule 1'] });
      fireEvent.click(screen.getByRole('button', { name: /world rules/i }));

      const ruleInput = screen.getByDisplayValue('Rule 1');
      fireEvent.change(ruleInput, { target: { value: 'Rule 1 Updated' } });

      expect(updateProjectLore).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          worldRules: ['Rule 1 Updated'],
        })
      );
    });

    it('deletes a world rule', () => {
      renderLoreManager({ characters: [], worldRules: ['Rule A', 'Rule B'] });
      fireEvent.click(screen.getByRole('button', { name: /world rules/i }));

      // Find the delete button for the first rule. 
      // The component renders a list of rules. We can find the container for 'Rule A' and find the button inside.
      const ruleInput = screen.getByDisplayValue('Rule A');
      const ruleContainer = ruleInput.closest('div');
      const deleteButton = within(ruleContainer!).getByRole('button'); // The 'x' button

      fireEvent.click(deleteButton);

      expect(updateProjectLore).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          worldRules: ['Rule B'],
        })
      );
    });
  });

  // --- Character CRUD Tests ---

  describe('Character CRUD', () => {
    it('opens the create character form', () => {
      renderLoreManager();
      fireEvent.click(screen.getByRole('button', { name: /add character manually/i }));
      expect(screen.getByText('New Character')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save character/i })).toBeInTheDocument();
    });

    it('creates a new character with all fields', () => {
      renderLoreManager();
      fireEvent.click(screen.getByRole('button', { name: /add character manually/i }));

      // Fill basic fields
      fireEvent.change(findInputByLabel('Name'), { target: { value: 'Bob' } });
      fireEvent.change(findInputByLabel('Biography', 'textarea'), { target: { value: 'A builder' } });
      fireEvent.change(findInputByLabel('Character Arc', 'textarea'), { target: { value: 'To build a castle' } });
      fireEvent.change(findInputByLabel('Development Notes', 'textarea'), { target: { value: 'Needs a hat' } });

      // Add Relationship
      const relNameInput = screen.getByPlaceholderText('Name');
      const relTypeInput = screen.getByPlaceholderText('Type');
      const addButtons = screen.getAllByRole('button', { name: 'Add' });
      const addRelButton = addButtons[0]; // First Add button is for relationships

      fireEvent.change(relNameInput, { target: { value: 'Alice' } });
      fireEvent.change(relTypeInput, { target: { value: 'Friend' } });
      fireEvent.click(addRelButton);

      // Add Plot Thread
      const plotInput = screen.getByPlaceholderText('Add plot thread...');
      const addPlotButton = addButtons[1]; // Second Add button is for plot threads

      fireEvent.change(plotInput, { target: { value: 'Find the golden hammer' } });
      fireEvent.click(addPlotButton);

      // Save
      fireEvent.click(screen.getByRole('button', { name: /save character/i }));

      expect(updateProjectLore).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          characters: [
            expect.objectContaining({
              name: 'Bob',
              bio: 'A builder',
              arc: 'To build a castle',
              developmentSuggestion: 'Needs a hat',
              relationships: [{ name: 'Alice', type: 'Friend', dynamic: '' }],
              plotThreads: ['Find the golden hammer'],
            }),
          ],
        })
      );
    });

    it('removes a relationship', () => {
      const charWithRel = {
        ...baseCharacter,
        relationships: [{ name: 'Bob', type: 'Enemy', dynamic: 'Rivalry' }],
      };
      renderLoreManager({ characters: [charWithRel], worldRules: [] });

      // Edit character
      fireEvent.click(screen.getByText('Alice'));

      // Find relationship and delete
      expect(screen.getByText('Bob')).toBeInTheDocument();
      const removeRelButton = screen.getByText('×'); // The button text is '×'
      fireEvent.click(removeRelButton);

      // Save
      fireEvent.click(screen.getByRole('button', { name: /save character/i }));

      expect(updateProjectLore).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          characters: [
            expect.objectContaining({
              relationships: [],
            }),
          ],
        })
      );
    });

    it('removes a plot thread', () => {
      const charWithPlot = {
        ...baseCharacter,
        plotThreads: ['Save the world'],
      };
      renderLoreManager({ characters: [charWithPlot], worldRules: [] });

      // Edit character
      fireEvent.click(screen.getByText('Alice'));

      // Find plot thread and delete
      expect(screen.getByText('Save the world')).toBeInTheDocument();
      // There might be multiple '×' buttons if relationships existed, but here only plot thread has it
      const removeButtons = screen.getAllByText('×');
      fireEvent.click(removeButtons[0]);

      // Save
      fireEvent.click(screen.getByRole('button', { name: /save character/i }));

      expect(updateProjectLore).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          characters: [
            expect.objectContaining({
              plotThreads: [],
            }),
          ],
        })
      );
    });

    it('edits an existing character', () => {
      renderLoreManager({ characters: [baseCharacter], worldRules: [] });

      fireEvent.click(screen.getByText('Alice'));
      expect(screen.getByText('Edit: Alice')).toBeInTheDocument();

      fireEvent.change(findInputByLabel('Name'), { target: { value: 'Alice (Updated)' } });
      fireEvent.click(screen.getByRole('button', { name: /save character/i }));

      expect(updateProjectLore).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          characters: [
            expect.objectContaining({
              name: 'Alice (Updated)',
            }),
          ],
        })
      );
    });

    it('deletes a character', () => {
      renderLoreManager({ characters: [baseCharacter], worldRules: [] });

      fireEvent.click(screen.getByText('Alice'));
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      expect(updateProjectLore).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          characters: [],
        })
      );
    });
  });

  // --- Navigation Tests ---

  describe('Navigation', () => {
    it('cancels creating a new character', () => {
      renderLoreManager();
      fireEvent.click(screen.getByRole('button', { name: /add character manually/i }));
      
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      
      expect(screen.queryByText('New Character')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add character manually/i })).toBeInTheDocument();
    });

    it('cancels editing a character', () => {
      renderLoreManager({ characters: [baseCharacter], worldRules: [] });
      fireEvent.click(screen.getByText('Alice'));
      
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      
      expect(screen.queryByText('Edit: Alice')).not.toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('navigates back to list using "Back to list" button', () => {
      renderLoreManager({ characters: [baseCharacter], worldRules: [] });
      fireEvent.click(screen.getByText('Alice'));
      
      fireEvent.click(screen.getByText(/back to list/i));
      
      expect(screen.queryByText('Edit: Alice')).not.toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  describe('Interview & drafts', () => {
    it('invokes onInterviewCharacter when interview button is clicked', () => {
      const onInterviewCharacter = vi.fn();

      const { rerender } = renderLoreManager({ characters: [baseCharacter], worldRules: [] });

      // Ensure project store still returns our character before rerender
      mockedUseProjectStore.mockReturnValue({
        currentProject: {
          id: 'project-1',
          lore: { characters: [baseCharacter], worldRules: [] },
        },
        updateProjectLore,
      } as any);

      // Re-render with interview callback so CharacterCard receives onInterview
      rerender(
        <LoreManager
          onInterviewCharacter={onInterviewCharacter}
        />,
      );

      // Click the interview button for Alice
      const interviewButton = screen.getByRole('button', { name: /interview alice/i });
      fireEvent.click(interviewButton);

      expect(onInterviewCharacter).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Alice' }),
      );
    });

    it('initializes editor from draftCharacter and consumes draft', () => {
      const onDraftConsumed = vi.fn();
      const draftCharacter = {
        ...baseCharacter,
        name: 'Drafty',
      } as CharacterProfile;

      mockedUseProjectStore.mockReturnValue({
        currentProject: {
          id: 'project-1',
          lore: { characters: [], worldRules: [] },
        },
        updateProjectLore,
      } as any);

      render(
        <LoreManager
          draftCharacter={draftCharacter}
          onDraftConsumed={onDraftConsumed}
        />,
      );

      expect(onDraftConsumed).toHaveBeenCalled();
      expect(screen.getByText('New Character')).toBeInTheDocument();

      const nameInput = findInputByLabel('Name');
      expect(nameInput.value).toBe('Drafty');
    });

    it('handles partial draft character with defaults', () => {
      const onDraftConsumed = vi.fn();
      const partialDraft = { name: 'Partial' } as CharacterProfile;

      mockedUseProjectStore.mockReturnValue({
        currentProject: { id: 'p1', lore: { characters: [], worldRules: [] } },
        updateProjectLore,
      } as any);

      render(<LoreManager draftCharacter={partialDraft} onDraftConsumed={onDraftConsumed} />);
      
      const bioInput = findInputByLabel('Biography', 'textarea') as HTMLTextAreaElement;
      expect(bioInput.value).toBe(''); // Default
    });
  });

  describe('Validation & Guards', () => {
      it('does not add world rule if empty', () => {
          renderLoreManager();
          fireEvent.click(screen.getByRole('button', { name: /world rules/i }));
          
          const addButton = screen.getByRole('button', { name: /^add$/i });
          
          // Verify input is empty initially
          const input = screen.getByPlaceholderText(/add a world rule/i) as HTMLInputElement;
          expect(input.value).toBe('');

          fireEvent.click(addButton);
          expect(updateProjectLore).not.toHaveBeenCalled();
      });

      it('does not add relationship if incomplete', () => {
          renderLoreManager();
          fireEvent.click(screen.getByRole('button', { name: /add character manually/i }));

          const addButtons = screen.getAllByRole('button', { name: 'Add' });
          const addRelButton = addButtons[0];

          // Empty check
          fireEvent.click(addRelButton);
          
          // Partial check
          const relNameInput = screen.getByPlaceholderText('Name');
          fireEvent.change(relNameInput, { target: { value: 'Incomplete' } });
          fireEvent.click(addRelButton);

          // Should not see the relationship added to the list
          expect(screen.queryByText('Incomplete')).not.toBeInTheDocument();
      });

    it('invokes interview from Editor view', () => {
        const onInterview = vi.fn();
        mockedUseProjectStore.mockReturnValue({
            currentProject: { id: 'p1', lore: { characters: [baseCharacter], worldRules: [] } },
            updateProjectLore,
        } as any);

        render(<LoreManager onInterviewCharacter={onInterview} />);
        
        // Enter editor
        fireEvent.click(screen.getByText(baseCharacter.name));
        
        // Find interview button in editor
        const interviewButton = screen.getByRole('button', { name: /interview alice/i });
        fireEvent.click(interviewButton);
        
        expect(onInterview).toHaveBeenCalled();
    });

    it('preserves other characters when editing one', () => {
        const charA = { ...baseCharacter, name: 'Alice' };
        const charB = { ...baseCharacter, name: 'Bob' };
        
        mockedUseProjectStore.mockReturnValue({
            currentProject: { id: 'p1', lore: { characters: [charA, charB], worldRules: [] } },
            updateProjectLore,
        } as any);

        render(<LoreManager />);
        
        // Edit Bob
        fireEvent.click(screen.getByText('Bob'));
        
        // Change name
        const nameInput = findInputByLabel('Name') as HTMLInputElement;
        fireEvent.change(nameInput, { target: { value: 'Bobby' } });
        
        // Save
        fireEvent.click(screen.getByRole('button', { name: /save character/i }));
        
        expect(updateProjectLore).toHaveBeenCalledWith(
            'p1',
            expect.objectContaining({
                characters: [
                    charA, // Alice should remain
                    expect.objectContaining({ name: 'Bobby' }) // Bob updated
                ]
            })
        );
    });



    it('renders relationship dynamic', () => {
        const charWithDynamic = {
            ...baseCharacter,
            relationships: [{ name: 'Bob', type: 'Rival', dynamic: 'Friendly Competition' }]
        };
        mockedUseProjectStore.mockReturnValue({
            currentProject: { id: 'p1', lore: { characters: [charWithDynamic], worldRules: [] } },
            updateProjectLore,
        } as any);

        render(<LoreManager />);
        // Enter editor to see detailed list
        fireEvent.click(screen.getByText('Alice'));
        expect(screen.getByText(/Friendly Competition/)).toBeInTheDocument();
    });

    it('does not submit on non-Enter key press', () => {
        renderLoreManager();
        fireEvent.click(screen.getByRole('button', { name: /world rules/i }));
        
        const input = screen.getByPlaceholderText(/add a world rule/i);
        fireEvent.change(input, { target: { value: 'Pending Rule' } });
        fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
        
        expect(updateProjectLore).not.toHaveBeenCalled();
    });

    it('handles project with undefined lore', () => {
        mockedUseProjectStore.mockReturnValue({
            currentProject: { id: 'p1' }, // No lore property
            updateProjectLore,
        } as any);
        render(<LoreManager />);
        expect(screen.getByText(/No characters yet/)).toBeInTheDocument();
    });

    it('handles lore with undefined worldRules', () => {
        mockedUseProjectStore.mockReturnValue({
            currentProject: { id: 'p1', lore: { characters: [] } }, // worldRules missing
            updateProjectLore,
        } as any);
        render(<LoreManager />);
        fireEvent.click(screen.getByRole('button', { name: /world rules/i }));
        expect(screen.getByText(/no world rules defined yet/i)).toBeInTheDocument();
    });

      it('does not add plot thread if empty', () => {
          renderLoreManager();
          fireEvent.click(screen.getByRole('button', { name: /add character manually/i }));

          const addButtons = screen.getAllByRole('button', { name: 'Add' });
          const addPlotButton = addButtons[1];
          
          fireEvent.click(addPlotButton); // Empty
          
          // Should not see empty badge
          const badges = screen.queryAllByText('×');
          expect(badges).toHaveLength(0);
      });

      it('does not crash if onInterview is undefined', () => {
        // Render without onInterview prop
        // The mock store setup is handled by renderLoreManager helper which we can reuse but override via rerender if needed, 
        // but here we just call render directly to control props exactly.
        mockedUseProjectStore.mockReturnValue({
            currentProject: { id: 'p1', lore: { characters: [baseCharacter], worldRules: [] } },
            updateProjectLore,
        } as any);

        render(<LoreManager />); 
        // Should show character card but NO interview button
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.queryByText(/interview/i)).not.toBeInTheDocument();

        // Also check editor mode
        fireEvent.click(screen.getByText('Alice'));
        expect(screen.queryByText(/interview/i)).not.toBeInTheDocument();
      });

      it('safely handles null project when saving', () => {
          mockedUseProjectStore.mockReturnValue({
              currentProject: null,
              updateProjectLore,
          } as any);

          render(<LoreManager />);
          // There is no UI to add/save really if project is null (usually) but let's try to invoke save mechanics if possible
          // The component initializes state effects based on currentProject.
          // If currentProject is null, lists are empty.
          
          // Actually if currentProject is null, `characters` derived from it is undefined/empty array fallback?
          // The code says: const characters = currentProject?.lore?.characters || [];
          
          // Tricky to trigger 'save' if we can't switch tabs or see buttons.
          // But if we simulate a "Add Manual" while project is null (if button exists):
          // The button exists if characters array is empty.
          
          fireEvent.click(screen.getByRole('button', { name: /add character manually/i }));
          fireEvent.click(screen.getByRole('button', { name: /save character/i }));
          
          expect(updateProjectLore).not.toHaveBeenCalled();
      });
  });
});
