import { describe, it, expect, beforeEach, vi } from 'vitest';

// Unmock the store since this test needs the real implementation
vi.unmock('@/features/project/store/useProjectStore');

import { useProjectStore } from '@/features/project/store/useProjectStore';
import { db } from '@/services/db';
import { seedProjectBedsideNoteFromAuthor } from '@/services/memory/chains';

// Mock the database
vi.mock('@/services/db', () => ({
  db: {
    transaction: vi.fn(async (mode, ...args) => {
        // The last arg is the body function
        const body = args[args.length - 1];
        if (typeof body === 'function') {
            await body();
        }
    }),
    projects: {
      orderBy: vi.fn(() => ({
        reverse: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([]))
        }))
      })),
      get: vi.fn(() => Promise.resolve(null)),
      add: vi.fn(() => Promise.resolve()),
      update: vi.fn(() => Promise.resolve()),
      bulkPut: vi.fn(() => Promise.resolve()),
    },
    chapters: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          sortBy: vi.fn(() => Promise.resolve([]))
        }))
      })),
      add: vi.fn(() => Promise.resolve()),
      update: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
      bulkAdd: vi.fn(() => Promise.resolve()),
      bulkPut: vi.fn(() => Promise.resolve()),
      get: vi.fn(() => Promise.resolve(null)),
    }
  }
}));

// Mock manuscriptIndexer
vi.mock('@/services/manuscriptIndexer', () => ({
  createEmptyIndex: vi.fn(() => ({
    characters: {},
    lastUpdated: {},
  }))
}));

vi.mock('@/services/memory/chains', () => ({
  seedProjectBedsideNoteFromAuthor: vi.fn(() => Promise.resolve()),
}));

