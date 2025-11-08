import React from 'react';
import type { Item, LatestPrice, TimeseriesData } from '../types';
import { StarIcon } from './icons/Icons';
import { WatchlistGrid } from './WatchlistGrid';
import { SkeletonCard } from './ui/Skeleton';

interface WatchlistProps {
  items: Item[];
  latestPrices: Record<string, LatestPrice>;
  prevLatestPrices: Record<string, LatestPrice>;
  onSelectItem: (item: Item) => void;
  timeseries: Record<string, TimeseriesData[]>;
  toggleWatchlist: (itemId: number) => void;
  isLoading: boolean;
}

export const Watchlist: React.FC<WatchlistProps> = ({ items, onSelectItem, latestPrices, prevLatestPrices, timeseries, toggleWatchlist, isLoading }) => {
  if (isLoading) {
    return (
      <div className="pt-6 md:pt-8">
        <h2 className="text-3xl font-bold text-white mb-6">Your Watchlist</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }
  
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
    <div className="pt-6 md:pt-8">
      <h2 className="text-3xl font-bold text-white mb-6">Your Watchlist</h2>
      <WatchlistGrid 
        items={items} 
        latestPrices={latestPrices}
        prevLatestPrices={prevLatestPrices}
        onSelectItem={onSelectItem} 
        timeseries={timeseries}
        toggleWatchlist={toggleWatchlist}
      />
    </div>
  );
};
