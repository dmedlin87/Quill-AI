import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { VisualDiff } from '@/features/editor/components/VisualDiff';
import { calculateDiff } from '@/features/shared';

vi.mock('@/features/shared', () => ({
  calculateDiff: vi.fn(),
}));

const mockedCalculateDiff = vi.mocked(calculateDiff);

describe('VisualDiff', () => {
  it('renders equal, deleted and inserted segments with appropriate styles', () => {
    mockedCalculateDiff.mockReturnValue([
      [0, 'same'],
      [-1, 'removed'],
      [1, 'added'],
    ] as any);

    render(<VisualDiff original="old" modified="new" className="extra-class" />);

    expect(mockedCalculateDiff).toHaveBeenCalledWith('old', 'new');

    const equal = screen.getByText('same');
    const deleted = screen.getByText('removed');
    const inserted = screen.getByText('added');

    expect(equal).toHaveClass('text-gray-600');
    expect(deleted).toHaveClass('line-through', 'bg-red-100', 'text-red-800');
    expect(inserted).toHaveClass('bg-green-100', 'text-green-800', 'font-medium');
  });
});
