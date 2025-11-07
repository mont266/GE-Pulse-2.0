import React, { useState, useEffect } from 'react';
import type { Item, LatestPrice, TimeseriesData } from '../types';
import { Card } from './ui/Card';
import { StarIcon } from './icons/Icons';
import { getHighResImageUrl, createIconDataUrl } from '../utils/image';
import { Sparkline } from './ui/Sparkline';
import { Loader } from './ui/Loader';

interface WatchlistGridProps {
  items: Item[];
  latestPrices: Record<string, LatestPrice>;
  prevLatestPrices: Record<string, LatestPrice>;
  onSelectItem: (item: Item) => void;
  timeseries: Record<string, TimeseriesData[] | undefined>;
  toggleWatchlist: (itemId: number) => void;
}

const WatchlistItem: React.FC<Omit<WatchlistGridProps, 'items'> & { item: Item }> = ({ item, latestPrices, prevLatestPrices, onSelectItem, timeseries, toggleWatchlist }) => {
    const [priceChange, setPriceChange] = useState<'up' | 'down' | null>(null);

    useEffect(() => {
        const currentPrice = latestPrices[item.id]?.high;
        const prevPrice = prevLatestPrices[item.id]?.high;

        if (currentPrice != null && prevPrice != null && currentPrice !== prevPrice) {
            setPriceChange(currentPrice > prevPrice ? 'up' : 'down');
            const timer = setTimeout(() => setPriceChange(null), 1000); // Duration of the flash animation
            return () => clearTimeout(timer);
        }
    }, [latestPrices, prevLatestPrices, item.id]);
    
    const flashClass = priceChange === 'up' ? 'flash-green' : priceChange === 'down' ? 'flash-red' : '';
    const itemTimeseries = timeseries[item.id];
    
    return (
        <Card isHoverable={true} onClick={() => onSelectItem(item)} className="flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-4">
                <img 
                  src={getHighResImageUrl(item.name)}
                  onError={(e) => {
                    e.currentTarget.onerror = null; // Prevent infinite loops
                    e.currentTarget.src = createIconDataUrl(item.icon);
                  }}
                  alt={item.name} 
                  className="w-10 h-10 object-contain bg-gray-700/50 rounded-md"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{item.name}</p>
                  <p className={`text-sm text-gray-400 rounded transition-colors ${flashClass}`}>
                    Price: {latestPrices[item.id]?.high?.toLocaleString() || 'N/A'} gp
                  </p>
                </div>
                <button
                  onClick={(e) => {
                      e.stopPropagation();
                      toggleWatchlist(item.id);
                  }}
                  className="p-1 -m-1 text-yellow-400 hover:text-yellow-500 transition-colors"
                  aria-label={`Remove ${item.name} from watchlist`}
                >
                    <StarIcon className="w-5 h-5 text-yellow-400" />
                </button>
              </div>
            </div>
            <div className="mt-4 h-12">
              {itemTimeseries === undefined ? (
                <div className="h-full w-full flex items-center justify-center rounded-md bg-gray-700/30">
                  <Loader size="sm" />
                </div>
              ) : (
                <Sparkline data={itemTimeseries} />
              )}
            </div>
          </Card>
    )
}

export const WatchlistGrid: React.FC<WatchlistGridProps> = ({ items, latestPrices, prevLatestPrices, onSelectItem, timeseries, toggleWatchlist }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item, index) => (
        <div key={item.id} className="animate-fade-slide-in" style={{ animationDelay: `${index * 50}ms` }}>
            <WatchlistItem
                item={item}
                latestPrices={latestPrices}
                prevLatestPrices={prevLatestPrices}
                onSelectItem={onSelectItem}
                timeseries={timeseries}
                toggleWatchlist={toggleWatchlist}
            />
        </div>
      ))}
    </div>
  );
};