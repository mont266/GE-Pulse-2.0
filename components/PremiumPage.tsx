import React, { useState, useRef, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ArrowLeftIcon, StarIcon, BotIcon, ZapIcon, CheckCircleIcon, ChevronDownIcon, BellIcon, BriefcaseIcon } from './icons/Icons';

interface PremiumPageProps {
  onBack: () => void;
}

const Benefit: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
    <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1 p-2 bg-emerald-500/10 rounded-full">
            {icon}
        </div>
        <div>
            <h3 className="font-bold text-white">{title}</h3>
            <p className="text-gray-400 text-sm">{description}</p>
        </div>
    </div>
);

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

const basePriceUSD = 1.99;

export const PremiumPage: React.FC<PremiumPageProps> = ({ onBack }) => {
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

    const calculatedPrice = (basePriceUSD * selectedCurrency.rate).toFixed(2);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Button onClick={onBack} variant="ghost" size="icon">
                    <ArrowLeftIcon className="w-6 h-6" />
                </Button>
                <div className="flex items-center gap-3">
                    <StarIcon className="w-8 h-8 text-yellow-400" />
                    <h1 className="text-3xl font-bold text-white">GE Pulse Premium</h1>
                </div>
            </div>

            <Card className="p-8 md:p-12 text-center border-yellow-500/30 bg-gray-800/80">
                <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                    Gain an Edge in the Market
                </h2>
                <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
                    Upgrade to Premium to unlock exclusive features, get more out of the AI Assistant, and support the development of GE Pulse.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mt-12">
                    <Benefit 
                        icon={<BotIcon className="w-6 h-6 text-emerald-400"/>}
                        title="+2 Daily AI Tokens"
                        description="Receive bonus AI Assistant tokens every day with your login streak, allowing for more market analyses and flipping suggestions."
                    />
                     <Benefit 
                        icon={<BellIcon className="w-6 h-6 text-emerald-400"/>}
                        title="Unlimited Price Alerts"
                        description="Set as many price alerts as you need to track every market opportunity. Free users are limited to 10 active alerts."
                    />
                     <Benefit 
                        icon={<BriefcaseIcon className="w-6 h-6 text-emerald-400"/>}
                        title="Multiple Watchlists (Coming Soon)"
                        description="Organize your investments with multiple, customizable watchlists. Free users are limited to a single list."
                    />
                    <Benefit 
                        icon={<StarIcon className="w-6 h-6 text-emerald-400"/>}
                        title="Exclusive Gold Profile Badge"
                        description="Show your support with a shiny gold star next to your username on your profile and on the community leaderboards."
                    />
                     <Benefit 
                        icon={<ZapIcon className="w-6 h-6 text-emerald-400"/>}
                        title="Support Future Development"
                        description="Your subscription directly funds the development of new features, tools, and improvements to GE Pulse."
                    />
                    <Benefit 
                        icon={<CheckCircleIcon className="w-6 h-6 text-emerald-400"/>}
                        title="More Features Coming Soon"
                        description="Get priority access to upcoming premium-only features like advanced analytics, custom dashboards, and more."
                    />
                </div>

                <div className="mt-12">
                    <div className="flex justify-center items-center gap-4">
                        <p className="text-5xl font-bold text-white">
                            {selectedCurrency.symbol}{calculatedPrice} 
                            <span className="text-lg font-medium text-gray-400">/ Month</span>
                        </p>
                        <div className="relative" ref={dropdownRef}>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setIsDropdownOpen(prev => !prev)}
                                className="flex items-center gap-2"
                                aria-haspopup="true"
                                aria-expanded={isDropdownOpen}
                            >
                                <span>{selectedCurrency.code}</span>
                                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </Button>
                            {isDropdownOpen && (
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-28 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 py-1">
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
                                            {currency.code}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <Button
                        size="lg"
                        className="mt-6 w-full max-w-xs mx-auto bg-gray-600 hover:bg-gray-600 cursor-not-allowed text-gray-300"
                        disabled
                    >
                        Coming Soon
                    </Button>
                    <p className="text-xs text-gray-500 mt-3">
                        The ability to purchase a subscription is not yet available.
                    </p>
                </div>
            </Card>
        </div>
    );
};