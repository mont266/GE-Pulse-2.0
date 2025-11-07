
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Item, TimeseriesData, LatestPrice, PriceAlert } from '../types';
import { PriceChart } from './PriceChart';
import { VolumeChart } from './VolumeChart';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Loader } from './ui/Loader';
import { ArrowLeftIcon, StarIcon, BellIcon, RefreshCwIcon, ChevronDownIcon, BriefcaseIcon, Share2Icon } from './icons/Icons';
import { getHighResImageUrl, createIconDataUrl } from '../utils/image';

interface ItemViewProps {
  item: Item;
  latestPrice: LatestPrice;
  timeseriesData: TimeseriesData[];
  isLoading: boolean;
  onBack: () => void;
  onRefresh: (item: Item, timeStep: '5m' | '1h' | '6h') => void;
  watchlist: number[];
  toggleWatchlist: (itemId: number) => void;
  alerts: PriceAlert[];
  setAlerts: React.Dispatch<React.SetStateAction<PriceAlert[]>>;
  onOpenAddInvestmentModal: (item: Item) => void;
  onSetAlertActivity: () => void;
}

type TimeView = '1H' | '6H' | '1D' | '1W' | '1M' | '6M' | '1Y';
type ApiTimeStep = '5m' | '1h' | '6h';

const timeViewOptions: TimeView[] = ['1H', '6H', '1D', '1W', '1M', '6M', '1Y'];

