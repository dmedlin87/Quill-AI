# Test Rigor Guidelines

This document defines the standards for eliminating "Testing Theatre" and enforcing behavioral rigor across all test files.

## 1. Eliminate Tautological Mocks (No "Mocking the SUT")

### ❌ Anti-Pattern
```typescript
// Mocking the library you're explicitly testing
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => createMockEditor()),  // Testing a fake, not real behavior
}));
```

### ✅ Correct Approach
```typescript
// Use real library instances or fully functional in-memory equivalents
import { useEditor, EditorContent } from '@tiptap/react';

// For databases, use fake-indexeddb instead of mocking Dexie
import 'fake-indexeddb/auto';
```

**Rule**: If you're testing a component's integration with library X, import the real library X. Only mock:
- External network calls (APIs)
- Browser APIs unavailable in jsdom (Web Audio, Speech)
- Side effects (localStorage, timers)

---

## 2. Harden Assertions (No "Fluffy" Checks)

### ❌ Anti-Patterns
```typescript
expect(result).toBeTruthy();        // Passes for 1, "false", [], {}
expect(result).toBeDefined();       // Passes for null, 0, ""
expect(result).toBeInTheDocument(); // Only checks existence, not content
expect(editor).toBeDefined();       // Doesn't verify editor state
```

### ✅ Correct Approaches
```typescript
// Strict equality
expect(result).toEqual({ id: 'abc', status: 'active' });
expect(result).toBe(42);
expect(result).toStrictEqual(expectedObject);

// Explicit content assertions
expect(screen.getByText('Expected exact text')).toBeInTheDocument();
expect(editor.getHTML()).toBe('<p>Expected content</p>');

// For presence checks, also verify content
const element = screen.getByRole('button', { name: 'Submit' });
expect(element).toHaveAttribute('disabled');
expect(element).toHaveClass('btn-primary');
```

**Rule**: Every assertion must verify *content*, not just *presence*.

---

## 3. Enforce Determinism (Kill Flakiness)

### ❌ Anti-Pattern
```typescript
// Real timers with waitFor = race conditions
await waitFor(() => {
  expect(callback).toHaveBeenCalled();
}, { timeout: 5000 });
```

### ✅ Correct Approach
```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('debounces updates', async () => {
  render(<Component />);
  
  fireEvent.change(input, { target: { value: 'test' } });
  
  // Explicitly advance time
  await vi.advanceTimersByTimeAsync(300);
  
  expect(onUpdate).toHaveBeenCalledWith('test');
});
```

### Cleanup Requirements
```typescript
afterEach(() => {
  cleanup();                    // RTL DOM cleanup
  vi.clearAllMocks();          // Reset mock call counts
  vi.restoreAllMocks();        // Restore original implementations
  vi.useRealTimers();          // Restore real timers if fakes used
});
```

---

## 4. Verify Failure Conditions (Mutation Resistance)

### Principle
If you flip a boolean conditional in source code, at least one test MUST fail.

### ❌ Anti-Pattern
```typescript
// Only tests happy path
it('handles selection', () => {
  // ... only tests when selection exists
});
```

### ✅ Correct Approach
```typescript
// Test the conditional branches explicitly
it('calls onSelectionChange with coordinates when selection is non-empty', () => {
  // ... test with actual selection
  expect(onSelectionChange).toHaveBeenCalledWith(
    { start: 5, end: 10, text: 'hello' },
    { top: 100, left: 150 }
  );
});

it('calls onSelectionChange with null when selection is empty', () => {
  // ... test with empty selection
  expect(onSelectionChange).toHaveBeenCalledWith(null, null);
});

it('does NOT call onSelectionChange when selection is unchanged', () => {
  // ... verify callback is NOT called
  expect(onSelectionChange).not.toHaveBeenCalled();
});
```

### Coverage Heuristic
For every `if` statement in the source:
1. Write a test where the condition is `true`
2. Write a test where the condition is `false`

---

## 5. Testing React Components

### Use Real Rendering
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('handles user interaction', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  
  render(<MyComponent />);
  
  await user.click(screen.getByRole('button'));
  
  expect(screen.getByText('Clicked!')).toBeInTheDocument();
});
```

### Mock Only External Dependencies
```typescript
// Mock the API, not the component's internal logic
vi.mock('@/services/api', () => ({
  fetchData: vi.fn().mockResolvedValue({ items: [] }),
}));
```

---

## 6. Testing Hooks

### Use Real Hook Execution
```typescript
import { renderHook, act } from '@testing-library/react';

it('updates state correctly', () => {
  const { result } = renderHook(() => useMyHook());
  
  act(() => {
    result.current.doSomething();
  });
  
  expect(result.current.value).toBe(42);
});
```

---

## 7. Async Testing Patterns

### With Fake Timers
```typescript
it('debounces API calls', async () => {
  vi.useFakeTimers();
  
  const { result } = renderHook(() => useDebouncedValue('initial'));
  
  act(() => {
    result.current.setValue('updated');
  });
  
  // Value not updated yet (debounce delay)
  expect(result.current.value).toBe('initial');
  
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  
  // Now updated
  expect(result.current.value).toBe('updated');
});
```

### With Real Async Operations
```typescript
it('fetches data on mount', async () => {
  const mockFetch = vi.fn().mockResolvedValue({ data: 'test' });
  
  render(<DataComponent fetch={mockFetch} />);
  
  // Use findBy* for async content (includes built-in waitFor)
  expect(await screen.findByText('test')).toBeInTheDocument();
  
  expect(mockFetch).toHaveBeenCalledOnce();
});
```

---

## 8. Snapshot Testing Rules

### When to Use
- **Use**: Stable UI structure verification (design system components)
- **Avoid**: Dynamic content, frequently changing components

### Always Add Behavioral Tests Alongside
```typescript
it('matches snapshot', () => {
  const { container } = render(<Button>Click me</Button>);
  expect(container).toMatchSnapshot();
});

// ALSO add behavioral test
it('calls onClick when clicked', async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Click me</Button>);
  
  await userEvent.click(screen.getByRole('button'));
  
  expect(onClick).toHaveBeenCalledOnce();
});
```

---

## Checklist for New Tests

- [ ] No mocks replacing the system under test
- [ ] All assertions use strict equality or explicit content checks
- [ ] Fake timers used for any time-dependent logic
- [ ] afterEach cleans up DOM, mocks, and state
- [ ] Failure conditions tested for every conditional branch
- [ ] No `toBeTruthy()` or `toBeDefined()` without follow-up content assertions
