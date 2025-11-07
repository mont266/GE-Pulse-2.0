
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Item, LatestPrice } from '../types';
import { Card } from './ui/Card';
import { getHighResImageUrl, createIconDataUrl } from '../utils/image';
import { XIcon } from './icons/Icons';

interface SearchBarProps {
  items: Item[];
  latestPrices: Record<string, LatestPrice>;
  onSelectItem: (item: Item) => void;
  recentlyViewedIds: number[];
  allItems: Record<string, Item>;
  onClearRecentlyViewed: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ items, onSelectItem, latestPrices, recentlyViewedIds, allItems, onClearRecentlyViewed }) => {
  const [inputValue, setInputValue] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Debounce the search term to avoid re-calculating on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(inputValue);
    }, 300); // 300ms delay

    return () => {
      clearTimeout(timer);
    };
  }, [inputValue]);

  const filteredItems = useMemo(() => {
    if (!debouncedSearchTerm) return [];
    const lowercasedTerm = debouncedSearchTerm.toLowerCase();
    return items
      .filter(item => item.name.toLowerCase().includes(lowercasedTerm))
      .slice(0, 50); // Limit results for performance
  }, [debouncedSearchTerm, items]);

  // Reset highlight when search results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredItems]);
  
  // Scroll to the highlighted item if it's out of view
  useEffect(() => {
    if (highlightedIndex >= 0 && resultsContainerRef.current) {
        const highlightedElement = resultsContainerRef.current.children[highlightedIndex] as HTMLElement;
        if (highlightedElement) {
            highlightedElement.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    }
  }, [highlightedIndex]);

  // Handle keyboard navigation for search results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prevIndex =>
        prevIndex >= filteredItems.length - 1 ? 0 : prevIndex + 1
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prevIndex =>
        prevIndex <= 0 ? filteredItems.length - 1 : prevIndex - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
        onSelectItem(filteredItems[highlightedIndex]);
      } else if (filteredItems.length > 0) {
        // If nothing is highlighted, select the first item as a convenience
        onSelectItem(filteredItems[0]);
      }
    }
  };


  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="sticky top-0 z-10 bg-gray-900 py-4 relative">
        <input
          type="text"
          placeholder="Search for an item (e.g., 'Abyssal whip')"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full p-4 pr-16 bg-gray-800 border border-gray-700 rounded-lg text-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-activedescendant={highlightedIndex >= 0 ? `search-item-${filteredItems[highlightedIndex]?.id}` : undefined}
        />
        {inputValue && (
          <button
            onClick={() => setInputValue('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Clear search input"
          >
            <XIcon className="w-6 h-6" />
          </button>
        )}
      </div>

      {inputValue === '' && recentlyViewedIds.length > 0 && (
        <div>
            <div className="flex justify-between items-center mt-8 mb-4">
                <h2 className="text-xl font-bold text-white">Recently Viewed</h2>
                <button 
                    onClick={onClearRecentlyViewed} 
                    className="text-sm text-gray-400 hover:text-white hover:underline transition-colors"
                >
                    Clear
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentlyViewedIds.map(id => {
                    const item = allItems[id];
                    if (!item) return null;
                    return (
                        <Card 
                            key={`recent-${item.id}`}
                            onClick={() => onSelectItem(item)}
                            isHoverable={true}
                        >
                            <div className="flex items-center gap-4">
                                <img 
                                    src={getHighResImageUrl(item.name)} 
                                    onError={(e) => { 
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = createIconDataUrl(item.icon); 
                                    }}
                                    alt={item.name} 
                                    className="w-10 h-10 object-contain bg-gray-700/50 rounded-md"
                                />
                                <div className="flex-1">
                                    <p className="font-bold text-white">{item.name}</p>
                                    <p className="text-sm text-gray-400">
                                    Price: {latestPrices[item.id]?.high?.toLocaleString() || 'N/A'} gp
                                    </p>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
      )}

      {inputValue === '' && recentlyViewedIds.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-400">Start typing to search for items on the Grand Exchange.</p>
        </div>
      )}

      {inputValue !== '' && filteredItems.length > 0 && (
         <div id="search-results" role="listbox" ref={resultsContainerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
         {filteredItems.map((item, index) => (
           <Card 
              id={`search-item-${item.id}`}
              role="option"
              aria-selected={index === highlightedIndex}
              key={item.id}
              onClick={() => onSelectItem(item)}
              onMouseEnter={() => setHighlightedIndex(index)}
              isHoverable={true}
              className={index === highlightedIndex ? 'ring-2 ring-emerald-500' : ''}
           >
              <div className="flex items-center gap-4">
                <img 
                  src={getHighResImageUrl(item.name)} 
                  onError={(e) => { 
                    e.currentTarget.onerror = null; // Prevent infinite loops
                    e.currentTarget.src = createIconDataUrl(item.icon); 
                  }}
                  alt={item.name} 
                  className="w-10 h-10 object-contain bg-gray-700/50 rounded-md"
                />
                <div className="flex-1">
                  <p className="font-bold text-white">{item.name}</p>
                  <p className="text-sm text-gray-400">
                    Price: {latestPrices[item.id]?.high?.toLocaleString() || 'N/A'} gp
                  </p>
                </div>
              </div>
           </Card>
         ))}
       </div>
      )}

      {inputValue !== '' && debouncedSearchTerm && filteredItems.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-400">No items found for "{debouncedSearchTerm}".</p>
        </div>
      )}
    </div>
  );
};
