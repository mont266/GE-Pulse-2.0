
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import type { Item, LatestPrice, AggregatePrice, FlippingSuggestion, Profile, HistoricAnalysis } from '../types';
import { BotIcon, SearchIcon, DollarSignIcon, InfoIcon, ClockIcon, ChevronRightIcon, ZapIcon, ChevronDownIcon } from './icons/Icons';
import { Button } from './ui/Button';
import { Loader } from './ui/Loader';
import { Card } from './ui/Card';
import { getHighResImageUrl, createIconDataUrl, parseShorthandPrice, calculateGeTax } from '../utils/image';
import { ProgressBar } from './ui/ProgressBar';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { fetchTimeseries } from '../services/osrsWikiApi';

interface FlippingAssistantPageProps {
  items: Record<string, Item>;
  latestPrices: Record<string, LatestPrice>;
  oneHourPrices: Record<string, AggregatePrice>;
  twentyFourHourPrices: Record<string, AggregatePrice>;
  isLoading: boolean;
  onSelectItem: (item: Item) => void;
  error: string | null;
  profile: (Profile & { email: string | null; }) | null;
  onSpendToken: () => Promise<void>;
}

type Strategy = 'balanced' | 'high_margin' | 'dip_buys' | 'momentum_plays';

const FUN_STATUS_MESSAGES = [
    "Consulting the Wise Old Man...",
    "Analyzing market liquidity...",
    "Calculating GE tax with a dwarven abacus...",
    "Detecting high-velocity trade patterns...",
    "Haggling with a Gnome for better rates...",
    "Checking for market manipulation...",
    "Scouring the WGS for price anomalies...",
    "Calibrating the profit-o-meter...",
    "Polishing the crystal ball of finance...",
    "Bribing goblins for market intel...",
    "Decoding ancient market scrolls...",
];

const LOW_LIMIT_THRESHOLD = 1000;

