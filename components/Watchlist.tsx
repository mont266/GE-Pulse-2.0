

import React from 'react';
import type { Item, LatestPrice, TimeseriesData } from '../types';
import { StarIcon } from './icons/Icons';
import { WatchlistGrid } from './WatchlistGrid';

interface WatchlistProps {
  items: Item[];
  latestPrices: Record<string, LatestPrice>;
  onSelectItem: (item: Item) => void;
  timeseries: Record<string, TimeseriesData[]>;
  toggleWatchlist: (itemId: number) => void;
}

export const Watchlist: React.FC<WatchlistProps> = ({ items, onSelectItem, latestPrices, timeseries, toggleWatchlist }) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-20 flex flex-col items-center">
        <StarIcon className="w-16 h-16 text-gray-600 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Your Watchlist is Empty</h2>
        <p className="text-gray-400">Search for items and click the star icon to add them here.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-white mb-6">Your Watchlist</h2>
      <WatchlistGrid 
        items={items} 
        latestPrices={latestPrices} 
        onSelectItem={onSelectItem} 
        timeseries={timeseries}
        toggleWatchlist={toggleWatchlist}
      />
    </div>
  );
};