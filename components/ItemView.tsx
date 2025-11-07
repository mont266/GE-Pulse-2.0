import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import type { Item, TimeseriesData, LatestPrice, PriceAlert, Profile, AggregatePrice, ItemAnalysis } from '../types';
import { PriceChart } from './PriceChart';
import { VolumeChart } from './VolumeChart';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Loader } from './ui/Loader';
import { ArrowLeftIcon, StarIcon, BellIcon, RefreshCwIcon, ChevronDownIcon, BriefcaseIcon, Share2Icon, BotIcon, SlidersIcon } from './icons/Icons';
import { getHighResImageUrl, createIconDataUrl } from '../utils/image';
import { TooltipWrapper } from './ui/Tooltip';
import { SkeletonChart } from './ui/Skeleton';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ChartSettingsModal } from './ChartSettingsModal';
import { AlertSettingsModal } from './AlertSettingsModal';
import { FREE_USER_ALERT_LIMIT } from '../constants';

interface ItemViewProps {
  item: Item;
  latestPrice: LatestPrice;
  timeseriesData: TimeseriesData[];
  isLoading: boolean;
  onBack: () => void;
  onRefresh: (item: Item, timeStep: '5m' | '1h' | '6h') => void;
  onRefreshPrices: () => Promise<void>;
  watchlist: number[];
  toggleWatchlist: (itemId: number) => void;
  pendingWatchlistAdds: Set<number>;
  alerts: PriceAlert[];
  setAlerts: React.Dispatch<React.SetStateAction<PriceAlert[]>>;
  onOpenAddInvestmentModal: (item: Item) => void;
  onSetAlertActivity: (priceType: 'high' | 'low') => void;
  profile: (Profile & { email: string | null; }) | null;
  onSpendToken: () => Promise<void>;
  oneHourPrices: Record<string, AggregatePrice>;
  twentyFourHourPrices: Record<string, AggregatePrice>;
}

type TimeView = '1H' | '6H' | '1D' | '1W' | '1M' | '6M' | '1Y';
type ApiTimeStep = '5m' | '1h' | '6h';

const timeViewOptions: TimeView[] = ['1H', '6H', '1D', '1W', '1M', '6M', '1Y'];
const AUTO_REFRESH_SECONDS = 30;

// Custom hook to animate a number value smoothly.
const useNumberTicker = (value: number, duration: number = 750) => {
    const [displayValue, setDisplayValue] = useState(value);
    const prevValueRef = useRef(value);

    useEffect(() => {
        const startValue = prevValueRef.current;
        const endValue = value;
        prevValueRef.current = value;

        if (startValue === endValue) {
            if (displayValue !== endValue) setDisplayValue(endValue);
            return;
        }

        let startTime: number;
        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            // Ease-out cubic function for a smooth slowdown
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            
            const newDisplayValue = startValue + (endValue - startValue) * easedProgress;
            setDisplayValue(newDisplayValue);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setDisplayValue(endValue);
            }
        };

        requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, duration]);

    return displayValue;
};


const Tag: React.FC<{ text: string; color: 'green' | 'yellow' | 'red' | 'blue' }> = ({ text, color }) => {
    const colors = {
        green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
        red: 'bg-red-500/20 text-red-300 border-red-500/30',
        blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    };
    return (
        <div className={`text-xs font-bold px-2 py-0.5 rounded-full border ${colors[color]}`}>
            {text}
        </div>
    )
};

const CountdownCircle: React.FC<{ countdown: number; duration: number }> = ({ countdown, duration }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = (countdown / duration) * circumference;

  return (
    <div className="relative w-9 h-9">
      <svg className="w-full h-full" viewBox="0 0 40 40">
        <circle
          className="text-gray-700"
          strokeWidth="4"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="20"
          cy="20"
        />
        <circle
          className="text-emerald-500"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="20"
          cy="20"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
         <RefreshCwIcon className="w-4 h-4 text-emerald-400" />
      </div>
    </div>
  );
};