const Tag: React.FC<{ text: string; color: 'green' | 'yellow' | 'red' | 'blue'; icon?: React.ElementType; tooltipText?: string; }> = ({ text, color, icon: Icon, tooltipText }) => {
    const colors = {
        green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
        red: 'bg-red-500/20 text-red-300 border-red-500/30',
        blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    };
    
    const tagContent = (
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${colors[color]}`}>
            {Icon && <Icon className="w-3 h-3" />}
            <span>{text}</span>
        </div>
    );

    if (!tooltipText) {
        return tagContent;
    }

    return (
        <div className="relative group">
            {tagContent}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-gray-900 text-white text-xs rounded-lg py-1.5 px-2.5 shadow-lg border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {tooltipText}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 transform rotate-45 border-b border-r border-gray-700"></div>
            </div>
        </div>
    );
};

const CollapsibleAnalysis: React.FC<{ justification: string, riskJustification: string }> = ({ justification, riskJustification }) => {
    // Combine the risk assessment and the main justification for parsing
    const fullJustification = `**Risk Assessment:** ${riskJustification}\n\n${justification}`;
    
    // Regex to split the justification by sections that start with a bolded title (e.g., **Web Insight:**)
    const sections = fullJustification.split(/\n\n(?=\*\*.+?\*\*)/);

    if (sections.length <= 1) {
        return <p className="text-sm text-gray-300 whitespace-pre-wrap">{fullJustification}</p>;
    }

    // The first part is always visible
    const firstPart = sections[0].trim();
    
    // The rest of the sections are collapsible
    const collapsibleParts = sections.slice(1).map(part => {
        const match = part.match(/\*\*(.+?)\*\*\s*([\s\S]*)/);
        if (match) {
            const title = match[1].trim();
            const content = match[2].trim();
            return { title, content };
        }
        return null;
    }).filter((p): p is { title: string; content: string } => p !== null);

    return (
        <>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{firstPart}</p>
            {collapsibleParts.map((part, index) => (
                <details key={index} className="mt-3 group">
                    <summary className="flex items-center gap-2 font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors list-none">
                        <ChevronRightIcon className="w-4 h-4 transition-transform duration-200 group-open:rotate-90 flex-shrink-0" />
                        <span>{part.title}</span>
                    </summary>
                    <div className="pl-6 pt-2 pb-1 text-gray-300 whitespace-pre-wrap border-l-2 border-gray-700/50 ml-2">
                        {part.content}
                    </div>
                </details>
            ))}
        </>
    );
};


const SuggestionCard: React.FC<{ suggestion: FlippingSuggestion; onSelect: () => void; allItems: Record<string, Item> }> = ({ suggestion, onSelect, allItems }) => {
    const [isWebSourcesOpen, setIsWebSourcesOpen] = useState(false);
    const riskColor = suggestion.riskLevel === 'High' ? 'red' : suggestion.riskLevel === 'Medium' ? 'yellow' : 'green';
    const velocityColor = suggestion.flipVelocity === 'Very High' ? 'blue' : suggestion.flipVelocity === 'High' ? 'green' : suggestion.flipVelocity === 'Medium' ? 'yellow' : 'red';
    const validWebSources = suggestion.webSources?.filter(s => s.web?.uri && s.web?.title);

    return (
        <Card className="border border-gray-700/50 flex flex-col">
            <div className="flex items-start gap-4 mb-3">
                <img 
                    src={getHighResImageUrl(suggestion.itemName)}
                    onError={(e) => {
                        const item = allItems[suggestion.itemId];
                        if (item) e.currentTarget.src = createIconDataUrl(item.icon);
                    }}
                    alt={suggestion.itemName}
                    className="w-12 h-12 object-contain bg-gray-700/50 rounded-md"
                />
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-white">{suggestion.itemName}</h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Tag 
                            text={suggestion.flipVelocity} 
                            color={velocityColor} 
                            icon={ZapIcon}
                            tooltipText="Indicates how quickly an item's buy limit can be traded. 'Very High' suggests multiple times per day."
                        />
                        <Tag 
                            text={suggestion.riskLevel} 
                            color={riskColor}
                            tooltipText="The AI's assessment of price volatility and market liquidity. 'Low' risk items are generally stable with high trade volume."
                        />
                         {validWebSources && validWebSources.length > 0 && (
                            <div className="relative group">
                                <Tag text="Web Verified" color="blue" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-gray-900 text-white text-xs rounded-lg py-1.5 px-2.5 shadow-lg border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    AI analysis enhanced with Google Search.
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 transform rotate-45 border-b border-r border-gray-700"></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
             <div className="mb-4">
                <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-semibold text-gray-400">Confidence</span>
                    <span className="font-bold text-white">{suggestion.confidenceScore}%</span>
                </div>
                <ProgressBar progress={suggestion.confidenceScore} />
            </div>
            
            <div className="space-y-3 text-sm bg-gray-900/50 p-3 rounded-md">
                 <div className="flex justify-between">
                    <span className="text-gray-400">Buy / Sell Price</span>
                    <span className="font-semibold text-white">{suggestion.buyPrice.toLocaleString()} / {suggestion.sellPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Buy Limit</span>
                    <span className="font-semibold text-white">{allItems[suggestion.itemId]?.limit.toLocaleString() ?? 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Net Margin / Item</span>
                    <span className="font-bold text-emerald-400">+{suggestion.netMarginPerItem.toLocaleString()} gp</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-gray-400">Potential Profit</span>
                    <span className="font-bold text-emerald-300">+{suggestion.potentialProfit.toLocaleString()} gp</span>
                </div>
            </div>
            
            <div className="mt-4 flex-grow">
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">AI Analysis</p>
                <CollapsibleAnalysis justification={suggestion.justification} riskJustification={suggestion.riskJustification} />
            </div>

            {validWebSources && validWebSources.length > 0 && (
                <div className="mt-4">
                    <button 
                        onClick={() => setIsWebSourcesOpen(p => !p)}
                        className="w-full flex justify-between items-center text-left text-xs font-semibold text-gray-400 mb-1.5 uppercase hover:text-gray-200 transition-colors"
                        aria-expanded={isWebSourcesOpen}
                    >
                        <span>Web Sources</span>
                        <ChevronRightIcon className={`w-4 h-4 transition-transform duration-200 ${isWebSourcesOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {isWebSourcesOpen && (
                        <div className="space-y-1.5 pt-1">
                            {validWebSources.map((source, index) => (
                                <a 
                                    href={source.web!.uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    key={index}
                                    className="text-xs text-emerald-400 hover:underline block truncate bg-gray-900/50 p-2 rounded-md"
                                >
                                    {source.web!.title}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <Button onClick={onSelect} variant="secondary" size="sm" className="w-full mt-4">
                <SearchIcon className="w-4 h-4 mr-2" />
                View Item
            </Button>
        </Card>
    );
};

type Currency = {
  code: string;
  symbol: string;
  rate: number; // Rate relative to USD
};

const currencies: Currency[] = [
  { code: 'USD', symbol: '$', rate: 1.0 },
  { code: 'EUR', symbol: '€', rate: 0.93 },
  { code: 'GBP', symbol: '£', rate: 0.79 },
  { code: 'AUD', symbol: 'A$', rate: 1.51 },
  { code: 'CAD', symbol: 'C$', rate: 1.37 },
];

const TokenPurchaseSection = () => {
    const [selectedCurrency, setSelectedCurrency] = useState<Currency>(currencies[0]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchCurrencyForUser = async () => {
            try {
                // This free API determines currency from the user's IP address without needing permissions.
                const response = await fetch('https://ipapi.co/json/');
                if (!response.ok) {
                    console.warn('Could not fetch currency from IP API.');
                    return;
                }
                const data = await response.json();
                const userCurrencyCode = data.currency;
                
                const matchedCurrency = currencies.find(c => c.code === userCurrencyCode);
                
                if (matchedCurrency) {
                    setSelectedCurrency(matchedCurrency);
                }
            } catch (error) {
                console.warn('Could not auto-detect currency:', error);
                // Gracefully fall back to the default (USD).
            }
        };

        fetchCurrencyForUser();
    }, []); // Empty dependency array ensures this runs only once on mount.

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const bundles = [
        { tokens: 5, basePriceUSD: 0.99, description: 'For a few quick checks.' },
        { tokens: 10, basePriceUSD: 1.79, description: 'Great for regular traders.' },
        { tokens: 25, basePriceUSD: 3.99, description: 'Best value for power users.' },
    ];

    return (
        <div className="max-w-3xl mx-auto mt-12">
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white">Need More Tokens?</h2>
                <p className="text-gray-400">Top up your balance to continue using the AI Assistant.</p>
            </div>
             <div className="flex justify-center mb-6">
                <div className="relative" ref={dropdownRef}>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsDropdownOpen(prev => !prev)}
                        className="flex items-center gap-2"
                        aria-haspopup="true"
                        aria-expanded={isDropdownOpen}
                    >
                        <span>Displaying prices in {selectedCurrency.code}</span>
                        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </Button>
                    {isDropdownOpen && (
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 py-1">
                            {currencies.map(currency => (
                                <button
                                    key={currency.code}
                                    onClick={() => {
                                        setSelectedCurrency(currency);
                                        setIsDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-sm rounded-md ${
                                        selectedCurrency.code === currency.code
                                            ? 'bg-emerald-600 text-white'
                                            : 'text-gray-300 hover:bg-gray-700/50'
                                    }`}
                                    role="option"
                                    aria-selected={selectedCurrency.code === currency.code}
                                >
                                    {currency.code} - {currency.symbol}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {bundles.map(bundle => {
                    const calculatedPrice = (bundle.basePriceUSD * selectedCurrency.rate).toFixed(2);
                    return (
                        <Card key={bundle.tokens} className="text-center p-6 flex flex-col justify-between border-gray-700">
                            <div>
                                <BotIcon className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                                <h3 className="text-2xl font-bold text-white">{bundle.tokens} Tokens</h3>
                                <p className="text-gray-400 text-sm mt-1 mb-4">{bundle.description}</p>
                                <p className="text-4xl font-extrabold text-white my-4">
                                    {selectedCurrency.symbol}{calculatedPrice}
                                </p>
                            </div>
                            <Button
                                variant="primary"
                                className="w-full mt-4 cursor-not-allowed bg-gray-600 hover:bg-gray-600 text-gray-300"
                                disabled
                            >
                                Coming Soon
                            </Button>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export const FlippingAssistantPage: React.FC<FlippingAssistantPageProps> = ({ items, latestPrices, oneHourPrices, twentyFourHourPrices, isLoading: isDataLoading, onSelectItem, error: dataError, profile, onSpendToken }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [suggestions, setSuggestions] = useState<FlippingSuggestion[]>([]);
    const [aiError, setAiError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    
    // User inputs
    const [budget, setBudget] = useState('10m');
    const [strategy, setStrategy] = useState<Strategy>('balanced');
    const [ignoreLowLimits, setIgnoreLowLimits] = useState(true);
    const [analysisParams, setAnalysisParams] = useState<{ budget: string; strategy: Strategy; ignoreLowLimits: boolean; } | null>(null);

    // History state
    const [history, setHistory] = useLocalStorage<HistoricAnalysis[]>('flippingHistory', []);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoricAnalysis | null>(null);
    
    const shuffledMessages = useRef<string[]>([]);
    const messageIndex = useRef(0);

    useEffect(() => {
        let interval: number;
        if (isAnalyzing) {
            // Fisher-Yates shuffle algorithm
            const shuffle = (array: string[]) => {
                let currentIndex = array.length, randomIndex;
                while (currentIndex !== 0) {
                    randomIndex = Math.floor(Math.random() * currentIndex);
                    currentIndex--;
                    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
                }
                return array;
            };

            // Initial shuffle and set first message
            shuffledMessages.current = shuffle([...FUN_STATUS_MESSAGES]);
            messageIndex.current = 0;
            setStatusMessage(shuffledMessages.current[messageIndex.current]);

            interval = window.setInterval(() => {
                messageIndex.current = messageIndex.current + 1;
                // If we've shown all messages, re-shuffle and start over
                if (messageIndex.current >= shuffledMessages.current.length) {
                    shuffledMessages.current = shuffle([...FUN_STATUS_MESSAGES]);
                    messageIndex.current = 0;
                }
                setStatusMessage(shuffledMessages.current[messageIndex.current]);
            }, 3000);
        }
        return () => window.clearInterval(interval);
    }, [isAnalyzing]);


    const handleAnalyze = async () => {
        if (!profile || profile.tokens <= 0) {
            setAiError("You don't have enough tokens to use the AI Assistant.");
            return;
        }
        setIsAnalyzing(true);
        setAiError(null);
        setSuggestions([]);
        setProgress(0);
        setStatusMessage('');
        setAnalysisParams({ budget, strategy, ignoreLowLimits });

        try {
            setStatusMessage('Verifying Token...');
            setProgress(10);
            await onSpendToken();
            
            setStatusMessage('Parsing budget...');
            setProgress(15);
            const parsedBudget = parseShorthandPrice(budget);
            if (isNaN(parsedBudget) || parsedBudget <= 0) {
                throw new Error("Invalid budget. Please enter a positive number, e.g., '10k', '25m'.");
            }
            
            setStatusMessage('Performing deep market analysis...');
            setProgress(20);

            const candidates = Object.values(items)
                .map((item: Item) => {
                    const latest = latestPrices[item.id];
                    const price24h = twentyFourHourPrices[item.id];
                    
                    if (!latest || !latest.high || !latest.low || !item.limit || item.limit <= 0 || latest.high < 1000 || !price24h) return null;
                    if (ignoreLowLimits && item.limit < LOW_LIMIT_THRESHOLD) return null;

                    const buyPrice = latest.high;
                    const sellPrice = latest.low;
                    const taxPerItem = calculateGeTax(item.name, sellPrice, 1);
                    if ((sellPrice - buyPrice - taxPerItem) <= 0) return null;
                    const quantityToFlip = Math.min(Math.floor(parsedBudget / buyPrice), item.limit);
                    if (quantityToFlip <= 0) return null;
                    const totalTaxForFlip = calculateGeTax(item.name, sellPrice, quantityToFlip);
                    const potentialProfit = (sellPrice * quantityToFlip) - (buyPrice * quantityToFlip) - totalTaxForFlip;
                    if (potentialProfit <= 0) return null;
                    const netMargin = potentialProfit / quantityToFlip;
                    
                    const volume24hBuy = price24h.highPriceVolume;
                    const volume24hSell = price24h.lowPriceVolume;

                    if (volume24hBuy < 100 || volume24hSell < 100) return null;
                    const liquidityRatio = volume24hSell / volume24hBuy;
                    if (liquidityRatio < 0.25) return null;

                    const price1h = oneHourPrices[item.id];
                    const priceChange1h = (price1h?.avgHighPrice && latest.high) ? ((latest.high - price1h.avgHighPrice) / price1h.avgHighPrice) * 100 : 0;
                    const priceChange24h = (price24h?.avgHighPrice && latest.high) ? ((latest.high - price24h.avgHighPrice) / price24h.avgHighPrice) * 100 : 0;
                    if (!isFinite(priceChange1h) || !isFinite(priceChange24h)) return null;

                    const getTradabilityTier = (): 'Excellent' | 'Good' | 'Fair' | 'Poor' => {
                        const totalVolume = volume24hBuy + volume24hSell;
                        if (totalVolume > 5000 && liquidityRatio > 0.75) return 'Excellent';
                        if (totalVolume > 1000 && liquidityRatio > 0.5) return 'Good';
                        if (totalVolume > 250 && liquidityRatio > 0.3) return 'Fair';
                        return 'Poor';
                    };
                    const tradabilityTier = getTradabilityTier();

                    if (strategy === 'balanced' && (tradabilityTier === 'Fair' || tradabilityTier === 'Poor')) return null;
                    if (strategy !== 'balanced' && tradabilityTier === 'Poor') return null;

                    const flipVelocityScore = (volume24hBuy + volume24hSell) / item.limit;

                    return {
                        id: item.id, name: item.name, limit: item.limit,
                        latestHigh: latest.high, latestLow: latest.low,
                        netMargin, netMarginPercentage: (netMargin / latest.high) * 100,
                        potentialProfit,
                        volume24hBuy, volume24hSell, liquidityRatio, flipVelocityScore,
                        priceChange1h, priceChange24h, tradabilityTier,
                    };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null);

            setStatusMessage('Ranking top candidates...');
            setProgress(30);

            const sortedCandidates = candidates.sort((a, b) => {
                const score = (c: typeof candidates[0]) => {
                    let score = 0;
                    const roiScore = c.netMarginPercentage * 15; // Emphasize ROI
                    const velocityScore = Math.log(c.flipVelocityScore + 1) * 10; // Emphasize turnover speed
                    const profitMagnitudeScore = Math.log(c.potentialProfit + 1); // Still consider total profit, but with less weight

                    switch(strategy) {
                        case 'high_margin':
                            score = roiScore * 2 + velocityScore + profitMagnitudeScore; break;
                        case 'dip_buys':
                            const dipBonus = c.priceChange24h < -1 ? -c.priceChange24h : 0; // Bonus for items that dipped > 1%
                            score = roiScore + velocityScore + profitMagnitudeScore + dipBonus; break;
                        case 'momentum_plays':
                            const momentumBonus = c.priceChange1h > 0.5 ? c.priceChange1h * 2 : 0; // Bonus for recent upward momentum
                            score = roiScore + velocityScore + profitMagnitudeScore + momentumBonus; break;
                        case 'balanced':
                        default:
                            const tradabilityBonus = c.tradabilityTier === 'Excellent' ? 10 : c.tradabilityTier === 'Good' ? 5 : 0;
                            score = roiScore + velocityScore * 1.5 + profitMagnitudeScore + tradabilityBonus; break;
                    }
                    return score;
                };
                return score(b) - score(a);
            }).slice(0, 30);

            if (sortedCandidates.length === 0) {
                throw new Error("No highly-tradeable flips found matching your criteria. Try a different strategy, a higher budget, or check back when market conditions change.");
            }
            
            setStatusMessage('Fetching historical data for candidates...');
            setProgress(40);
            const timeseriesResponses = await Promise.allSettled(
                sortedCandidates.map(c => fetchTimeseries(c.id, '6h'))
            );
             const candidatesWithHistory = sortedCandidates.map((candidate, index) => {
                const result = timeseriesResponses[index];
                if (result.status === 'fulfilled' && result.value.length > 1) {
                    const prices = result.value.map(d => d.avgHighPrice).filter((p): p is number => p !== null);
                    const trend = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
                    return { ...candidate, trend7d: isFinite(trend) ? trend.toFixed(2) : '0.00' };
                }
                return { ...candidate, trend7d: '0.00' };
            });

            setStatusMessage('Performing primary AI analysis...');
            setProgress(60);
            // FIX: Adhere to Gemini API guidelines by exclusively using `process.env.API_KEY` for the API key.
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const responseSchema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        itemId: { type: Type.NUMBER }, itemName: { type: Type.STRING },
                        buyPrice: { type: Type.NUMBER }, sellPrice: { type: Type.NUMBER },
                        netMarginPerItem: { type: Type.NUMBER }, potentialProfit: { type: Type.NUMBER },
                        justification: { type: Type.STRING },
                        confidenceScore: { type: Type.NUMBER, description: "A numerical score from 0 to 100." },
                        riskLevel: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                        riskJustification: { type: Type.STRING, description: "A single sentence explaining the risk level." },
                        flipVelocity: { type: Type.STRING, enum: ['Very High', 'High', 'Medium', 'Low'] },
                    },
                    required: ["itemId", "itemName", "buyPrice", "sellPrice", "netMarginPerItem", "potentialProfit", "justification", "confidenceScore", "riskLevel", "riskJustification", "flipVelocity"],
                },
            };

            const strategyDefinition = {
                balanced: "Prioritize items with 'Good' or 'Excellent' tradability for consistent, reliable profits. A high flipVelocityScore is critical.",
                high_margin: "Prioritize items with the highest potential percentage margin. Acknowledge that this may mean lower flip velocity.",
                dip_buys: "Identify popular items that have recently dropped in price (negative trend7d), making them prime for a rebound. Good velocity is still important.",
                momentum_plays: "Identify items showing strong recent growth (positive trend7d) that are likely to continue rising. High velocity is key here."
            };

            const prompt = `You are an expert market analyst for the video game Old School RuneScape, specializing in the Grand Exchange. Your goal is to identify the top 5 most profitable and liquid items to 'flip' based on my constraints.

            My Constraints:
            - Budget: ${parsedBudget.toLocaleString()} gp.
            - Strategy: ${strategy}. ${strategyDefinition[strategy]}

            Key Data Points Explained:
            -   **netMarginPercentage**: CRITICAL. This is the Return on Investment (ROI) for flipping one item. A value above 0.5% is decent, and above 2% is excellent. This should be a primary factor in your decision-making.
            -   **flipVelocityScore**: CRITICAL. Measures how many times the item's buy limit turns over per day. Higher is better. A score over 50 is good, over 200 is excellent.
            -   **tradabilityTier**: CRITICAL. A summary of liquidity. 'Excellent' or 'Good' is required for safe flips.
            -   **liquidityRatio**: Ratio of sell volume to buy volume. A value close to 1.0 is ideal.

            Your Task:
            1.  Review the data, prioritizing items aligned with my strategy. YOU MUST prioritize items with a high 'netMarginPercentage' (ROI) over those with low margins, even if the total 'potentialProfit' is high. A 40k profit on a 25m investment (0.16% ROI) is a BAD suggestion. A 20k profit on a 1m investment (2% ROI) is a GOOD suggestion.
            2.  For each of the top 5:
                a.  **riskLevel**: Determine a 'riskLevel' (Low, Medium, High) based on tradabilityTier, price volatility (priceChange fields), and liquidityRatio. Low tradabilityTier MUST result in a High riskLevel.
                b.  **riskJustification**: Write a single sentence explaining the riskLevel. E.g., "Low risk due to excellent trade volume and stable price trends."
                c.  **confidenceScore**: Provide a numerical score from 0 to 100 representing your confidence in this flip's success for the chosen strategy. High confidence requires Excellent/Good tradability and price patterns supporting the strategy.
                d.  **flipVelocity**: Rate this from 'Very High' to 'Low' based *only* on the 'flipVelocityScore'. >200 is Very High, >50 is High, >10 is Medium, else Low.
                e.  **justification**: Write a concise 'justification' (2-3 sentences) explaining *why* it's a good flip. You MUST reference key data points like ROI and velocity.
            3.  Return a JSON array of the top 5 suggestions, ranked from best to worst. Use the pre-calculated 'potentialProfit' and other values directly.

            DATA: ${JSON.stringify(candidatesWithHistory)}`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                config: {
                    responseMimeType: "application/json",
                    responseSchema,
                },
                contents: prompt,
            });
            
            let parsedSuggestions = JSON.parse(response.text.trim()) as FlippingSuggestion[];

            if (parsedSuggestions.length > 0) {
                 setStatusMessage('Enhancing top result with Google Search...');
                 setProgress(80);
                 const topSuggestion = parsedSuggestions[0];
                 const groundingPrompt = `In Old School RuneScape, what recent news, updates, or community trends might affect the price of a '${topSuggestion.itemName}'? Summarize relevant information concisely.`;
                 
                 const groundingResponse = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: groundingPrompt,
                    config: { tools: [{googleSearch: {}}] },
                 });

                 const webInsight = groundingResponse.text;
                 const sources = groundingResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
                 
                 if (webInsight && webInsight.length > 10 && !webInsight.toLowerCase().includes("i am not able")) {
                     topSuggestion.justification += `\n\n**Web Insight:** ${webInsight}`;
                 }
                 if (sources && sources.length > 0) {
                     topSuggestion.webSources = sources;
                 }
                 parsedSuggestions[0] = topSuggestion;
            }

            setStatusMessage('Finalizing suggestions...');
            setProgress(90);
            setSuggestions(parsedSuggestions);
            
            const newHistoryEntry: HistoricAnalysis = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                suggestions: parsedSuggestions,
                params: { budget, strategy, ignoreLowLimits },
            };
            setHistory(prev => [newHistoryEntry, ...prev.slice(0, 4)]);

            setProgress(100);
        } catch (err: any) {
            console.error("AI Analysis Error:", err);
            setAiError(err.message || "An unexpected error occurred while analyzing the market. The model may have returned an invalid response.");
        } finally {
            setTimeout(() => setIsAnalyzing(false), 500);
        }
    };

    if (isDataLoading) return <div className="flex justify-center items-center h-full pt-20"><Loader /></div>;
    if (dataError) return <div className="text-center text-red-400 mt-8">{dataError}</div>;

    const hasResults = suggestions.length > 0;

    if (selectedHistoryItem) {
        return (
            <div className="max-w-6xl mx-auto pt-6 md:pt-8">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                    <div>
                         <h2 className="text-2xl font-bold text-white">Viewing Past Analysis</h2>
                         <p className="text-gray-400 text-sm">Run on {new Date(selectedHistoryItem.date).toLocaleString()}</p>
                    </div>
                    <Button onClick={() => setSelectedHistoryItem(null)} variant="secondary">
                        <BotIcon className="w-5 h-5 mr-2" />
                        Back to Assistant
                    </Button>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm p-4 rounded-lg mb-8 flex items-start gap-3">
                    <InfoIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-bold">Outdated Data Warning</p>
                        <p>This analysis is from the past. Market prices and trends have likely changed. For the best results, please run a new analysis.</p>
                    </div>
                </div>
                <Card className="mb-8 bg-gray-800/40">
                    <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm text-gray-300">
                        <span>Analysis based on:</span>
                        <span className="font-semibold">Budget: <span className="text-white">{selectedHistoryItem.params.budget.toUpperCase()}</span></span>
                        <span className="font-semibold">Strategy: <span className="text-white capitalize">{selectedHistoryItem.params.strategy.replace('_', ' ')}</span></span>
                        <span className="font-semibold">Low Limits Ignored: <span className="text-white">{selectedHistoryItem.params.ignoreLowLimits ? 'Yes' : 'No'}</span></span>
                    </div>
                </Card>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {selectedHistoryItem.suggestions.map(s => (
                        <SuggestionCard 
                            key={s.itemId} 
                            suggestion={s}
                            onSelect={() => onSelectItem(items[s.itemId])}
                            allItems={items}
                        />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto pt-6 md:pt-8">
            <div className="text-center mb-8">
                <BotIcon className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                <h1 className="text-4xl font-bold text-white">AI Flipping Assistant</h1>
                 {profile && (
                    <div className="mt-2 text-sm font-semibold text-gray-400 bg-gray-800/60 rounded-full px-4 py-1.5 inline-flex items-center gap-1.5 border border-gray-700/50">
                        Tokens Remaining: <span className="text-emerald-300 font-bold text-base">{profile.tokens}</span>
                    </div>
                )}
                <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
                    Let Gemini-Pro analyze real-time market data to find highly liquid, profitable flips tailored to your budget and strategy.
                </p>
            </div>
            
            {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center text-center h-96">
                    <div className="max-w-lg w-full">
                        <Loader size="lg" className="mx-auto" />
                        <p className="text-lg text-white font-semibold mt-6">{statusMessage || 'Initializing...'}</p>
                        <div className="mt-4"><ProgressBar progress={progress} /></div>
                        <p className="text-gray-400 text-sm mt-3">This may take a moment. The AI is sifting through thousands of items for the best margins and liquidity.</p>
                    </div>
                </div>
            ) : hasResults ? (
                <div>
                    {analysisParams && (
                         <Card className="mb-8 bg-gray-800/40">
                            <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm text-gray-300">
                                <span>Analysis based on:</span>
                                <span className="font-semibold">Budget: <span className="text-white">{analysisParams.budget.toUpperCase()}</span></span>
                                <span className="font-semibold">Strategy: <span className="text-white capitalize">{analysisParams.strategy.replace('_', ' ')}</span></span>
                                <span className="font-semibold">Low Limits Ignored: <span className="text-white">{analysisParams.ignoreLowLimits ? 'Yes' : 'No'}</span></span>
                            </div>
                        </Card>
                    )}

                    {suggestions.length > 0 && (
                        <div>
                            <div className="flex items-center gap-3 justify-center mb-4">
                                <BotIcon className="w-6 h-6 text-gray-400"/>
                                <h2 className="text-2xl font-bold text-white text-center">Top Flipping Suggestions</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {suggestions.map(s => (
                                    <SuggestionCard 
                                        key={s.itemId} 
                                        suggestion={s}
                                        onSelect={() => onSelectItem(items[s.itemId])}
                                        allItems={items}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    
                     <div className="text-center mt-12">
                        <Button variant="secondary" size="lg" onClick={() => { setSuggestions([]); setAiError(null); }}>
                            <BotIcon className="w-5 h-5 mr-2" />
                            Run New Analysis
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    <Card className="max-w-2xl mx-auto p-6">
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="budget" className="block text-sm font-medium text-gray-300 mb-1">Flipping Budget</label>
                                <div className="relative">
                                    <DollarSignIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input id="budget" type="text" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g., 25m" className="w-full p-3 pl-10 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Flipping Strategy</label>
                                 <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <Button title="Consistent, lower-risk profits from high-volume items." type="button" variant={strategy === 'balanced' ? 'secondary' : 'ghost'} onClick={() => setStrategy('balanced')} className="w-full border border-transparent !py-3" style={strategy === 'balanced' ? {borderColor: '#4b5563'} : {}}>Balanced</Button>
                                    <Button title="Higher-risk, higher-reward plays focusing on the best percentage margins." type="button" variant={strategy === 'high_margin' ? 'secondary' : 'ghost'} onClick={() => setStrategy('high_margin')} className="w-full border border-transparent !py-3" style={strategy === 'high_margin' ? {borderColor: '#4b5563'} : {}}>High Margin</Button>
                                    <Button title="Find popular items that have recently dropped in price." type="button" variant={strategy === 'dip_buys' ? 'secondary' : 'ghost'} onClick={() => setStrategy('dip_buys')} className="w-full border border-transparent !py-3" style={strategy === 'dip_buys' ? {borderColor: '#4b5563'} : {}}>Dip Buys</Button>
                                    <Button title="Find items with strong recent growth in price and volume." type="button" variant={strategy === 'momentum_plays' ? 'secondary' : 'ghost'} onClick={() => setStrategy('momentum_plays')} className="w-full border border-transparent !py-3" style={strategy === 'momentum_plays' ? {borderColor: '#4b5563'} : {}}>Momentum</Button>
                                </div>
                            </div>
                             <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                                <div className="flex items-center gap-2">
                                    <label htmlFor="limit-toggle" className="text-sm font-medium text-gray-300 cursor-pointer select-none">
                                        Ignore Low Buy Limits
                                    </label>
                                    <div className="relative group">
                                        <InfoIcon className="w-4 h-4 text-gray-500"/>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-gray-900 text-white text-xs rounded-lg py-1.5 px-2.5 shadow-lg border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                            Excludes items with a buy limit under {LOW_LIMIT_THRESHOLD.toLocaleString()}.
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 transform rotate-45 border-b border-r border-gray-700"></div>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    id="limit-toggle"
                                    role="switch"
                                    aria-checked={ignoreLowLimits}
                                    onClick={() => setIgnoreLowLimits(p => !p)}
                                    className={`${
                                    ignoreLowLimits ? 'bg-emerald-600' : 'bg-gray-600'
                                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900`}
                                >
                                    <span
                                    aria-hidden="true"
                                    className={`${
                                        ignoreLowLimits ? 'translate-x-5' : 'translate-x-0'
                                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-300 transition-bounce`}
                                    />
                                </button>
                            </div>
                        </div>
                         <div className="text-center mt-6">
                            <Button variant="primary" size="lg" onClick={handleAnalyze} disabled={isAnalyzing || !profile || profile.tokens <= 0} className="w-full">
                                {`Analyze Market (${profile && profile.tokens > 0 ? '1 Token' : '0 Tokens'})`}
                            </Button>
                            {aiError && <p className="text-red-400 mt-4 text-sm bg-red-500/10 p-2 rounded-md">{aiError}</p>}
                        </div>
                    </Card>

                    {profile && profile.tokens <= 2 && (
                        <TokenPurchaseSection />
                    )}
                </>
            )}

            {!isAnalyzing && history.length > 0 && (
                <div className="max-w-3xl mx-auto mt-12">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">Recent Analyses</h2>
                        <Button variant="ghost" size="sm" className="text-xs text-gray-400 hover:text-white" onClick={() => setHistory([])}>
                            Clear History
                        </Button>
                    </div>
                    <div className="space-y-3">
                        {history.map(hist => (
                            <Card key={hist.id} isHoverable onClick={() => setSelectedHistoryItem(hist)} className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-white">Budget: {hist.params.budget.toUpperCase()} | Strategy: <span className="capitalize">{hist.params.strategy.replace('_', ' ')}</span></p>
                                        <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
                                            <ClockIcon className="w-3 h-3" />
                                            {new Date(hist.date).toLocaleString()}
                                        </p>
                                    </div>
                                    <ChevronRightIcon className="w-5 h-5 text-gray-500" />
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
