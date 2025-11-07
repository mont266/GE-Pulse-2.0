// FIX: Corrected a typo in the React import statement to properly import hooks.
import React, { useState, useMemo } from 'react';
import type { Item, LatestPrice, AggregatePrice } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Loader } from './ui/Loader';
import { getHighResImageUrl, createIconDataUrl } from '../utils/image';
import { TrendingUpIcon } from './icons/Icons';

interface MarketActivityPageProps {
  items: Item[];
  latestPrices: Record<string, LatestPrice>;
  oneHourPrices: Record<string, AggregatePrice>;
  twentyFourHourPrices: Record<string, AggregatePrice>;
  isLoading: boolean;
  onSelectItem: (item: Item) => void;
  error: string | null;
}

type MoverItem = Item & {
    currentPrice: number;
    priceChange: number;
    percentageChange: number;
};

type ActiveTab = 'movers' | 'valuable' | 'volume';

const MIN_ITEM_PRICE_FOR_MOVERS = 1000; // Filter out very cheap items
const MIN_24H_VOLUME_THRESHOLD = 500;
const MIN_1H_VOLUME_THRESHOLD = 50;
const MAX_PERCENTAGE_CHANGE = 1000; // Cap at 1000% change to filter outliers


const MoverList: React.FC<{
    title: string;
    items: MoverItem[];
    metric: 'price' | 'percentage';
    onSelectItem: (item: Item) => void;
    isGainers: boolean;
}> = ({ title, items, metric, onSelectItem, isGainers }) => {
    return (
        <div>
            <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
            {items.length > 0 ? (
                <div className="space-y-3">
                    {items.map(item => (
                        <Card key={item.id} isHoverable={true} onClick={() => onSelectItem(item)} className="p-4">
                             <div className="flex items-center gap-4">
                                <img
                                    src={getHighResImageUrl(item.name)}
                                    onError={(e) => { e.currentTarget.src = createIconDataUrl(item.icon); }}
                                    alt={item.name}
                                    className="w-10 h-10 object-contain bg-gray-700/50 rounded-md"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white truncate">{item.name}</p>
                                    <p className="text-sm text-gray-400">{item.currentPrice.toLocaleString()} gp</p>
                                </div>
                                <div className="text-right text-sm">
                                    <p className={`font-bold ${isGainers ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {metric === 'percentage'
                                            ? `${isGainers ? '+' : ''}${item.percentageChange.toFixed(2)}%`
                                            : `${isGainers ? '+' : ''}${item.priceChange.toLocaleString()} gp`}
                                    </p>
                                    <p className={`text-xs ${isGainers ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                                        {metric === 'percentage'
                                            ? `${isGainers ? '+' : ''}${item.priceChange.toLocaleString()} gp`
                                            : `${isGainers ? '+' : ''}${item.percentageChange.toFixed(2)}%`}
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

const MarketListItem: React.FC<{
    item: (Item & { displayValue: string; displayLabel: string; });
    rank: number;
    onSelectItem: (item: Item) => void;
}> = ({ item, rank, onSelectItem }) => (
    <Card isHoverable={true} onClick={() => onSelectItem(item)} className="p-4">
        <div className="flex items-center gap-4">
            <span className="text-gray-400 font-bold text-lg w-6 text-center">{rank}</span>
            <img
                src={getHighResImageUrl(item.name)}
                onError={(e) => { e.currentTarget.src = createIconDataUrl(item.icon); }}
                alt={item.name}
                className="w-10 h-10 object-contain bg-gray-700/50 rounded-md"
            />
            <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{item.name}</p>
                <p className="text-sm text-gray-400">{item.displayLabel}</p>
            </div>
            <div className="text-right text-sm">
                <span className="font-bold text-white">{item.displayValue}</span>
            </div>
        </div>
    </Card>
);

export const MarketActivityPage: React.FC<MarketActivityPageProps> = ({
  items,
  latestPrices,
  oneHourPrices,
  twentyFourHourPrices,
  isLoading,
  onSelectItem,
  error
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('movers');
  const [metric, setMetric] = useState<'price' | 'percentage'>('percentage');
  const [timeframe, setTimeframe] = useState<'1h' | '24h'>('24h');
  const [showF2POnly, setShowF2POnly] = useState(false);

  const moversData = useMemo<MoverItem[]>(() => {
    const sourcePrices = timeframe === '1h' ? oneHourPrices : twentyFourHourPrices;
    const minVolume = timeframe === '1h' ? MIN_1H_VOLUME_THRESHOLD : MIN_24H_VOLUME_THRESHOLD;
    if (!sourcePrices || Object.keys(sourcePrices).length === 0) return [];
    
    return items
        .filter(item => !showF2POnly || (showF2POnly && !item.members))
        .map(item => {
            const latest = latestPrices[item.id];
            const historical = sourcePrices[item.id];
            
            if (!latest?.high || !historical?.avgHighPrice || latest.high < MIN_ITEM_PRICE_FOR_MOVERS) {
                return null;
            }

            const totalVolume = (historical.highPriceVolume || 0) + (historical.lowPriceVolume || 0);
            if (totalVolume < minVolume) {
                return null;
            }
            
            const priceChange = latest.high - historical.avgHighPrice;
            const percentageChange = historical.avgHighPrice !== 0
                ? (priceChange / historical.avgHighPrice) * 100
                : 0;

            if (!isFinite(percentageChange) || Math.abs(percentageChange) > MAX_PERCENTAGE_CHANGE) {
                return null;
            }

            return {
                ...item,
                currentPrice: latest.high,
                priceChange,
                percentageChange,
            };
        })
        .filter((item): item is MoverItem => item !== null);
  }, [items, latestPrices, oneHourPrices, twentyFourHourPrices, timeframe, showF2POnly]);

  const sortedMovers = useMemo(() => {
    const sortKey = metric === 'price' ? 'priceChange' : 'percentageChange';
    const dataToSort = moversData.filter(item => item[sortKey] !== 0);

    const gainers = [...dataToSort].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, 10);
    const losers = [...dataToSort].sort((a, b) => a[sortKey] - b[sortKey]).slice(0, 10);

    return { gainers, losers };
  }, [moversData, metric]);
  
  const mostValuableItems = useMemo(() => {
    return items
      .filter(item => {
          if (showF2POnly && item.members) return false;
          const price = latestPrices[item.id]?.high;
          return price != null && price > 0;
      })
      .sort((a, b) => {
          const priceA = latestPrices[a.id]?.high ?? 0;
          const priceB = latestPrices[b.id]?.high ?? 0;
          return priceB - priceA;
      })
      .slice(0, 10);
  }, [items, latestPrices, showF2POnly]);

  const highestVolumeItems = useMemo(() => {
    return items
      .map(item => {
        const volumeData = twentyFourHourPrices[item.id];
        if (!volumeData || (showF2POnly && item.members)) return null;
        const totalVolume = (volumeData.highPriceVolume || 0) + (volumeData.lowPriceVolume || 0);
        if (totalVolume === 0) return null;
        return {
          ...item,
          totalVolume,
        };
      })
      .filter((item): item is Item & { totalVolume: number } => item !== null)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 10);
  }, [items, twentyFourHourPrices, showF2POnly]);

  const renderContent = () => {
    if (isLoading) {
        return <div className="flex justify-center items-center h-full pt-20"><Loader /></div>;
    }
    if (error) {
        return <div className="text-center text-red-400 mt-8">{error}</div>;
    }
    switch (activeTab) {
        case 'movers':
            return (sortedMovers.gainers.length === 0 && sortedMovers.losers.length === 0) ? (
                 <div className="text-center py-20 flex flex-col items-center">
                    <TrendingUpIcon className="w-16 h-16 text-gray-600 mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">No Movers Data</h2>
                    <p className="text-gray-400">Could not calculate top movers. This can happen during game updates or API maintenance.</p>
                 </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <MoverList title="Top 10 Gainers" items={sortedMovers.gainers} metric={metric} onSelectItem={onSelectItem} isGainers={true} />
                    <MoverList title="Top 10 Losers" items={sortedMovers.losers} metric={metric} onSelectItem={onSelectItem} isGainers={false} />
                </div>
            );
        case 'valuable': {
            const valuableItems = mostValuableItems.map(item => ({...item, displayValue: `${latestPrices[item.id]?.high?.toLocaleString()} gp`, displayLabel: 'Current Price'}));
            const col1 = valuableItems.slice(0, 5);
            const col2 = valuableItems.slice(5, 10);

            return (
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold text-white mb-4 text-center">Most Valuable Items</h2>
                    {valuableItems.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                {col1.map((item, index) => (
                                    <MarketListItem key={item.id} item={item} rank={index + 1} onSelectItem={onSelectItem} />
                                ))}
                            </div>
                            <div className="space-y-3">
                                {col2.map((item, index) => (
                                    <MarketListItem key={item.id} item={item} rank={index + 6} onSelectItem={onSelectItem} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <Card className="text-center text-gray-500 py-10">No items found.</Card>
                    )}
                </div>
            );
        }
        case 'volume': {
            const volumeItems = highestVolumeItems.map(item => ({...item, displayValue: `${item.totalVolume.toLocaleString()}`, displayLabel: '24h Volume'}));
            const col1 = volumeItems.slice(0, 5);
            const col2 = volumeItems.slice(5, 10);
            return (
                <div className="max-w-4xl mx-auto">
                     <h2 className="text-2xl font-bold text-white mb-4 text-center">Highest Volume Items (24h)</h2>
                    {volumeItems.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                {col1.map((item, index) => (
                                    <MarketListItem key={item.id} item={item} rank={index + 1} onSelectItem={onSelectItem} />
                                ))}
                            </div>
                            <div className="space-y-3">
                                {col2.map((item, index) => (
                                    <MarketListItem key={item.id} item={item} rank={index + 6} onSelectItem={onSelectItem} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <Card className="text-center text-gray-500 py-10">No items found.</Card>
                    )}
                </div>
            );
        }
        default:
            return null;
    }
  };


  return (
    <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h1 className="text-3xl font-bold text-white">Market Activity</h1>
            <div className="flex flex-wrap items-center gap-4">
                {activeTab === 'movers' && (
                    <>
                        <div className="flex items-center gap-1 bg-gray-800/60 p-1 rounded-lg">
                            <Button size="sm" variant={timeframe === '1h' ? 'secondary' : 'ghost'} onClick={() => setTimeframe('1h')} className="px-3 py-1">1H</Button>
                            <Button size="sm" variant={timeframe === '24h' ? 'secondary' : 'ghost'} onClick={() => setTimeframe('24h')} className="px-3 py-1">24H</Button>
                        </div>
                         <div className="flex items-center gap-1 bg-gray-800/60 p-1 rounded-lg">
                            <Button size="sm" variant={metric === 'percentage' ? 'secondary' : 'ghost'} onClick={() => setMetric('percentage')} className="px-3 py-1">Percentage %</Button>
                            <Button size="sm" variant={metric === 'price' ? 'secondary' : 'ghost'} onClick={() => setMetric('price')} className="px-3 py-1">Price (GP)</Button>
                        </div>
                    </>
                )}
                 <div className="flex items-center gap-2 bg-gray-800/60 p-1 rounded-lg">
                    <label htmlFor="f2p-toggle" className="text-sm text-gray-300 cursor-pointer select-none pl-2">
                        F2P Only
                    </label>
                    <button
                        id="f2p-toggle"
                        role="switch"
                        aria-checked={showF2POnly}
                        onClick={() => setShowF2POnly(prev => !prev)}
                        className={`${
                        showF2POnly ? 'bg-emerald-600' : 'bg-gray-600'
                        } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900`}
                    >
                        <span
                        aria-hidden="true"
                        className={`${
                            showF2POnly ? 'translate-x-5' : 'translate-x-0'
                        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-300 transition-bounce`}
                        />
                    </button>
                </div>
            </div>
        </div>
        
        <div className="flex justify-center mb-6">
            <div className="flex items-center gap-1 bg-gray-800/60 p-1 rounded-lg">
                <Button size="sm" variant={activeTab === 'movers' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('movers')} className="px-4 py-1.5">Top Movers</Button>
                <Button size="sm" variant={activeTab === 'valuable' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('valuable')} className="px-4 py-1.5">Most Valuable</Button>
                <Button size="sm" variant={activeTab === 'volume' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('volume')} className="px-4 py-1.5">Highest Volume</Button>
            </div>
        </div>

        {renderContent()}

    </div>
  );
};