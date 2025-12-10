import { describe, it, expect, vi } from 'vitest';
import { createToolCallAdapter } from '@/services/core/toolCallAdapter';
import type { ToolCallUI } from '@/services/core/toolCallAdapter';
import type { ToolResult } from '@/services/gemini/toolExecutor';

describe('createToolCallAdapter', () => {
  it('calls onToolStart with tool name', () => {
    const ui: ToolCallUI = {
      onToolStart: vi.fn(),
      onToolEnd: vi.fn(),
      onMessage: vi.fn(),
    };
    
    const adapter = createToolCallAdapter(ui);
    adapter.handleToolStart('testTool');
    
    expect(ui.onToolStart).toHaveBeenCalledWith({ name: 'testTool' });
  });

  it('sends tool start message', () => {
    const ui: ToolCallUI = {
      onMessage: vi.fn(),
    };
    
    const adapter = createToolCallAdapter(ui);
    adapter.handleToolStart('analyzePlot');
    
    expect(ui.onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'model',
        text: '🛠️ analyzePlot...',
      }),
    );
  });

  it('calls onToolEnd with result', () => {
    const ui: ToolCallUI = {
      onToolStart: vi.fn(),
      onToolEnd: vi.fn(),
      onMessage: vi.fn(),
    };
    
    const result: ToolResult = { success: true, message: 'Done' };
    const adapter = createToolCallAdapter(ui);
    adapter.handleToolEnd('testTool', result);
    
    expect(ui.onToolEnd).toHaveBeenCalledWith({ name: 'testTool', result });
  });

  it('sends success message on successful result', () => {
    const ui: ToolCallUI = {
      onMessage: vi.fn(),
    };
    
    const result: ToolResult = { success: true, message: 'Completed analysis' };
    const adapter = createToolCallAdapter(ui);
    adapter.handleToolEnd('analyze', result);
    
    expect(ui.onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'model',
        text: '✅ analyze: Completed analysis',
      }),
    );
  });

  it('sends default Done message when no message provided', () => {
    const ui: ToolCallUI = {
      onMessage: vi.fn(),
    };
    
    const result: ToolResult = { success: true, message: '' };
    const adapter = createToolCallAdapter(ui);
    adapter.handleToolEnd('tool', result);
    
    expect(ui.onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '✅ tool: Done.',
      }),
    );
  });

  it('sends failure message on failed result', () => {
    const ui: ToolCallUI = {
      onMessage: vi.fn(),
    };
    
    const result: ToolResult = { success: false, message: '', error: 'Network timeout' };
    const adapter = createToolCallAdapter(ui);
    adapter.handleToolEnd('fetchData', result);
    
    expect(ui.onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '⚠️ fetchData failed: Network timeout',
      }),
    );
  });

  it('uses fallback failure message when error missing but message provided', () => {
    const ui: ToolCallUI = {
      onMessage: vi.fn(),
    };

    const adapter = createToolCallAdapter(ui);
    adapter.handleToolEnd('summonMuse', { success: false, message: 'Failed softly' });

    expect(ui.onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '⚠️ summonMuse failed: Failed softly',
      }),
    );
  });

  it('falls back to Unknown error when both error and message absent', () => {
    const ui: ToolCallUI = {
      onMessage: vi.fn(),
    };

    const adapter = createToolCallAdapter(ui);
    adapter.handleToolEnd('summonMuse', { success: false, message: '' });

    expect(ui.onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '⚠️ summonMuse failed: Unknown error',
      }),
    );
  });

  it('includes timestamp in messages', () => {
    const ui: ToolCallUI = {
      onMessage: vi.fn(),
    };
    
    const adapter = createToolCallAdapter(ui);
    adapter.handleToolStart('test');
    
    expect(ui.onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(Date),
      }),
    );
  });

  it('handles missing callbacks gracefully', () => {
    const ui: ToolCallUI = {};
    const adapter = createToolCallAdapter(ui);
    
    // Should not throw
    expect(() => adapter.handleToolStart('test')).not.toThrow();
    expect(() => adapter.handleToolEnd('test', { success: true, message: '' })).not.toThrow();
  });
});