export const ItemView: React.FC<ItemViewProps> = ({ item, latestPrice, timeseriesData, isLoading, onBack, onRefresh, watchlist, toggleWatchlist, alerts, setAlerts, onOpenAddInvestmentModal, onSetAlertActivity }) => {
  const [activeTimeView, setActiveTimeView] = useState<TimeView>('1W');
  const [notification, setNotification] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Effect for countdown timer tick
  useEffect(() => {
    if (!isAutoRefreshEnabled) {
      return;
    }
    const intervalId = window.setInterval(() => {
      setCountdown(prevCountdown => prevCountdown > 0 ? prevCountdown - 1 : 0);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isAutoRefreshEnabled]);

  // Effect to trigger refresh when countdown reaches zero
  useEffect(() => {
    if (isAutoRefreshEnabled && countdown <= 0) {
      onRefresh(item, timeViewToApiTimeStep(activeTimeView));
      setCountdown(300); // Reset timer
    }
  }, [countdown, isAutoRefreshEnabled, item, activeTimeView, onRefresh]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const timeViewToApiTimeStep = (timeView: TimeView): ApiTimeStep => {
    if (['1H', '6H', '1D'].includes(timeView)) return '5m';
    if (timeView === '1W') return '1h';
    return '6h'; // for 1M, 6M, 1Y
  };

  const filteredTimeseriesData = useMemo(() => {
    if (!timeseriesData || timeseriesData.length === 0) return [];
    
    const nowInSeconds = Date.now() / 1000;
    let startTimeSeconds: number;

    switch (activeTimeView) {
      case '1H':
        startTimeSeconds = nowInSeconds - 1 * 60 * 60;
        break;
      case '6H':
        startTimeSeconds = nowInSeconds - 6 * 60 * 60;
        break;
      case '1D':
        startTimeSeconds = nowInSeconds - 1 * 24 * 60 * 60;
        break;
      case '1W':
        startTimeSeconds = nowInSeconds - 7 * 24 * 60 * 60;
        break;
      case '1M':
        startTimeSeconds = nowInSeconds - 30 * 24 * 60 * 60;
        break;
      case '6M':
        startTimeSeconds = nowInSeconds - 182 * 24 * 60 * 60; // Approx 6 months
        break;
      case '1Y':
        startTimeSeconds = nowInSeconds - 365 * 24 * 60 * 60;
        break;
      default:
        return timeseriesData;
    }
    
    return timeseriesData.filter(d => d.timestamp >= startTimeSeconds);
  }, [timeseriesData, activeTimeView]);


  const priceFluctuation = useMemo(() => {
    if (isLoading || filteredTimeseriesData.length < 2 || !latestPrice?.high) {
      return null;
    }

    const firstDataPoint = filteredTimeseriesData.find(d => d.avgHighPrice !== null);
    const startPrice = firstDataPoint?.avgHighPrice;

    if (startPrice === undefined || startPrice === null) {
      return null;
    }

    const endPrice = latestPrice.high;
    const absoluteChange = endPrice - startPrice;
    const percentageChange = startPrice !== 0 ? (absoluteChange / startPrice) * 100 : 0;

    return {
      absolute: absoluteChange,
      percent: percentageChange,
    };
  }, [filteredTimeseriesData, latestPrice, isLoading, activeTimeView]);

  const isWatched = watchlist.includes(item.id);
  const existingAlert = alerts.find(a => a.itemId === item.id);

  const handleTimeViewChange = (timeView: TimeView) => {
    setActiveTimeView(timeView);
    onRefresh(item, timeViewToApiTimeStep(timeView));
    if (isAutoRefreshEnabled) {
      setCountdown(300);
    }
    setIsDropdownOpen(false);
  };
  
  const handleSetAlert = () => {
    const currentPrice = latestPrice?.high ?? 0;
    if(currentPrice > 0) {
        if (existingAlert) {
            setAlerts(prev => prev.filter(a => a.itemId !== item.id));
            setNotification(`Alert for ${item.name} removed.`);
        } else {
            const newAlert: PriceAlert = {
                itemId: item.id,
                targetPrice: currentPrice,
                condition: 'below'
            };
            setAlerts(prev => [...prev.filter(a => a.itemId !== item.id), newAlert]);
            onSetAlertActivity();
            setNotification(`Alert set for ${item.name}! You earned XP.`);
        }
        setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleManualRefresh = () => {
    onRefresh(item, timeViewToApiTimeStep(activeTimeView));
    if (isAutoRefreshEnabled) {
      setCountdown(300);
    }
  };

  const handleShare = async () => {
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const shareUrl = `${baseUrl}#/item/${item.id}`;
    try {
        await navigator.clipboard.writeText(shareUrl);
        setNotification('Share link copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        setNotification('Failed to copy link.');
    }
    setTimeout(() => setNotification(null), 3000);
  };
  
  const handleToggleAutoRefresh = () => {
    setIsAutoRefreshEnabled(prev => {
      const newState = !prev;
      if (newState) {
        setCountdown(300);
      }
      return newState;
    });
  };
  
  const formatCountdown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };


  return (
    <div>
      {notification && (
        <div className="fixed top-5 right-5 bg-emerald-500 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-down">
          {notification}
        </div>
      )}
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={onBack} variant="ghost" size="icon">
          <ArrowLeftIcon className="w-6 h-6" />
        </Button>
        <img 
          src={getHighResImageUrl(item.name)}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = createIconDataUrl(item.icon);
          }}
          alt={item.name} 
          className="w-12 h-12 object-contain bg-gray-700/50 rounded-md"
        />
        <h2 className="text-3xl font-bold text-white flex-1">{item.name}</h2>
        <div className="flex items-center gap-2">
            <Button onClick={handleShare} variant="ghost" size="icon" className='text-gray-400 hover:text-emerald-400'>
              <Share2Icon className="w-6 h-6" />
            </Button>
            <Button onClick={() => onOpenAddInvestmentModal(item)} variant="ghost" size="icon" className='text-gray-400 hover:text-emerald-400'>
              <BriefcaseIcon className="w-6 h-6" />
            </Button>
            <Button onClick={() => toggleWatchlist(item.id)} variant="ghost" size="icon" className={isWatched ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}>
              <StarIcon className="w-6 h-6" />
            </Button>
            <Button onClick={handleSetAlert} variant="ghost" size="icon" className={existingAlert ? 'text-emerald-400' : 'text-gray-400 hover:text-emerald-400'}>
                <BellIcon className="w-6 h-6" />
            </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex justify-between items-start mb-4 gap-4 flex-wrap">
               <div className="flex-1 pr-4 min-w-[200px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <p className="text-sm text-gray-400">High Price (Buy)</p>
                    <p className="text-2xl md:text-3xl font-bold text-white truncate">
                      {latestPrice?.high?.toLocaleString() || 'N/A'} gp
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Low Price (Sell)</p>
                    <p className="text-2xl md:text-3xl font-bold text-white truncate">
                      {latestPrice?.low?.toLocaleString() || 'N/A'} gp
                    </p>
                  </div>
                </div>
                {priceFluctuation && (
                  <div className="mt-2">
                    <p className={`text-base font-semibold ${
                      priceFluctuation.absolute > 0 ? 'text-emerald-400' :
                      priceFluctuation.absolute < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {priceFluctuation.absolute >= 0 ? '+' : ''}
                      {priceFluctuation.absolute.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      <span className="ml-1">({priceFluctuation.percent >= 0 ? '+' : ''}{priceFluctuation.percent.toFixed(2)}%)</span>
                      <span className="text-sm font-normal text-gray-400 ml-2">High price change vs. {activeTimeView} ago</span>
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-x-4 gap-y-2 flex-wrap justify-end">
                 <div className="relative" ref={dropdownRef}>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsDropdownOpen(prev => !prev)}
                        className="flex items-center gap-2 w-20 justify-center"
                    >
                        <span>{activeTimeView}</span>
                        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </Button>
                    {isDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-28 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 py-1">
                            {timeViewOptions.map(tv => (
                                <button
                                    key={tv}
                                    onClick={() => handleTimeViewChange(tv)}
                                    className={`w-full text-left px-3 py-1.5 text-sm rounded-md ${
                                        activeTimeView === tv
                                            ? 'bg-emerald-600 text-white'
                                            : 'text-gray-300 hover:bg-gray-700/50'
                                    }`}
                                >
                                    {tv}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <Button onClick={handleManualRefresh} variant="ghost" size="icon" disabled={isLoading || isAutoRefreshEnabled} className="w-9 h-9">
                    {isLoading && !isAutoRefreshEnabled ? (
                      <Loader size="sm" />
                    ) : (
                      <RefreshCwIcon className={`w-4 h-4 ${isAutoRefreshEnabled ? 'text-emerald-400' : ''} ${isLoading && isAutoRefreshEnabled ? 'animate-spin' : ''}`} />
                    )}
                </Button>
                <div className="flex items-center gap-2">
                  {isAutoRefreshEnabled && (
                    <div className="text-sm font-mono text-emerald-300 bg-gray-700/50 rounded-md px-2 py-1 w-[60px] text-center">
                      {formatCountdown(countdown)}
                    </div>
                  )}
                  <label htmlFor="auto-refresh-toggle" className="text-sm text-gray-300 cursor-pointer select-none">
                      Auto
                  </label>
                  <button
                      id="auto-refresh-toggle"
                      role="switch"
                      aria-checked={isAutoRefreshEnabled}
                      onClick={handleToggleAutoRefresh}
                      className={`${
                      isAutoRefreshEnabled ? 'bg-emerald-600' : 'bg-gray-600'
                      } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900`}
                  >
                      <span
                      aria-hidden="true"
                      className={`${
                          isAutoRefreshEnabled ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                      />
                  </button>
                </div>
              </div>
            </div>
            <div className="h-[28rem]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full"><Loader /></div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="flex-grow h-2/3">
                    <PriceChart data={filteredTimeseriesData} />
                  </div>
                  <div className="flex-grow h-1/3 pt-4 border-t border-gray-700/50 mt-4">
                    <p className="text-xs font-bold text-gray-400 text-center -mb-2 z-10 relative">Trade Volume</p>
                    <VolumeChart data={filteredTimeseriesData} />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
        
        <div className="lg:col-span-1">
          <Card>
            <h3 className="text-xl font-bold text-white mb-4">Item Details</h3>
            <div className="space-y-3 text-sm">
                <p><strong className="text-gray-400">Examine:</strong> {item.examine}</p>
                <p><strong className="text-gray-400">Value:</strong> {item.value.toLocaleString()} gp</p>
                <p><strong className="text-gray-400">High Alch:</strong> {item.highalch.toLocaleString()} gp</p>
                <p><strong className="text-gray-400">Buy Limit:</strong> {item.limit.toLocaleString()}</p>
                <p><strong className="text-gray-400">Members:</strong> {item.members ? 'Yes' : 'No'}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
