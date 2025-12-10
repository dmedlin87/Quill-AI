import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('CommandHistory Singleton Initialization', () => {
  it('initializes globalHistory using CommandHistory.restore() if null', async () => {
    // We need to ensure the module is fresh so globalHistory is null
    vi.resetModules();

    // We mock sessionStorage to verify restore is called
    const mockGetItem = vi.fn();
    vi.stubGlobal('sessionStorage', {
      getItem: mockGetItem,
    });

    // Import the module dynamically
    const { getCommandHistory } = await import('@/services/commands/history');

    // Call the function
    getCommandHistory();

    // Check if sessionStorage.getItem was called (which means restore() was called)
    expect(mockGetItem).toHaveBeenCalledWith('quill_command_history');
  });
});
