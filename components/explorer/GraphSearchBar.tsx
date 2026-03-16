/**
 * GraphSearchBar – Search bar with type‑ahead suggestions for GraphNode labels.
 * Integrates with `/api/graph/search` endpoint.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';

interface GraphNodeSuggestion {
  id: string;
  label: string;
  nodeType: string;
  description?: string;
}

interface GraphSearchBarProps {
  /** Callback when a node is selected (e.g., to center it on the graph) */
  onNodeSelect?: (nodeId: string, nodeLabel: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
}

export const GraphSearchBar: React.FC<GraphSearchBarProps> = ({
  onNodeSelect,
  placeholder = 'Search for conditions, drugs, anatomy, lab tests...',
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GraphNodeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      const url = getApiEndpoint(API_ENDPOINTS.GRAPH_SEARCH) + `?q=${encodeURIComponent(searchQuery)}&limit=8`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      const data = await response.json();
      setSuggestions(data.nodes.map((node: any) => ({
        id: node.id,
        label: node.label,
        nodeType: node.nodeType,
        description: node.description,
      })));
      setShowDropdown(true);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Graph search error:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleSuggestionClick = (suggestion: GraphNodeSuggestion) => {
    setQuery(suggestion.label);
    setShowDropdown(false);
    if (onNodeSelect) {
      onNodeSelect(suggestion.id, suggestion.label);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  };

  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowDropdown(true);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-[var(--color-text-muted)]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-border rounded-lg bg-surface-card text-text-primary placeholder-text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-action-primary focus:border-transparent"
          aria-label="Search graph nodes"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-[var(--color-text-muted)] animate-spin" />
        )}
      </div>

      {/* Dropdown with suggestions */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              className={`w-full text-left px-4 py-3 hover:bg-surface-hover transition-colors ${
                index === selectedIndex ? 'bg-surface-hover' : ''
              } ${index > 0 ? 'border-t border-border' : ''}`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-text-primary">{suggestion.label}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-action-muted text-text-secondary">
                  {suggestion.nodeType.toLowerCase()}
                </span>
              </div>
              {suggestion.description && (
                <p className="text-sm text-text-secondary mt-1 truncate">{suggestion.description}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {showDropdown && query.trim() && !loading && suggestions.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-card border border-border rounded-lg shadow-lg z-50 px-4 py-3 text-text-secondary">
          No matching nodes found.
        </div>
      )}
    </div>
  );
};