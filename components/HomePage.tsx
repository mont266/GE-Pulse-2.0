import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Item, LatestPrice, AggregatePrice } from '../types';
import { Card } from './ui/Card';
import { getHighResImageUrl, createIconDataUrl } from '../utils/image';
import { XIcon, TrendingUpIcon } from './icons/Icons';
import { Loader } from './ui/Loader';
import { Button } from './ui/Button';

interface HomePageProps {
  items: Item[];
  latestPrices: Record<string, LatestPrice>;
  onSelectItem: (item: Item) => void;
  recentlyViewedIds: number[];
  allItems: Record<string, Item>;
  onClearRecentlyViewed: () => void;
  twentyFourHourPrices: Record<string, AggregatePrice>;
  isMoversLoading: boolean;
}

type MoverItem = Item & {
    currentPrice: number;
    priceChange: number;
    percentageChange: number;
};

const MIN_ITEM_PRICE_FOR_MOVERS = 1000;
const MIN_24H_VOLUME_THRESHOLD = 500;
const MAX_PERCENTAGE_CHANGE = 1000;


const CompactMoverList: React.FC<{
    title: string;
    items: MoverItem[];
    onSelectItem: (item: Item) => void;
    isGainers: boolean;
}> = ({ title, items, onSelectItem, isGainers }) => {
    return (
        <div>
            <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
            {items.length > 0 ? (
                <div className="space-y-3">
                    {items.map(item => (
                        <Card key={item.id} isHoverable={true} onClick={() => onSelectItem(item)} className={`p-4 shadow-lg ${isGainers ? 'shadow-emerald-500/10 hover:shadow-emerald-500/20' : 'shadow-red-500/10 hover:shadow-red-500/20'}`}>
                             <div className="flex items-center gap-3">
                                <img
                                    src={getHighResImageUrl(item.name)}
                                    onError={(e) => { e.currentTarget.src = createIconDataUrl(item.icon); }}
                                    alt={item.name}
                                    className="w-8 h-8 object-contain bg-gray-700/50 rounded-md flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-white truncate">{item.name}</p>
                                    <p className="text-xs text-gray-400">{item.currentPrice.toLocaleString()} gp</p>
                                </div>
                                <div className="text-right text-sm flex-shrink-0">
                                    <p className={`font-bold ${isGainers ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isGainers ? '+' : ''}{item.percentageChange.toFixed(2)}%
                                    </p>
                                    <p className={`text-xs ${isGainers ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                                        {isGainers ? '+' : ''}{item.priceChange.toLocaleString()} gp
                                    </p>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="text-center text-gray-500 py-10">
                    No significant {isGainers ? 'gainers' : 'losers'} found.
                </Card>
            )}
        </div>
    );
};


export const HomePage: React.FC<HomePageProps> = ({ items, onSelectItem, latestPrices, recentlyViewedIds, allItems, onClearRecentlyViewed, twentyFourHourPrices, isMoversLoading }) => {
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

  const twentyFourHourMovers = useMemo<MoverItem[]>(() => {
    if (!twentyFourHourPrices || Object.keys(twentyFourHourPrices).length === 0) return [];
    return Object.values(allItems)
        .map((item: Item) => {
            const latest = latestPrices[item.id];
            const historical = twentyFourHourPrices[item.id];
            
            if (!latest?.high || !historical?.avgHighPrice || latest.high < MIN_ITEM_PRICE_FOR_MOVERS) return null;

            const totalVolume = (historical.highPriceVolume || 0) + (historical.lowPriceVolume || 0);
            if (totalVolume < MIN_24H_VOLUME_THRESHOLD) {
                return null;
            }

            const priceChange = latest.high - historical.avgHighPrice;
            const percentageChange = historical.avgHighPrice !== 0 ? (priceChange / historical.avgHighPrice) * 100 : 0;
            
            if (!isFinite(percentageChange) || Math.abs(percentageChange) > MAX_PERCENTAGE_CHANGE) return null;

            return { ...item, currentPrice: latest.high, priceChange, percentageChange };
        })
        .filter((item): item is MoverItem => item !== null);
  }, [allItems, latestPrices, twentyFourHourPrices]);

  const { gainers, losers } = useMemo(() => {
    const dataToSort = twentyFourHourMovers.filter(item => item.percentageChange !== 0);
    const gainers = [...dataToSort].sort((a, b) => b.percentageChange - a.percentageChange).slice(0, 5);
    const losers = [...dataToSort].sort((a, b) => a.percentageChange - b.percentageChange).slice(0, 5);
    return { gainers, losers };
  }, [twentyFourHourMovers]);

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

  const renderDashboard = () => (
    <>
        <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">Grand Exchange Dashboard</h1>
            <p className="mt-3 text-lg text-gray-400 max-w-2xl mx-auto">Your real-time companion for Old School Runescape trading.</p>
        </div>

        {recentlyViewedIds.length > 0 && (
            <div className="mt-12">
                <div className="flex justify-between items-center mb-4">
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

        <div className="mt-12">
            <div className="flex items-center gap-2 mb-4">
                <TrendingUpIcon className="w-6 h-6 text-emerald-400"/>
                <h2 className="text-xl font-bold text-white">Top Movers (24H)</h2>
            </div>
            {isMoversLoading ? (
                 <div className="flex justify-center items-center h-48"><Loader /></div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <CompactMoverList title="Top Gainers" items={gainers} onSelectItem={onSelectItem} isGainers={true} />
                    <CompactMoverList title="Top Losers" items={losers} onSelectItem={onSelectItem} isGainers={false} />
                </div>
            )}
        </div>
    </>
  );

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="sticky top-0 z-10 bg-gray-900 pt-4 md:pt-8 pb-6 mb-8">
        <input
          type="text"
          placeholder="Search for an item (e.g., 'Abyssal whip')"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full p-4 pr-16 bg-gray-800 border border-gray-700 rounded-lg text-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:shadow-[0_0_20px_rgba(16,185,129,0.5)] focus:outline-none transition-all duration-300"
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-activedescendant={highlightedIndex >= 0 ? `search-item-${filteredItems[highlightedIndex]?.id}` : undefined}
        />
        {inputValue && (
          <button
            onClick={() => setInputValue('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors mt-2"
            aria-label="Clear search input"
          >
            <XIcon className="w-6 h-6" />
          </button>
        )}
      </div>

      {inputValue === '' ? renderDashboard() : (
          <>
            {filteredItems.length > 0 && (
                <div id="search-results" role="listbox" ref={resultsContainerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            {debouncedSearchTerm && filteredItems.length === 0 && (
                <div className="text-center py-20">
                <p className="text-gray-400">No items found for "{debouncedSearchTerm}".</p>
                </div>
            )}
          </>
      )}

    </div>
  );
};