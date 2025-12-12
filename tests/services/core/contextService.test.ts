import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDefaultContextService,
  createNoOpContextService,
  createMockContextService,
  createFixedContextService,
  type ContextService,
} from '../../../services/core/contextService';
import { AppBrainState } from '../../../services/appBrain/types';

// Mock dependencies
const mockGetSmartAgentContext = vi.fn();
const mockBuildCompressedContext = vi.fn();
const mockBuildNavigationContext = vi.fn();
const mockBuildEditingContext = vi.fn();
const mockBuildAgentContextWithMemory = vi.fn();

// Mocking the alias import used in the source file
vi.mock('@/services/appBrain', () => ({
  getSmartAgentContext: (...args: any[]) => mockGetSmartAgentContext(...args),
  buildCompressedContext: (...args: any[]) => mockBuildCompressedContext(...args),
  buildNavigationContext: (...args: any[]) => mockBuildNavigationContext(...args),
  buildEditingContext: (...args: any[]) => mockBuildEditingContext(...args),
  buildAgentContextWithMemory: (...args: any[]) => mockBuildAgentContextWithMemory(...args),
}));

describe('ContextService', () => {
  const mockState = {} as AppBrainState;
  const mockProjectId = 'project-123';
  const mockOptions = { mode: 'text' as const, queryType: 'general' as const };

  describe('createDefaultContextService', () => {
    let service: ContextService;

    beforeEach(() => {
      vi.clearAllMocks();
      service = createDefaultContextService();
    });

    it('should delegate getSmartAgentContext to appBrain service', async () => {
      const expectedResult = { context: 'smart', tokenEstimate: 50, profile: 'test' };
      mockGetSmartAgentContext.mockResolvedValue(expectedResult);

      const result = await service.getSmartAgentContext(mockState, mockProjectId, mockOptions);

      expect(result).toEqual(expectedResult);
      expect(mockGetSmartAgentContext).toHaveBeenCalledWith(mockState, mockProjectId, mockOptions);
    });

    it('should delegate getCompressedContext to appBrain service', () => {
      const expectedResult = 'compressed';
      mockBuildCompressedContext.mockReturnValue(expectedResult);

      const result = service.getCompressedContext(mockState);

      expect(result).toBe(expectedResult);
      expect(mockBuildCompressedContext).toHaveBeenCalledWith(mockState);
    });

    it('should delegate getNavigationContext to appBrain service', () => {
      const expectedResult = 'navigation';
      mockBuildNavigationContext.mockReturnValue(expectedResult);

      const result = service.getNavigationContext(mockState);

      expect(result).toBe(expectedResult);
      expect(mockBuildNavigationContext).toHaveBeenCalledWith(mockState);
    });

    it('should delegate getEditingContext to appBrain service', () => {
      const expectedResult = 'editing';
      mockBuildEditingContext.mockReturnValue(expectedResult);

      const result = service.getEditingContext(mockState);

      expect(result).toBe(expectedResult);
      expect(mockBuildEditingContext).toHaveBeenCalledWith(mockState);
    });

    it('should delegate getAgentContextWithMemory to appBrain service', async () => {
      const expectedResult = 'memory';
      mockBuildAgentContextWithMemory.mockResolvedValue(expectedResult);

      const result = await service.getAgentContextWithMemory(mockState, mockProjectId);

      expect(result).toBe(expectedResult);
      expect(mockBuildAgentContextWithMemory).toHaveBeenCalledWith(mockState, mockProjectId);
    });
  });

  describe('createNoOpContextService', () => {
    const service = createNoOpContextService();

    it('should return minimal valid contexts', async () => {
      expect(await service.getSmartAgentContext(mockState, null, mockOptions)).toEqual({
        context: 'No context available.',
        tokenEstimate: 10,
        profile: 'minimal',
      });
      expect(service.getCompressedContext(mockState)).toBe('No context available.');
      expect(service.getNavigationContext(mockState)).toBe('No context available.');
      expect(service.getEditingContext(mockState)).toBe('No context available.');
      expect(await service.getAgentContextWithMemory(mockState, null)).toBe('No context available.');
    });
  });

  describe('createMockContextService', () => {
    it('should allow overriding specific methods', async () => {
      const override = {
        getCompressedContext: () => 'Overridden',
      };
      const service = createMockContextService(override);

      expect(service.getCompressedContext(mockState)).toBe('Overridden');
      expect(service.getNavigationContext(mockState)).toBe('No context available.'); // Uses NoOp fallback
    });
  });

  describe('createFixedContextService', () => {
    it('should return provided fixed contexts', async () => {
      const contexts = {
        smart: 'Fixed Smart',
        compressed: 'Fixed Compressed',
        navigation: 'Fixed Navigation',
        editing: 'Fixed Editing',
        withMemory: 'Fixed Memory',
      };
      const service = createFixedContextService(contexts);

      const smartResult = await service.getSmartAgentContext(mockState, null, mockOptions);
      expect(smartResult.context).toBe(contexts.smart);
      expect(service.getCompressedContext(mockState)).toBe(contexts.compressed);
      expect(service.getNavigationContext(mockState)).toBe(contexts.navigation);
      expect(service.getEditingContext(mockState)).toBe(contexts.editing);
      expect(await service.getAgentContextWithMemory(mockState, null)).toBe(contexts.withMemory);
    });

    it('should fallback to default fixed contexts if not provided', async () => {
      const service = createFixedContextService({});

      const smartResult = await service.getSmartAgentContext(mockState, null, mockOptions);
      expect(smartResult.context).toBe('Fixed smart context');
      expect(service.getCompressedContext(mockState)).toBe('Fixed compressed context');
      expect(service.getNavigationContext(mockState)).toBe('Fixed navigation context');
      expect(service.getEditingContext(mockState)).toBe('Fixed editing context');
      expect(await service.getAgentContextWithMemory(mockState, null)).toBe('Fixed context with memory');
    });
  });
});
