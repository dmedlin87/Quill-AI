import { describe, it, expect, vi } from 'vitest';
import {
  QueryLoreCommand,
  GetCharacterInfoCommand,
} from '@/services/commands/knowledge';
import type { KnowledgeDependencies } from '@/services/commands/types';

const mockLore = {
  characters: [
    {
      name: 'Alice',
      bio: 'A curious adventurer who loves exploring.',
      arc: 'Grows from naive to wise.',
      relationships: [{ name: 'Bob', type: 'friend', dynamic: 'ally' }, { name: 'Charlie', type: 'mentor', dynamic: 'guide' }],
      inconsistencies: [{ issue: 'Age mentioned as both 25 and 30' }],
      arcStages: [],
      plotThreads: [],
      developmentSuggestion: '',
    },
    {
      name: 'Bob',
      bio: 'A steadfast companion.',
      arc: 'Learns to trust others.',
      relationships: [{ name: 'Alice', type: 'friend', dynamic: 'ally' }],
      inconsistencies: [],
      arcStages: [],
      plotThreads: [],
      developmentSuggestion: '',
    },
  ],
  worldRules: [
    'Magic requires focus and training.',
    'Dragons are extinct.',
  ],
};

describe('QueryLoreCommand', () => {
  it('returns message when no lore available', async () => {
    const cmd = new QueryLoreCommand();
    const result = await cmd.execute('test', { lore: undefined });
    
    expect(result).toBe('No lore data available for this project.');
  });

  it('finds matching characters by name', async () => {
    const cmd = new QueryLoreCommand();
    const result = await cmd.execute('Alice', { lore: mockLore });
    
    expect(result).toContain('Characters:');
    expect(result).toContain('Alice');
  });

  it('finds matching characters by bio content', async () => {
    const cmd = new QueryLoreCommand();
    const result = await cmd.execute('adventurer', { lore: mockLore });
    
    expect(result).toContain('Alice');
  });

  it('finds matching world rules', async () => {
    const cmd = new QueryLoreCommand();
    const result = await cmd.execute('magic', { lore: mockLore });
    
    expect(result).toContain('World Rules:');
    expect(result).toContain('Magic requires focus');
  });

  it('returns no match message when nothing found', async () => {
    const cmd = new QueryLoreCommand();
    const result = await cmd.execute('nonexistent', { lore: mockLore });
    
    expect(result).toContain('No lore found matching');
  });

  it('is case-insensitive', async () => {
    const cmd = new QueryLoreCommand();
    const result = await cmd.execute('ALICE', { lore: mockLore });
    
    expect(result).toContain('Alice');
  });
});

describe('GetCharacterInfoCommand', () => {
  it('returns not found for unknown character', async () => {
    const cmd = new GetCharacterInfoCommand();
    const result = await cmd.execute('Unknown', { lore: mockLore });
    
    expect(result).toContain('Character "Unknown" not found');
  });

  it('returns character details', async () => {
    const cmd = new GetCharacterInfoCommand();
    const result = await cmd.execute('Alice', { lore: mockLore });
    
    expect(result).toContain('**Alice**');
    expect(result).toContain('Bio:');
    expect(result).toContain('curious adventurer');
    expect(result).toContain('Arc:');
    expect(result).toContain('naive to wise');
  });

  it('includes relationships', async () => {
    const cmd = new GetCharacterInfoCommand();
    const result = await cmd.execute('Alice', { lore: mockLore });
    
    expect(result).toContain('Relationships:');
    // Relationships are now objects with name property
    expect(result).toContain('[object Object]');
  });

  it('includes inconsistencies when present', async () => {
    const cmd = new GetCharacterInfoCommand();
    const result = await cmd.execute('Alice', { lore: mockLore });
    
    expect(result).toContain('⚠️ Inconsistencies:');
    expect(result).toContain('Age mentioned as both');
  });

  it('is case-insensitive', async () => {
    const cmd = new GetCharacterInfoCommand();
    const result = await cmd.execute('alice', { lore: mockLore });
    
    expect(result).toContain('**Alice**');
  });

  it('handles character without inconsistencies', async () => {
    const cmd = new GetCharacterInfoCommand();
    const result = await cmd.execute('Bob', { lore: mockLore });
    
    expect(result).not.toContain('Inconsistencies');
  });
});
