/**
 * useDebouncedSearch - Debounced search input for better performance
 *
 * Prevents excessive API calls while user is typing
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseDebouncedSearchOptions {
  delay?: number;
  minLength?: number;
  onSearch?: (query: string) => void;
}

/**
 * Hook for debounced search functionality
 *
 * @param options - Configuration options
 * @returns Object with search state and handlers
 */
export function useDebouncedSearch(options: UseDebouncedSearchOptions = {}) {
  const { delay = 300, minLength = 0, onSearch } = options;

  const [inputValue, setInputValue] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce the input value
  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Skip if below minimum length
    if (inputValue.length > 0 && inputValue.length < minLength) {
      return;
    }

    setIsSearching(true);

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(inputValue);
      setIsSearching(false);

      // Call onSearch callback if provided
      if (onSearch) {
        onSearch(inputValue);
      }
    }, delay);

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [inputValue, delay, minLength, onSearch]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const setQuery = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const clearSearch = useCallback(() => {
    setInputValue('');
    setDebouncedValue('');
  }, []);

  return {
    inputValue,
    debouncedValue,
    isSearching,
    handleChange,
    setQuery,
    clearSearch,
  };
}

export default useDebouncedSearch;
