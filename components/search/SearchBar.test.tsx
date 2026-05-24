import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SearchBar } from './SearchBar';
import type { SearchSuggestion } from './SearchBar';

const STATIC_SUGGESTIONS: SearchSuggestion[] = [
  { id: '1', label: 'Cardiology', subtitle: 'Organ system' },
  { id: '2', label: 'Pharmacology', subtitle: 'Topic' },
  { id: '3', label: 'Pulmonology' },
];

describe('SearchBar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders with placeholder', () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        onSelect={vi.fn()}
        placeholder="Search topics..."
      />
    );
    expect(screen.getByPlaceholderText('Search topics...')).toBeTruthy();
  });

  it('renders controlled value', () => {
    render(
      <SearchBar value="cardio" onChange={vi.fn()} onSelect={vi.fn()} />
    );
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('cardio');
  });

  it('calls onChange on typing', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'card' } });
    expect(onChange).toHaveBeenCalledWith('card');
  });

  it('opens suggestion list on focus', () => {
    render(
      <SearchBar value="" onChange={vi.fn()} onSelect={vi.fn()} suggestions={STATIC_SUGGESTIONS} />
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('shows suggestions matching query', () => {
    render(
      <SearchBar
        value="card"
        onChange={vi.fn()}
        onSelect={vi.fn()}
        suggestions={STATIC_SUGGESTIONS}
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    // Should filter to matching suggestions
    expect(screen.getByText('Cardiology')).toBeTruthy();
    expect(screen.queryByText('Pulmonology')).toBeNull();
  });

  it('calls onSelect when suggestion is clicked', () => {
    const onSelect = vi.fn();
    const onChange = vi.fn();
    render(
      <SearchBar
        value="card"
        onChange={onChange}
        onSelect={onSelect}
        suggestions={STATIC_SUGGESTIONS}
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    const suggestion = screen.getByText('Cardiology');
    fireEvent.mouseDown(suggestion);

    expect(onSelect).toHaveBeenCalledWith('Cardiology');
    expect(onChange).toHaveBeenCalledWith('Cardiology');
  });

  it('shows clear button when value is present', () => {
    render(
      <SearchBar value="test" onChange={vi.fn()} onSelect={vi.fn()} />
    );
    expect(screen.getByLabelText('Clear search')).toBeTruthy();
  });

  it('clears value on clear button click', () => {
    const onChange = vi.fn();
    render(
      <SearchBar value="test" onChange={onChange} onSelect={vi.fn()} />
    );
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('closes list on Escape', async () => {
    render(
      <SearchBar value="" onChange={vi.fn()} onSelect={vi.fn()} suggestions={STATIC_SUGGESTIONS} />
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.keyDown(input, { key: 'Escape' });
    // List should close (uses setTimeout in blur handler)
    await act(() => new Promise((r) => setTimeout(r, 250)));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('navigates with Arrow keys', () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        onSelect={vi.fn()}
        suggestions={STATIC_SUGGESTIONS}
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const firstOption = screen.getByRole('option', { selected: true });
    expect(firstOption.textContent).toContain('Cardiology');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const secondOption = screen.getByRole('option', { selected: true });
    expect(secondOption.textContent).toContain('Pharmacology');
  });

  it('selects on Enter with active index', () => {
    const onSelect = vi.fn();
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        onSelect={onSelect}
        suggestions={STATIC_SUGGESTIONS}
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('Cardiology');
  });

  it('renders filter chips', () => {
    const onToggle = vi.fn();
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        onSelect={vi.fn()}
        filters={[
          { id: 'quick', label: 'Quick wins', active: false },
          { id: 'deep', label: 'Deep work', active: true },
        ]}
        onToggleFilter={onToggle}
      />
    );

    expect(screen.getByText('Quick wins')).toBeTruthy();
    expect(screen.getByText('Deep work')).toBeTruthy();
    // Active filter should have aria-pressed
    expect(screen.getByText('Deep work').getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onToggleFilter when chip is clicked', () => {
    const onToggle = vi.fn();
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        onSelect={vi.fn()}
        filters={[{ id: 'quick', label: 'Quick wins', active: false }]}
        onToggleFilter={onToggle}
      />
    );
    fireEvent.click(screen.getByText('Quick wins'));
    expect(onToggle).toHaveBeenCalledWith('quick');
  });

  it('has correct ARIA combobox attributes', () => {
    render(
      <SearchBar value="" onChange={vi.fn()} onSelect={vi.fn()} suggestions={STATIC_SUGGESTIONS} />
    );
    const input = screen.getByRole('combobox');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-expanded')).toBe('false');

    fireEvent.focus(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('saves selected term to localStorage as recent search', () => {
    const onSelect = vi.fn();
    render(
      <SearchBar
        value="card"
        onChange={vi.fn()}
        onSelect={onSelect}
        suggestions={STATIC_SUGGESTIONS}
        storageKey="test.search.recent"
      />
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByText('Cardiology'));

    const stored = JSON.parse(localStorage.getItem('test.search.recent') || '[]');
    expect(stored).toContain('Cardiology');
  });
});