export const ItemView: React.FC<ItemViewProps> = ({ item, latestPrice, timeseriesData, isLoading, onBack, onRefresh, onRefreshPrices, watchlist, toggleWatchlist, pendingWatchlistAdds, alerts, setAlerts, onOpenAddInvestmentModal, onSetAlertActivity, profile, onSpendToken, oneHourPrices, twentyFourHourPrices }) => {
  const [activeTimeView, setActiveTimeView] = useState<TimeView>('1W');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [shakeBellIcon, setShakeBellIcon] = useState(false);
  
  // Chart state
  const [chartFlash, setChartFlash] = useState<'up' | 'down' | 'neutral' | null>(null);
  const [prevLatestPrice, setPrevLatestPrice] = useState<LatestPrice | null>(null);
  const isInitialLoad = useRef(true);

  // Modals State
  const [isChartSettingsModalOpen, setIsChartSettingsModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [chartSettings, setChartSettings] = useLocalStorage('chartSettings', { showAverageLine: true });

  // AI Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ItemAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Star animation state
  const isWatched = watchlist.includes(item.id);
  const prevIsWatched = useRef(isWatched);
  const [isAnimatingStar, setIsAnimatingStar] = useState(false);

  // --- Price Fluctuation Animation State ---
  const [lastValidFluctuation, setLastValidFluctuation] = useState<{ absolute: number; percent: number } | null>(null);
  
  // Effect to manage initial load state for chart animations
  useEffect(() => {
    if (isLoading) {
      isInitialLoad.current = true; // Reset on new item load
    } else {
      // After loading finishes, wait for the animation duration before disabling it for subsequent updates.
      const timer = setTimeout(() => {
        isInitialLoad.current = false;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  useEffect(() => {
    // Trigger animation only when adding to watchlist (isWatched goes from false to true)
    if (isWatched && !prevIsWatched.current) {
      setIsAnimatingStar(true);
      const timer = setTimeout(() => setIsAnimatingStar(false), 300); // Match animation duration
      return () => clearTimeout(timer);
    }
    prevIsWatched.current = isWatched;
  }, [isWatched]);
  
  const handleRefresh = async () => {
    setPrevLatestPrice(latestPrice); // Store current price before fetching new one
    await Promise.all([
        onRefresh(item, timeViewToApiTimeStep(activeTimeView)),
        onRefreshPrices()
    ]);
  };

  // Effect for countdown timer tick
  useEffect(() => {
    if (!isAutoRefreshEnabled) return;
    const intervalId = window.setInterval(() => {
      setCountdown(prevCountdown => prevCountdown > 0 ? prevCountdown - 1 : 0);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [isAutoRefreshEnabled]);

  // Effect to trigger refresh when countdown reaches zero
  useEffect(() => {
    if (isAutoRefreshEnabled && countdown <= 0) {
      handleRefresh();
      setCountdown(AUTO_REFRESH_SECONDS); // Reset timer
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, isAutoRefreshEnabled]);
  
  // Effect to trigger flash animation on price change
  useEffect(() => {
    if (!isInitialLoad.current && prevLatestPrice && latestPrice?.high != null && prevLatestPrice.high != null) {
        if (latestPrice.high > prevLatestPrice.high) {
            setChartFlash('up');
        } else if (latestPrice.high < prevLatestPrice.high) {
            setChartFlash('down');
        } else {
            setChartFlash('neutral');
        }
    }
  }, [latestPrice, prevLatestPrice]);
  
  // Effect to reset flash state after animation completes
  useEffect(() => {
    if (chartFlash) {
        const timer = setTimeout(() => setChartFlash(null), 1500); // Corresponds to animation duration
        return () => clearTimeout(timer);
    }
  }, [chartFlash]);

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
  }, [filteredTimeseriesData, latestPrice, isLoading]);

  // Update the persistent state whenever we get new valid fluctuation data
  useEffect(() => {
      if (priceFluctuation) {
          setLastValidFluctuation(priceFluctuation);
      }
  }, [priceFluctuation]);
  
  // Use the latest data if available, otherwise fall back to the last known good data to prevent flickering
  const displayFluctuation = priceFluctuation ?? lastValidFluctuation;

  // Apply the number ticker animation to the displayed values
  const animatedAbsolute = useNumberTicker(displayFluctuation?.absolute ?? 0);
  const animatedPercent = useNumberTicker(displayFluctuation?.percent ?? 0);

  const existingAlert = alerts.find(a => a.itemId === item.id);

  const handleTimeViewChange = (timeView: TimeView) => {
    setActiveTimeView(timeView);
    onRefresh(item, timeViewToApiTimeStep(timeView));
    if (isAutoRefreshEnabled) {
      setCountdown(AUTO_REFRESH_SECONDS);
    }
    setIsDropdownOpen(false);
  };
  
  const handleOpenAlertModal = () => {
    if (!profile?.premium && !existingAlert && alerts.length >= FREE_USER_ALERT_LIMIT) {
        setNotification({ message: 'Free users are limited to 10 alerts. Upgrade for unlimited.', type: 'error' });
        setShakeBellIcon(true);
        setTimeout(() => setShakeBellIcon(false), 820);
    } else {
        setIsAlertModalOpen(true);
    }
  };

  const handleSaveAlert = (newAlert: PriceAlert) => {
    const isNew = !existingAlert;
    if (isNew) {
      onSetAlertActivity(newAlert.priceType);
    }
    setAlerts(prev => [...prev.filter(a => a.itemId !== newAlert.itemId), newAlert]);
    setNotification({
      message: `Alert ${isNew ? 'set' : 'updated'} for ${item.name}!`,
      type: 'success'
    });
    setTimeout(() => setNotification(null), 3000);
    setIsAlertModalOpen(false);
  };

  const handleRemoveAlert = (itemId: number) => {
    setAlerts(prev => prev.filter(a => a.itemId !== itemId));
    setNotification({ message: `Alert for ${item.name} removed.`, type: 'success' });
    setTimeout(() => setNotification(null), 3000);
    setIsAlertModalOpen(false);
  };

  const handleManualRefresh = () => {
    handleRefresh();
    if (isAutoRefreshEnabled) {
      setCountdown(AUTO_REFRESH_SECONDS);
    }
  };

  const handleShare = async () => {
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const shareUrl = `${baseUrl}#/item/${item.id}`;
    try {
        await navigator.clipboard.writeText(shareUrl);
        setNotification({ message: 'Share link copied to clipboard!', type: 'success' });
    } catch (err) {
        console.error('Failed to copy text: ', err);
        setNotification({ message: 'Failed to copy link.', type: 'error' });
    }
    setTimeout(() => setNotification(null), 3000);
  };
  
  const handleToggleAutoRefresh = () => {
    setIsAutoRefreshEnabled(prev => {
      const newState = !prev;
      if (newState) {
        setCountdown(AUTO_REFRESH_SECONDS);
      }
      return newState;
    });
  };

  const handleGetAiAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAiError(null);

    try {
        await onSpendToken();

        const price1h = oneHourPrices[item.id];
        const price24h = twentyFourHourPrices[item.id];

        const contextData = {
            name: item.name,
            limit: item.limit,
            currentBuyPrice: latestPrice.high,
            currentSellPrice: latestPrice.low,
            priceChange1h: price1h?.avgHighPrice ? (((latestPrice.high ?? 0) - price1h.avgHighPrice) / price1h.avgHighPrice * 100).toFixed(2) + '%' : 'N/A',
            volume1h: (price1h?.highPriceVolume ?? 0) + (price1h?.lowPriceVolume ?? 0),
            priceChange24h: price24h?.avgHighPrice ? (((latestPrice.high ?? 0) - price24h.avgHighPrice) / price24h.avgHighPrice * 100).toFixed(2) + '%' : 'N/A',
            volume24h: (price24h?.highPriceVolume ?? 0) + (price24h?.lowPriceVolume ?? 0),
            priceFluctuationVsPeriodStart: priceFluctuation ? `${priceFluctuation.percent.toFixed(2)}% over ${activeTimeView}` : 'N/A',
        };

        const prompt = `You are an expert market analyst for the video game Old School RuneScape, specializing in the Grand Exchange. Analyze the provided market data for the item "${item.name}" and provide a concise, expert opinion for a player considering trading this item.
        
        Market Data: ${JSON.stringify(contextData, null, 2)}

        Your task is to:
        1.  Evaluate the item's short-term price trend, volume, and volatility.
        2.  Provide a clear 'suggestion': 'Buy Now' (strong upward trend, good volume), 'Watch' (uncertain trend, needs more data), 'Avoid' (downward trend, low volume, high risk), or 'Potential Quick Flip' (high volume, small but consistent margin).
        3.  Assign a 'confidence' level (High, Medium, Low) to your suggestion.
        4.  Assign a 'risk' level (High, Medium, Low). High volume and stability is Low risk. Low volume and high volatility is High risk.
        5.  Write a brief 'analysisText' (2-4 sentences) explaining your reasoning. Reference the data, such as volume and recent price changes, to justify your conclusion.

        Return the entire response as a single JSON object.`;

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                suggestion: { type: Type.STRING, enum: ['Buy Now', 'Watch', 'Avoid', 'Potential Quick Flip'] },
                confidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                risk: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                analysisText: { type: Type.STRING },
            },
            required: ["suggestion", "confidence", "risk", "analysisText"],
        };
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
            },
        });
        
        const result = JSON.parse(response.text.trim()) as ItemAnalysis;
        setAnalysisResult(result);

    } catch (err: any) {
        console.error("AI Analysis Error:", err);
        setAiError(err.message || 'An error occurred during analysis.');
    } finally {
        setIsAnalyzing(false);
    }
  };
  
  const isPendingAdd = pendingWatchlistAdds.has(item.id);

  return (
    <div>
      {notification && (
        <div className={`fixed top-5 right-5 ${notification.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'} text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in`}>
          {notification.message}
        </div>
      )}
      {isChartSettingsModalOpen && (
        <ChartSettingsModal
            settings={chartSettings}
            onClose={() => setIsChartSettingsModalOpen(false)}
            onSettingsChange={setChartSettings}
        />
      )}
      {isAlertModalOpen && (
        <AlertSettingsModal
            item={item}
            latestPrice={latestPrice}
            existingAlert={existingAlert ?? null}
            onClose={() => setIsAlertModalOpen(false)}
            onSave={handleSaveAlert}
            onRemove={handleRemoveAlert}
        />
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
            <Button onClick={() => toggleWatchlist(item.id)} variant="ghost" size="icon" className={`${isWatched ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'} ${isPendingAdd ? 'pulse-bg rounded-full' : ''}`}>
              <StarIcon className={`w-6 h-6 ${isAnimatingStar ? 'animate-pop' : ''}`} />
            </Button>
            <Button onClick={handleOpenAlertModal} variant="ghost" size="icon" className={`${existingAlert ? 'text-emerald-400' : 'text-gray-400 hover:text-emerald-400'} ${shakeBellIcon ? 'animate-shake' : ''}`}>
                <BellIcon className="w-6 h-6" />
            </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="relative">
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
                {displayFluctuation && (
                    <div className="mt-2">
                        <p className={`text-base font-semibold ${
                            animatedAbsolute > 0 ? 'text-emerald-400' :
                            animatedAbsolute < 0 ? 'text-red-400' : 'text-gray-400'
                        }`}>
                            {animatedAbsolute >= 0 ? '+' : ''}
                            {Math.round(animatedAbsolute).toLocaleString()}
                            <span className="ml-1">({animatedPercent >= 0 ? '+' : ''}{animatedPercent.toFixed(2)}%)</span>
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
                <Button onClick={() => setIsChartSettingsModalOpen(true)} variant="secondary" size="icon" className="w-9 h-9">
                    <SlidersIcon className="w-5 h-5" />
                </Button>
                {isAutoRefreshEnabled ? (
                    <CountdownCircle countdown={countdown} duration={AUTO_REFRESH_SECONDS} />
                ) : (
                    <Button onClick={handleManualRefresh} variant="ghost" size="icon" disabled={isLoading} className="w-9 h-9">
                        {isLoading ? <Loader size="sm" /> : <RefreshCwIcon className="w-4 h-4" />}
                    </Button>
                )}
                <div className="flex items-center gap-2">
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
                      } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-300 transition-bounce`}
                      />
                  </button>
                </div>
              </div>
            </div>
            <div className="h-[28rem]">
              {isLoading && isInitialLoad.current ? (
                <SkeletonChart />
              ) : (
                <div className="h-full flex flex-col animate-fade-in">
                  <div className="flex-grow h-2/3">
                    <PriceChart data={filteredTimeseriesData} isInitialLoad={isInitialLoad.current} showAverageLine={chartSettings.showAverageLine} />
                  </div>
                  <div className="flex-grow h-1/3 pt-4 border-t border-gray-700/50 mt-4">
                    <p className="text-xs font-bold text-gray-400 text-center -mb-2 z-10 relative">Trade Volume</p>
                    <VolumeChart data={filteredTimeseriesData} isInitialLoad={isInitialLoad.current} />
                  </div>
                </div>
              )}
            </div>
            {chartFlash && (
              <div
                key={chartFlash + Date.now()} // Force re-animation
                className={`absolute inset-0 rounded-lg pointer-events-none ${
                  chartFlash === 'up' ? 'animate-glow-green' :
                  chartFlash === 'down' ? 'animate-glow-red' :
                  'animate-glow-white'
                }`}
              ></div>
            )}
          </Card>
           {(isAnalyzing || analysisResult || aiError) && (
                <Card className="mt-6">
                    <div className="flex items-center gap-3 mb-4">
                        <BotIcon className="w-6 h-6 text-emerald-400" />
                        <h3 className="text-xl font-bold text-white">AI Market Analysis</h3>
                    </div>
                    {isAnalyzing && (
                         <div className="flex flex-col items-center justify-center text-center p-8">
                             <Loader />
                             <p className="text-gray-300 mt-4">Analyzing market data for {item.name}...</p>
                         </div>
                    )}
                    {aiError && <p className="text-red-400 bg-red-500/10 p-3 rounded-md">{aiError}</p>}
                    {analysisResult && (
                        <div>
                            <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b border-gray-700/50">
                                <div>
                                    <p className="text-sm text-gray-400">Suggestion</p>
                                    <Tag text={analysisResult.suggestion} color={analysisResult.suggestion === 'Buy Now' || analysisResult.suggestion === 'Potential Quick Flip' ? 'green' : analysisResult.suggestion === 'Watch' ? 'yellow' : 'red'} />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Confidence</p>
                                    <Tag text={analysisResult.confidence} color={analysisResult.confidence === 'High' ? 'green' : analysisResult.confidence === 'Medium' ? 'yellow' : 'red'} />
                                </div>
                                 <div>
                                    <p className="text-sm text-gray-400">Risk</p>
                                    <Tag text={analysisResult.risk} color={analysisResult.risk === 'High' ? 'red' : analysisResult.risk === 'Medium' ? 'yellow' : 'green'} />
                                </div>
                            </div>
                            <p className="text-gray-300 whitespace-pre-wrap">{analysisResult.analysisText}</p>
                        </div>
                    )}
                </Card>
            )}
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
           <div className="mt-6">
                <Button
                    onClick={handleGetAiAnalysis}
                    variant="secondary"
                    className="w-full justify-center !py-3"
                    disabled={!profile || profile.tokens <= 0 || isAnalyzing}
                >
                    {isAnalyzing ? (
                        <Loader size="sm" />
                    ) : (
                        <>
                            <BotIcon className="w-5 h-5 mr-2" />
                            <span>AI Assistant (1 Token)</span>
                        </>
                    )}
                </Button>
                 {profile && profile.tokens <= 0 && !isAnalyzing && (
                    <p className="text-xs text-center text-yellow-400 mt-2">You're out of tokens! More are awarded for activity.</p>
                )}
                {!profile && (
                    <p className="text-xs text-center text-gray-400 mt-2">Login to use the AI Assistant.</p>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};