describe('useProjectStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the store before each test
    useProjectStore.setState({
      projects: [],
      currentProject: null,
      chapters: [],
      activeChapterId: null,
      isLoading: false,
    });
  });

  describe('initial state', () => {
    it('starts with empty state', () => {
      const state = useProjectStore.getState();
      expect(state.projects).toEqual([]);
      expect(state.currentProject).toBeNull();
      expect(state.chapters).toEqual([]);
      expect(state.activeChapterId).toBeNull();
    });
  });

  describe('selectChapter', () => {
    it('updates activeChapterId', () => {
      const { selectChapter } = useProjectStore.getState();
      selectChapter('test-chapter-id');
      
      expect(useProjectStore.getState().activeChapterId).toBe('test-chapter-id');
    });
  });

  describe('getActiveChapter', () => {
    it('returns undefined when no active chapter', () => {
      const { getActiveChapter } = useProjectStore.getState();
      expect(getActiveChapter()).toBeUndefined();
    });

    it('returns the active chapter when set', () => {
      const testChapter = {
        id: 'chapter-1',
        projectId: 'project-1',
        title: 'Test Chapter',
        content: 'Test content',
        order: 0,
        updatedAt: Date.now(),
      };

      useProjectStore.setState({
        chapters: [testChapter],
        activeChapterId: 'chapter-1',
      });

      const { getActiveChapter } = useProjectStore.getState();
      const active = getActiveChapter();
      
      expect(active?.title).toBe('Test Chapter');
      expect(active?.content).toBe('Test content');
    });
  });

  describe('chapter state updates', () => {
    // ... existing tests ...

    it('debounces persistence of chapter content', async () => {
      vi.useFakeTimers();
      const testChapter = {
        id: 'c-debounce',
        projectId: 'p-debounce',
        title: 'Title',
        content: 'Initial',
        order: 0,
        updatedAt: Date.now(),
      };
      
      // Setup DB mocks for this test
      const { db } = await import('@/services/db');
      vi.mocked(db.chapters.get).mockResolvedValue(testChapter as any);
      vi.mocked(db.chapters.update).mockResolvedValue(undefined);
      vi.mocked(db.projects.update).mockResolvedValue(undefined);

      useProjectStore.setState({
        chapters: [testChapter],
        activeChapterId: 'c-debounce',
      });

      const { updateChapterContent } = useProjectStore.getState();

      // Trigger multiple updates rapidly
      updateChapterContent('c-debounce', 'Update 1');
      updateChapterContent('c-debounce', 'Update 2');
      const p = updateChapterContent('c-debounce', 'Update 3');

      // Should not have persisted yet
      expect(db.chapters.update).not.toHaveBeenCalled();

      // Fast forward
      vi.runAllTimers();
      await p;

      // Should verify it eventually updated with the LAST content
      expect(db.chapters.update).toHaveBeenCalledTimes(1);
      expect(db.chapters.update).toHaveBeenCalledWith('c-debounce', expect.objectContaining({ content: 'Update 3' }));
      
      vi.useRealTimers();
    });

    it('handles persistence errors gracefully', async () => {
      vi.useFakeTimers();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const testChapter = {
        id: 'c-error',
        projectId: 'p-error',
        title: 'Title',
        content: 'Initial',
        order: 0,
        updatedAt: Date.now(),
      };

      const { db } = await import('@/services/db');
      vi.mocked(db.chapters.get).mockResolvedValue(testChapter as any);
      vi.mocked(db.chapters.update).mockRejectedValue(new Error('DB Failed'));

      useProjectStore.setState({
        chapters: [testChapter],
        activeChapterId: 'c-error',
      });

      const { updateChapterContent } = useProjectStore.getState();
      const promise = updateChapterContent('c-error', 'Fail Content'); // Logic returns a promise that resolves when persisted? NO, it returns the debounce promise.

      vi.runAllTimers();

      // The debounce promise wraps the persist call. If persist throws, the promise rejects?
      // implementation: void persistChapter(chapterId, resolveFn); 
      // wait, persistChapter throws but it's called inside setTimeout as void.
      // However, scheduleChapterPersist returns a promise that is resolved via resolveFn passed to persistChapter.
      // If persistChapter throws, resolveFn might not be called? 
      // Actually: finally { resolveFn?.() } in persistChapter ensures it resolves.
      // Error is caught and logged.
      
      await expect(promise).resolves.toBeUndefined(); // Should resolve despite error due to finally block
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to persist'), expect.any(Error));
      
      consoleSpy.mockRestore();
      vi.useRealTimers();
    });

    it('falls back to simple update if project not found during persist', async () => {
        vi.useFakeTimers();
        const testChapter = {
          id: 'c-orphan',
          // No project ID or mock db.chapters.get returns chapter with no projectId
          projectId: undefined,
          title: 'Title',
          content: 'Initial',
          order: 0,
          updatedAt: Date.now(),
        };
  
        const { db } = await import('@/services/db');
        // db.chapters.get returns the chapter but maybe it's missing projectId ref
        vi.mocked(db.chapters.get).mockResolvedValue(testChapter as any);
        vi.mocked(db.chapters.update).mockResolvedValue(undefined);
  
        useProjectStore.setState({
          chapters: [testChapter as any],
          activeChapterId: 'c-orphan',
        });
  
        const { updateChapterContent } = useProjectStore.getState();
        const p = updateChapterContent('c-orphan', 'Orphan content');
  
        vi.runAllTimers();
        await p;
  
        // Should call chapters.update but NOT projects.update
        expect(db.chapters.update).toHaveBeenCalledWith('c-orphan', expect.anything());
        expect(db.projects.update).not.toHaveBeenCalled();
        
        vi.useRealTimers();
    });


  describe('deleteChapter', () => {
    it('removes chapter and updates active', async () => {
      const chapters = [
        { id: 'chapter-1', projectId: 'p1', title: 'Ch 1', content: '', order: 0, updatedAt: 0 },
        { id: 'chapter-2', projectId: 'p1', title: 'Ch 2', content: '', order: 1, updatedAt: 0 },
      ];

      useProjectStore.setState({
        chapters,
        activeChapterId: 'chapter-1',
      });

      const { deleteChapter } = useProjectStore.getState();
      await deleteChapter('chapter-1');

      const state = useProjectStore.getState();
      expect(state.chapters).toHaveLength(1);
      expect(state.chapters[0].id).toBe('chapter-2');
      expect(state.activeChapterId).toBe('chapter-2');
    });

    it('sets activeChapterId to null when deleting last chapter', async () => {
      const chapters = [
        { id: 'chapter-1', projectId: 'p1', title: 'Ch 1', content: '', order: 0, updatedAt: 0 },
      ];

      useProjectStore.setState({
        chapters,
        activeChapterId: 'chapter-1',
      });

      const { deleteChapter } = useProjectStore.getState();
      await deleteChapter('chapter-1');

      const state = useProjectStore.getState();
      expect(state.chapters).toHaveLength(0);
      expect(state.activeChapterId).toBeNull();
    });

    it('keeps activeChapterId unchanged when deleting non-active chapter', async () => {
      const chapters = [
        { id: 'chapter-1', projectId: 'p1', title: 'Ch 1', content: '', order: 0, updatedAt: 0 },
        { id: 'chapter-2', projectId: 'p1', title: 'Ch 2', content: '', order: 1, updatedAt: 0 },
      ];

      useProjectStore.setState({
        chapters,
        activeChapterId: 'chapter-1',
      });

      const { deleteChapter } = useProjectStore.getState();
      await deleteChapter('chapter-2');

      const state = useProjectStore.getState();
      expect(state.chapters).toHaveLength(1);
      expect(state.activeChapterId).toBe('chapter-1');
    });
  });

  describe('createChapter', () => {
    it('creates a new chapter and sets it active', async () => {
      const testProject = {
        id: 'project-1',
        title: 'Test Project',
        author: 'Test Author',
        manuscriptIndex: { characters: {}, lastUpdated: {} },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.setState({
        currentProject: testProject,
        chapters: [],
      });

      const { createChapter } = useProjectStore.getState();
      const newId = await createChapter('My New Chapter');

      const state = useProjectStore.getState();
      expect(newId).toBeDefined();
      expect(state.chapters).toHaveLength(1);
      expect(state.chapters[0].title).toBe('My New Chapter');
      expect(state.activeChapterId).toBe(newId);
    });

    it('auto-generates chapter title if not provided', async () => {
      const testProject = {
        id: 'project-1',
        title: 'Test Project',
        author: 'Test Author',
        manuscriptIndex: { characters: {}, lastUpdated: {} },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.setState({
        currentProject: testProject,
        chapters: [],
      });

      const { createChapter } = useProjectStore.getState();
      await createChapter();

      const state = useProjectStore.getState();
      expect(state.chapters[0].title).toBe('Chapter 1');
    });

    it('returns empty string if no project loaded', async () => {
      useProjectStore.setState({
        currentProject: null,
        chapters: [],
      });

      const { createChapter } = useProjectStore.getState();
      const result = await createChapter();

      expect(result).toBe('');
    });

    it('calculates correct order for new chapters', async () => {
      const testProject = {
        id: 'project-1',
        title: 'Test Project',
        author: 'Test Author',
        manuscriptIndex: { characters: {}, lastUpdated: {} },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const existingChapters = [
        { id: 'ch-1', projectId: 'project-1', title: 'Ch 1', content: '', order: 0, updatedAt: 0 },
        { id: 'ch-2', projectId: 'project-1', title: 'Ch 2', content: '', order: 1, updatedAt: 0 },
      ];

      useProjectStore.setState({
        currentProject: testProject,
        chapters: existingChapters,
      });

      const { createChapter } = useProjectStore.getState();
      await createChapter('Chapter 3');

      const state = useProjectStore.getState();
      expect(state.chapters).toHaveLength(3);
      expect(state.chapters[2].order).toBe(2);
    });
  });

  describe('reorderChapters', () => {
    it('updates chapter order in state', async () => {
      const chapters = [
        { id: 'ch-1', projectId: 'p1', title: 'Ch 1', content: '', order: 0, updatedAt: 0 },
        { id: 'ch-2', projectId: 'p1', title: 'Ch 2', content: '', order: 1, updatedAt: 0 },
        { id: 'ch-3', projectId: 'p1', title: 'Ch 3', content: '', order: 2, updatedAt: 0 },
      ];

      useProjectStore.setState({ chapters });

      const reordered = [chapters[2], chapters[0], chapters[1]]; // 3, 1, 2
      const { reorderChapters } = useProjectStore.getState();
      await reorderChapters(reordered);

      const state = useProjectStore.getState();
      expect(state.chapters[0].id).toBe('ch-3');
      expect(state.chapters[1].id).toBe('ch-1');
      expect(state.chapters[2].id).toBe('ch-2');
    });

    it('syncs order metadata and project timestamp when reordering', async () => {
      const baseChapter = { projectId: 'p1', content: '', updatedAt: 0 };
      const chapters = [
        { id: 'ch-1', title: 'Ch 1', order: 0, ...baseChapter },
        { id: 'ch-2', title: 'Ch 2', order: 1, ...baseChapter },
        { id: 'ch-3', title: 'Ch 3', order: 2, ...baseChapter },
      ];

      const project = {
        id: 'p1',
        title: 'Test',
        author: 'Author',
        manuscriptIndex: { characters: {}, lastUpdated: {} },
        createdAt: 0,
        updatedAt: 0,
      };

      useProjectStore.setState({ chapters, currentProject: project });

      const reordered = [chapters[1], chapters[2], chapters[0]]; // 2,3,1
      const { reorderChapters } = useProjectStore.getState();
      await reorderChapters(reordered);

      const state = useProjectStore.getState();
      const updatedTimestamp = state.chapters[0].updatedAt;

      expect(state.chapters.map((c) => c.order)).toEqual([0, 1, 2]);
      expect(state.chapters.every((c) => c.updatedAt === updatedTimestamp)).toBe(true);

      expect(db.chapters.bulkPut).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'ch-2', order: 0, updatedAt: updatedTimestamp }),
          expect.objectContaining({ id: 'ch-3', order: 1, updatedAt: updatedTimestamp }),
          expect.objectContaining({ id: 'ch-1', order: 2, updatedAt: updatedTimestamp }),
        ]),
      );

      expect(db.projects.update).toHaveBeenCalledWith('p1', { updatedAt: updatedTimestamp });
    });
  });

  describe('updateChapterAnalysis', () => {
    it('stores analysis result on chapter', async () => {
      const testChapter = {
        id: 'chapter-1',
        projectId: 'project-1',
        title: 'Test Chapter',
        content: 'Test content',
        order: 0,
        updatedAt: Date.now(),
      };

      useProjectStore.setState({ chapters: [testChapter] });

      const mockAnalysis = {
        summary: 'Great chapter',
        strengths: ['Good pacing'],
        weaknesses: [],
        pacing: { score: 8, analysis: 'Well paced', slowSections: [], fastSections: [] },
        plotIssues: [],
        characters: [],
        generalSuggestions: [],
      };

      const { updateChapterAnalysis } = useProjectStore.getState();
      await updateChapterAnalysis('chapter-1', mockAnalysis);

      const state = useProjectStore.getState();
      expect(state.chapters[0].lastAnalysis).toEqual(mockAnalysis);
    });
  });

  describe('updateProjectLore', () => {
    it('updates lore on current project and projects list', async () => {
      const testProject = {
        id: 'project-1',
        title: 'Test Project',
        author: 'Test Author',
        manuscriptIndex: { characters: {}, lastUpdated: {} },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.setState({
        currentProject: testProject,
        projects: [testProject],
      });

      const newLore = {
        characters: [{ name: 'Hero', bio: 'Main character' }],
        worldRules: ['Magic is real'],
      };

      const { updateProjectLore } = useProjectStore.getState();
      await updateProjectLore('project-1', newLore as any);

      const state = useProjectStore.getState();
      expect(state.currentProject?.lore).toEqual(newLore);
      expect(state.projects[0].lore).toEqual(newLore);
    });

    it('does not update if project ID does not match', async () => {
      const testProject = {
        id: 'project-1',
        title: 'Test Project',
        author: 'Test Author',
        manuscriptIndex: { characters: {}, lastUpdated: {} },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.setState({
        currentProject: testProject,
        projects: [testProject],
      });

      const newLore = { characters: [], worldRules: [] };
      const { updateProjectLore } = useProjectStore.getState();
      await updateProjectLore('different-project', newLore as any);

      const state = useProjectStore.getState();
      expect(state.currentProject?.lore).toBeUndefined();
    });
  });

  describe('updateManuscriptIndex', () => {
    it('updates manuscript index on project', async () => {
      const testProject = {
        id: 'project-1',
        title: 'Test Project',
        author: 'Test Author',
        manuscriptIndex: { characters: {}, lastUpdated: {} },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useProjectStore.setState({
        currentProject: testProject,
        projects: [testProject],
      });

      const newIndex = {
        characters: {
          'John': {
            name: 'John',
            firstMention: { chapterId: '1', position: 0 },
            mentions: [],
            attributes: {},
          },
        },
        lastUpdated: { '1': Date.now() },
      };

      const { updateManuscriptIndex } = useProjectStore.getState();
      await updateManuscriptIndex('project-1', newIndex as any);

      const state = useProjectStore.getState();
      expect(state.currentProject?.manuscriptIndex).toEqual(newIndex);
      expect(state.projects[0].manuscriptIndex).toEqual(newIndex);
    });
  });

  describe('init', () => {
    it('loads projects from database', async () => {
      const { db } = await import('@/services/db');
      const mockProjects = [
        { id: 'p1', title: 'Project 1', author: 'Author', createdAt: 1000, updatedAt: 2000, manuscriptIndex: { characters: {}, lastUpdated: {} } },
      ];

      vi.mocked(db.projects.orderBy).mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockProjects),
        }),
      } as any);

      vi.mocked(db.projects.get).mockResolvedValue(mockProjects[0] as any);
      vi.mocked(db.chapters.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          sortBy: vi.fn().mockResolvedValue([]),
        }),
      } as any);
      vi.mocked(db.chapters.add).mockResolvedValue(undefined);

      const { init } = useProjectStore.getState();
      await init();

      const state = useProjectStore.getState();
      expect(state.projects).toEqual(mockProjects);
      // Note: init starts loadProject but doesn't await it, so isLoading may still be true
      // The main assertion is that projects are loaded into state
    });

    it('handles empty projects list', async () => {
      const { db } = await import('@/services/db');
      
      vi.mocked(db.projects.orderBy).mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const { init } = useProjectStore.getState();
      await init();

      const state = useProjectStore.getState();
      expect(state.projects).toEqual([]);
      expect(state.isLoading).toBe(false); // No loadProject called, so isLoading is set to false
    });
  });

  describe('createProject', () => {
    it('creates a new project and loads it', async () => {
      const { db } = await import('@/services/db');
      
      vi.mocked(db.projects.add).mockResolvedValue(undefined);
      vi.mocked(db.projects.get).mockResolvedValue({
        id: 'new-project-id',
        title: 'New Project',
        author: 'Author',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        manuscriptIndex: { characters: {}, lastUpdated: {} },
      } as any);
      vi.mocked(db.chapters.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          sortBy: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const { createProject } = useProjectStore.getState();
      const projectId = await createProject('New Project', 'Author');

      expect(projectId).toBeDefined();
      expect(db.projects.add).toHaveBeenCalled();
      expect(seedProjectBedsideNoteFromAuthor).toHaveBeenCalledWith(projectId);
    });

    it('creates project with setting information', async () => {
      const { db } = await import('@/services/db');
      
      // Clear mocks from previous test
      vi.mocked(db.projects.add).mockClear();
      vi.mocked(db.projects.add).mockResolvedValue(undefined);
      vi.mocked(db.projects.get).mockResolvedValue({
        id: 'new-project-id',
        title: 'Historical Novel',
        author: 'Author',
        setting: { timePeriod: 'Victorian', location: 'London' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        manuscriptIndex: { characters: {}, lastUpdated: {} },
      } as any);
      vi.mocked(db.chapters.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          sortBy: vi.fn().mockResolvedValue([]),
        }),
      } as any);
      vi.mocked(db.chapters.add).mockResolvedValue(undefined);

      const { createProject } = useProjectStore.getState();
      await createProject('Historical Novel', 'Author', { timePeriod: 'Victorian', location: 'London' });

      const addCall = vi.mocked(db.projects.add).mock.calls[0][0] as any;
      expect(addCall.setting).toEqual({ timePeriod: 'Victorian', location: 'London' });
    });
  });

  describe('importProject', () => {
    it('imports project with chapters', async () => {
      const { db } = await import('@/services/db');
      
      vi.mocked(db.projects.add).mockResolvedValue(undefined);
      vi.mocked(db.chapters.bulkAdd).mockResolvedValue(undefined);

      const parsedChapters = [
        { title: 'Chapter 1', content: 'Content 1' },
        { title: 'Chapter 2', content: 'Content 2' },
      ];

      const { importProject } = useProjectStore.getState();
      const projectId = await importProject('Imported Book', parsedChapters);

      expect(projectId).toBeDefined();
      expect(db.projects.add).toHaveBeenCalled();
      expect(db.chapters.bulkAdd).toHaveBeenCalled();

      const state = useProjectStore.getState();
      expect(state.chapters).toHaveLength(2);
      expect(state.chapters[0].title).toBe('Chapter 1');
      expect(state.chapters[1].title).toBe('Chapter 2');
    });

    it('selects first chapter as active after import', async () => {
      const { db } = await import('@/services/db');
      
      vi.mocked(db.projects.add).mockResolvedValue(undefined);
      vi.mocked(db.chapters.bulkAdd).mockResolvedValue(undefined);

      const parsedChapters = [
        { title: 'Chapter 1', content: 'Content 1' },
      ];

      const { importProject } = useProjectStore.getState();
      await importProject('Imported Book', parsedChapters);

      const state = useProjectStore.getState();
      expect(state.activeChapterId).toBe(state.chapters[0].id);
    });
  });

  describe('loadProject', () => {
    it('loads project and chapters from database', async () => {
      const { db } = await import('@/services/db');
      
      const mockProject = {
        id: 'project-1',
        title: 'Test Project',
        author: 'Author',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        manuscriptIndex: { characters: {}, lastUpdated: {} },
      };

      const mockChapters = [
        { id: 'ch-1', projectId: 'project-1', title: 'Chapter 1', content: '', order: 0, updatedAt: 0 },
      ];

      vi.mocked(db.projects.get).mockResolvedValue(mockProject as any);
      vi.mocked(db.chapters.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          sortBy: vi.fn().mockResolvedValue(mockChapters),
        }),
      } as any);

      const { loadProject } = useProjectStore.getState();
      await loadProject('project-1');

      const state = useProjectStore.getState();
      expect(state.currentProject?.id).toBe('project-1');
      expect(state.chapters).toHaveLength(1);
      expect(state.activeChapterId).toBe('ch-1');
      expect(state.isLoading).toBe(false);
    });

    it('creates first chapter if project has none', async () => {
      const { db } = await import('@/services/db');
      
      const mockProject = {
        id: 'project-1',
        title: 'Empty Project',
        author: 'Author',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        manuscriptIndex: { characters: {}, lastUpdated: {} },
      };

      vi.mocked(db.projects.get).mockResolvedValue(mockProject as any);
      vi.mocked(db.chapters.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          sortBy: vi.fn().mockResolvedValue([]),
        }),
      } as any);
      vi.mocked(db.chapters.add).mockResolvedValue(undefined);

      const { loadProject } = useProjectStore.getState();
      await loadProject('project-1');

      expect(db.chapters.add).toHaveBeenCalled();
      const state = useProjectStore.getState();
      expect(state.chapters).toHaveLength(1);
      expect(state.chapters[0].title).toBe('Chapter 1');
    });

    it('handles non-existent project gracefully', async () => {
      const { db } = await import('@/services/db');
      
      vi.mocked(db.projects.get).mockResolvedValue(null);

      const { loadProject } = useProjectStore.getState();
      await loadProject('non-existent');

      const state = useProjectStore.getState();
      expect(state.currentProject).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('updateChapterBranchState', () => {
    it('updates branch state in store and db', async () => {
       const testChapter = {
        id: 'chapter-1',
        projectId: 'project-1',
        title: 'Chapter 1',
        content: 'Content',
        order: 0,
        updatedAt: Date.now(),
      };

      const { db } = await import('@/services/db');
      vi.mocked(db.chapters.get).mockResolvedValue(testChapter as any);
      vi.mocked(db.chapters.update).mockResolvedValue(undefined);
      vi.mocked(db.projects.update).mockResolvedValue(undefined);

      useProjectStore.setState({
        chapters: [testChapter],
      });

      const { updateChapterBranchState } = useProjectStore.getState();
      const updates = {
        branches: [{ id: 'b1', name: 'Draft', content: 'New Content', createdAt: 1 }],
        activeBranchId: 'b1',
        content: 'New Content'
      };

      await updateChapterBranchState('chapter-1', updates);

      const state = useProjectStore.getState();
      const updatedChapter = state.chapters[0];

      expect(updatedChapter.branches).toEqual(updates.branches);
      expect(updatedChapter.activeBranchId).toBe('b1');
      expect(updatedChapter.content).toBe('New Content');
      expect(db.chapters.update).toHaveBeenCalledWith('chapter-1', expect.objectContaining(updates));
      expect(db.projects.update).toHaveBeenCalled();
    });
  });

  describe('flushPendingWrites', () => {
    it('flushes pending writes', async () => {
        vi.useFakeTimers();
        const { updateChapterContent, flushPendingWrites } = useProjectStore.getState();
        const { db } = await import('@/services/db');
        vi.mocked(db.chapters.get).mockResolvedValue({ projectId: 'p1' } as any);

        // Trigger a write
        updateChapterContent('c1', 'new content');

        // Should be pending
        const result = await flushPendingWrites({ reason: 'test' });
        expect(result.pendingCount).toBe(1);
        expect(result.errors).toHaveLength(0);

        expect(db.chapters.update).toHaveBeenCalled();

        vi.useRealTimers();
    });

    it('queues persistence keepalive when keepAlive is true', async () => {
      vi.useFakeTimers();

      const mockSendBeacon = vi.fn(() => true);
      globalThis.navigator = {
        sendBeacon: mockSendBeacon,
        serviceWorker: {
          ready: Promise.resolve({} as ServiceWorkerRegistration),
        },
      } as unknown as Navigator;

      const { updateChapterContent, flushPendingWrites } = useProjectStore.getState();
      const { db } = await import('@/services/db');

      vi.mocked(db.chapters.get).mockResolvedValue({ projectId: 'p1' } as any);

      const persistPromise = updateChapterContent('c1', 'new content');

      const result = await flushPendingWrites({ reason: 'test-keepalive', keepAlive: true });
      await persistPromise;

      expect(result.pendingCount).toBe(1);
      expect(mockSendBeacon).toHaveBeenCalledWith(
        '/__quill/pending-writes',
        expect.any(Blob),
      );

      vi.useRealTimers();
    });

    it('registers background sync if supported', async () => {
      vi.useFakeTimers();

      const mockRegister = vi.fn().mockResolvedValue(undefined);
      const mockSync = { register: mockRegister };
      
      globalThis.navigator = {
        sendBeacon: vi.fn(),
        serviceWorker: {
          ready: Promise.resolve({ sync: mockSync } as any),
        },
      } as unknown as Navigator;

      const { updateChapterContent, flushPendingWrites } = useProjectStore.getState();
      const { db } = await import('@/services/db');
      vi.mocked(db.chapters.get).mockResolvedValue({ projectId: 'p1' } as any);

      updateChapterContent('c1', 'new content');
      await flushPendingWrites({ reason: 'test-sync', keepAlive: true });

      expect(mockRegister).toHaveBeenCalledWith('flush-pending-writes');
      
      vi.useRealTimers();
    });
  });

  describe('createProject', () => {
    // ... existing tests ...
    
    it('logs warning if Bedside Note seeding fails', async () => {
        const { db } = await import('@/services/db');
        const { seedProjectBedsideNoteFromAuthor } = await import('@/services/memory/chains');
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        vi.mocked(db.projects.add).mockResolvedValue(undefined);
        vi.mocked(db.projects.get).mockResolvedValue({ id: 'p1' } as any);
        vi.mocked(db.chapters.where).mockReturnValue({
            equals: vi.fn().mockReturnValue({
              sortBy: vi.fn().mockResolvedValue([]),
            }),
          } as any);

        vi.mocked(seedProjectBedsideNoteFromAuthor).mockRejectedValue(new Error('Seed Failed'));

        const { createProject } = useProjectStore.getState();
        await createProject('Warning Project');

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to seed'), expect.any(Error));
        consoleSpy.mockRestore();
    });
  });

  describe('updateChapterBranchState', () => {
      // ... existing tests ...
      
      it('handles optional updates', async () => {
        const testChapter = {
            id: 'chapter-1',
            projectId: 'project-1',
            title: 'Chapter 1',
            content: 'Content',
            order: 0,
            updatedAt: Date.now(),
        };

        const { db } = await import('@/services/db');
        vi.mocked(db.chapters.get).mockResolvedValue(testChapter as any);
        // We need to support multiple calls
        const updateMock = vi.mocked(db.chapters.update).mockResolvedValue(undefined);

        useProjectStore.setState({ chapters: [testChapter] });
        const { updateChapterBranchState } = useProjectStore.getState();

        // 1. Only activeBranchId
        await updateChapterBranchState('chapter-1', { activeBranchId: 'b2' });
        expect(useProjectStore.getState().chapters[0].activeBranchId).toBe('b2');
        expect(updateMock).toHaveBeenLastCalledWith('chapter-1', expect.objectContaining({ activeBranchId: 'b2' }));

        // 2. Only content
        await updateChapterBranchState('chapter-1', { content: 'New' });
        expect(useProjectStore.getState().chapters[0].content).toBe('New');

        // 3. Only branches
        const branches = [{ id: 'b1', name: 'B', content: 'C', createdAt: 0 }];
        await updateChapterBranchState('chapter-1', { branches });
        expect(useProjectStore.getState().chapters[0].branches).toEqual(branches);
      });
  });

  describe('concurrent operations and closing projects', () => {
    it('allows loading a project while pending writes are being flushed', async () => {
      vi.useFakeTimers();

      const { updateChapterContent, flushPendingWrites, loadProject } = useProjectStore.getState();
      const { db } = await import('@/services/db');

      // Configure DB so both persistence and load paths succeed
      vi.mocked(db.chapters.get).mockResolvedValue({ id: 'c1', projectId: 'p1' } as any);
      vi.mocked(db.projects.get).mockResolvedValue({
        id: 'p1',
        title: 'Concurrent Project',
        author: 'Author',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        manuscriptIndex: { characters: {}, lastUpdated: {} },
      } as any);
      vi.mocked(db.chapters.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          sortBy: vi.fn().mockResolvedValue([
            { id: 'c1', projectId: 'p1', title: 'Chapter 1', content: 'from db', order: 0, updatedAt: 0 },
          ]),
        }),
      } as any);

      // Schedule a debounced write
      const persistPromise = updateChapterContent('c1', 'pending content');

      // Start loading a project while the write is still pending
      const loadPromise = loadProject('p1');

      // Flush pending writes while load is in flight
      const flushResult = await flushPendingWrites({ reason: 'test-concurrent' });
      await persistPromise;
      await loadPromise;

      const state = useProjectStore.getState();
      expect(flushResult.pendingCount).toBe(1);
      expect(state.currentProject?.id).toBe('p1');
      expect(state.chapters).toHaveLength(1);
      expect(state.activeChapterId).toBe('c1');
      expect(state.isLoading).toBe(false);

      vi.useRealTimers();
    });

    it('resets project-related state when closeProject is called', () => {
      // ... existing test content ...
      useProjectStore.setState({
        projects: [{
          id: 'p1',
          title: 'Loaded Project',
          author: 'Author',
          manuscriptIndex: { characters: {}, lastUpdated: {} },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as any],
        currentProject: {
          id: 'p1',
          title: 'Loaded Project',
          author: 'Author',
          manuscriptIndex: { characters: {}, lastUpdated: {} },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as any,
        chapters: [{ id: 'c1', projectId: 'p1', title: 'Chapter', content: '', order: 0, updatedAt: 0 } as any],
        activeChapterId: 'c1',
      });

      const { closeProject } = useProjectStore.getState();
      closeProject();

      const state = useProjectStore.getState();
      expect(state.currentProject).toBeNull();
      expect(state.chapters).toEqual([]);
      expect(state.activeChapterId).toBeNull();
      // projects list is left intact so the library view can still render
      expect(state.projects).toHaveLength(1);
    });
  });

  describe('transaction fallbacks and environment checks', () => {
      it('executes body directly if db.transaction is not available', async () => {
          const { db } = await import('@/services/db');
          // Temporarily remove transaction
          const originalTransaction = db.transaction;
          // @ts-ignore
          db.transaction = undefined;

          const { updateChapterTitle } = useProjectStore.getState();
          useProjectStore.setState({ 
              chapters: [{ id: 'c1', projectId: 'p1', title: 'Old', content: '', order: 0, updatedAt: 0 }] 
          });

          await updateChapterTitle('c1', 'New Title');
          
          expect(db.projects.update).not.toHaveBeenCalled(); // updateChapterTitle calls db.chapters.update directly?
          // Wait, updateChapterTitle DOES NOT USE transaction in current implementation?
          // line 401: await db.chapters.update(chapterId, { title, updatedAt: Date.now() });
          // It doesn't update project timestamp? It seems it doesn't.
          
          // Let's use reorderChapters which definitely uses transaction.
          useProjectStore.setState({ chapters: [{ id: 'c1', projectId: 'p1', title: 'C', content: '', order: 0, updatedAt: 0 }] });
          const { reorderChapters } = useProjectStore.getState();
          
          await reorderChapters([{ id: 'c1', projectId: 'p1', title: 'C', content: '', order: 0, updatedAt: 0 }]);
          
          expect(db.chapters.bulkPut).toHaveBeenCalled();
          expect(db.projects.update).toHaveBeenCalled();
          
          // Restore
          db.transaction = originalTransaction;
      });

      it('does not keepalive if navigator is undefined', async () => {
          const originalNavigator = globalThis.navigator;
          // @ts-ignore
          delete globalThis.navigator;
          
          const { flushPendingWrites } = useProjectStore.getState();
          const result = await flushPendingWrites({ reason: 'test', keepAlive: true });
          
          // It should just run without error and NOT fail
          expect(result.errors).toHaveLength(0);
          
          globalThis.navigator = originalNavigator;
      });
      
      it('does not keepalive if pendingCount is 0', async () => {
          const mockSendBeacon = vi.fn();
          globalThis.navigator = { sendBeacon: mockSendBeacon } as any;
          
          const { flushPendingWrites } = useProjectStore.getState();
          await flushPendingWrites({ reason: 'test', keepAlive: true });
          
          expect(mockSendBeacon).not.toHaveBeenCalled();
      });
  });
  });

  describe('environment configuration', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('uses process.env.WRITE_DEBOUNCE_MS if available', async () => {
        const originalEnv = process.env;
        process.env = { ...originalEnv, WRITE_DEBOUNCE_MS: '100' };
        
        // Re-import to trigger module evaluation
        const { useProjectStore } = await import('@/features/project/store/useProjectStore');
        const { db } = await import('@/services/db');
        
        vi.useFakeTimers();
        const testChapter = {
          id: 'c-env',
          projectId: 'p-env',
          title: 'Title',
          content: 'Initial',
          order: 0,
          updatedAt: Date.now(),
        };
        
        vi.mocked(db.chapters.get).mockResolvedValue(testChapter as any);
        vi.mocked(db.chapters.update).mockResolvedValue(undefined);
        vi.mocked(db.projects.update).mockResolvedValue(undefined);

        useProjectStore.setState({
          chapters: [testChapter],
          activeChapterId: 'c-env',
        });
        
        const { updateChapterContent } = useProjectStore.getState();
        const p = updateChapterContent('c-env', 'New');
        
        // Advance 150ms should trigger it (default 400 wouldn't)
        vi.advanceTimersByTime(150);
        await p;
        
        expect(db.chapters.update).toHaveBeenCalled();
        
        process.env = originalEnv;
        vi.useRealTimers();
    });

    it('falls back to 400ms default', async () => {
        const originalEnv = process.env;
        process.env = { ...originalEnv };
        delete process.env.WRITE_DEBOUNCE_MS;
        
        const { useProjectStore } = await import('@/features/project/store/useProjectStore');
        const { db } = await import('@/services/db');
        
        vi.useFakeTimers();
        const testChapter = {
          id: 'c-def',
          projectId: 'p-def',
          title: 'Title',
          content: 'Initial',
          order: 0,
          updatedAt: Date.now(),
        };
        
        vi.mocked(db.chapters.get).mockResolvedValue(testChapter as any);
        vi.mocked(db.chapters.update).mockResolvedValue(undefined);

        useProjectStore.setState({ chapters: [testChapter], activeChapterId: 'c-def' });
        
        const { updateChapterContent } = useProjectStore.getState();
        const p = updateChapterContent('c-def', 'New');
        
        vi.advanceTimersByTime(200); // Less than 400
        expect(db.chapters.update).not.toHaveBeenCalled();
        
        vi.advanceTimersByTime(250); // Total 450
        await p;
        expect(db.chapters.update).toHaveBeenCalled();
        
        process.env = originalEnv;
        vi.useRealTimers();
    });
  });
});
