import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Investment, Item, LatestPrice, Profile } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { BriefcaseIcon, Trash2Icon, EditIcon, RefreshCwIcon, Share2Icon, CheckIcon } from './icons/Icons';
import { getHighResImageUrl, createIconDataUrl, formatLargeNumber } from '../utils/image';
import { SellInvestmentModal } from './SellInvestmentModal';
import { EditInvestmentModal } from './EditInvestmentModal';
import { Loader } from './ui/Loader';
import { PortfolioChart } from './PortfolioChart';
import { createPost } from '../services/database';

interface PortfolioPageProps {
  investments: Investment[];
  items: Record<string, Item>;
  latestPrices: Record<string, LatestPrice>;
  onCloseInvestment: (investmentId: string, sales: Array<{ quantity: number; sell_price: number; sell_date: string; tax_paid: number }>) => Promise<void>;
  onClearPortfolio: () => Promise<void>;
  onDeleteInvestment: (investmentId: string) => Promise<void>;
  onEditInvestment: (investmentId: string, updates: Partial<Pick<Investment, 'quantity' | 'purchase_price' | 'purchase_date'>>) => Promise<void>;
  onRefreshPrices: () => Promise<void>;
  onSelectItem: (item: Item) => void;
  profile: (Profile & { email: string | null; }) | null;
  session: Session | null;
}

type TimeRange = '1M' | '3M' | '1Y' | 'ALL';

type NumberFormat = 'raw' | 'short';

const useNumberTicker = (value: number) => {
    const [displayValue, setDisplayValue] = useState(value);
    const prevValueRef = useRef(value);

    useEffect(() => {
        const startValue = prevValueRef.current;
        const endValue = value;
        prevValueRef.current = value;

        if (startValue === endValue) {
            // Ensure displayValue is up to date if the value hasn't changed but a re-render occurred
            if (displayValue !== endValue) setDisplayValue(endValue);
            return;
        }

        let startTime: number;
        const duration = 750; // ms

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min(timestamp - startTime, duration);
            const percentage = progress / duration;
            // Ease-out cubic function for a smooth slowdown
            const easedPercentage = 1 - Math.pow(1 - percentage, 3);

            const animatedValue = startValue + (endValue - startValue) * easedPercentage;
            setDisplayValue(animatedValue);

            if (progress < duration) {
                requestAnimationFrame(animate);
            } else {
                setDisplayValue(endValue); // Ensure it ends on the exact value
            }
        };
        requestAnimationFrame(animate);
    }, [value, displayValue]);

    return displayValue;
};


const TooltipSpan: React.FC<{ children: React.ReactNode; fullValue: string }> = ({ children, fullValue }) => (
    <span className="relative group cursor-help">
        {children}
        <span
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max
                      bg-gray-900 text-white text-xs font-semibold
                      rounded-md py-1.5 px-3 shadow-lg border border-gray-700/50
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200
                      pointer-events-none z-10"
            role="tooltip"
        >
            {fullValue} gp
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 transform rotate-45 border-b border-r border-gray-700/50"></div>
        </span>
    </span>
);


export const PortfolioPage: React.FC<PortfolioPageProps> = ({ investments, items, latestPrices, onCloseInvestment, onClearPortfolio, onDeleteInvestment, onEditInvestment, onRefreshPrices, onSelectItem, profile, session }) => {
    const [investmentToSell, setInvestmentToSell] = useState<Investment | null>(null);
    const [investmentToEdit, setInvestmentToEdit] = useState<Investment | null>(null);
    const [investmentToDelete, setInvestmentToDelete] = useState<Investment | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    
    // State for portfolio chart
    const [portfolioHistory, setPortfolioHistory] = useState<{ date: string; value: number }[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<TimeRange>('1M');

    // State for new features
    const [numberFormat, setNumberFormat] = useState<NumberFormat>('short');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // State for sharing flips
    const [sharingFlipId, setSharingFlipId] = useState<string | null>(null);
    const [sharedFlips, setSharedFlips] = useState<Set<string>>(new Set());
    const [shareNotification, setShareNotification] = useState<string | null>(null);


    const ProfitText: React.FC<{ value: number; format: NumberFormat }> = ({ value, format }) => {
        const animatedValue = useNumberTicker(value);
        const displayValue = Math.round(animatedValue);
        const colorClass = displayValue > 0 ? 'text-emerald-400' : displayValue < 0 ? 'text-red-400' : 'text-gray-400';
        const sign = displayValue > 0 ? '+' : '';
        const formattedValue = format === 'raw' ? displayValue.toLocaleString() : formatLargeNumber(displayValue);
        const displayString = `${sign}${formattedValue} gp`;

        const finalFullValue = `${value > 0 ? '+' : ''}${value.toLocaleString()}`;

        if (format === 'short') {
            return (
                <TooltipSpan fullValue={finalFullValue}>
                    <span className={colorClass}>{displayString}</span>
                </TooltipSpan>
            );
        }
        return <span className={colorClass}>{displayString}</span>;
    };
    
    const FormattedGP: React.FC<{ value: number; format: NumberFormat; className?: string }> = ({ value, format, className = '' }) => {
        const animatedValue = useNumberTicker(value);
        const displayValue = Math.round(animatedValue);
        const displayString = (format === 'raw' ? displayValue.toLocaleString() : formatLargeNumber(displayValue)) + ' gp';
        
        const finalFullValue = value.toLocaleString();

        if (format === 'short') {
            return (
                <TooltipSpan fullValue={finalFullValue}>
                    <span className={className}>{displayString}</span>
                </TooltipSpan>
            );
        }
        return <span className={className}>{displayString}</span>;
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onRefreshPrices();
        setIsRefreshing(false);
    };

    useEffect(() => {
        const calculateHistory = () => {
            const closedPositionsForHistory = investments
                .filter(inv => inv.sell_price !== null && inv.sell_date !== null)
                .map(inv => ({
                    ...inv,
                    sell_date_obj: new Date(inv.sell_date!),
                    profit: ((inv.sell_price! - inv.purchase_price) * inv.quantity) - (inv.tax_paid ?? 0)
                }))
                .sort((a, b) => a.sell_date_obj.getTime() - b.sell_date_obj.getTime());

            if (closedPositionsForHistory.length === 0) {
                setPortfolioHistory([]);
                setIsHistoryLoading(false);
                return;
            }

            setIsHistoryLoading(true);

            const getStartDate = (): Date => {
                const now = new Date();
                switch (timeRange) {
                    case '1M': return new Date(now.setMonth(now.getMonth() - 1));
                    case '3M': return new Date(now.setMonth(now.getMonth() - 3));
                    case '1Y': return new Date(now.setFullYear(now.getFullYear() - 1));
                    case 'ALL': return closedPositionsForHistory[0].sell_date_obj;
                }
            };

            const startDate = getStartDate();
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date();
            const dateArray: Date[] = [];
            let currentDate = new Date(startDate);
            
            while (currentDate.getTime() <= endDate.getTime()) {
                dateArray.push(new Date(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }

            let cumulativeProfit = 0;
            let tradeIndex = 0;
            
            // Calculate profit accumulated *before* the current chart's start date
            const initialProfit = closedPositionsForHistory
                .filter(trade => trade.sell_date_obj.getTime() < startDate.getTime())
                .reduce((sum, trade) => sum + trade.profit, 0);
            
            cumulativeProfit = initialProfit;

            // Find the first trade that is within our date range
            while (tradeIndex < closedPositionsForHistory.length && closedPositionsForHistory[tradeIndex].sell_date_obj.getTime() < startDate.getTime()) {
                tradeIndex++;
            }

            const history = dateArray.map(date => {
                const dateTimestamp = date.getTime();
                while (tradeIndex < closedPositionsForHistory.length && closedPositionsForHistory[tradeIndex].sell_date_obj.getTime() <= dateTimestamp) {
                    cumulativeProfit += closedPositionsForHistory[tradeIndex].profit;
                    tradeIndex++;
                }
                return { date: date.toISOString().split('T')[0], value: cumulativeProfit };
            });

            setPortfolioHistory(history);
            setIsHistoryLoading(false);
        };

        calculateHistory();
    }, [investments, timeRange]);

    const handleConfirmClear = async () => {
        setIsClearing(true);
        try {
            await onClearPortfolio();
        } catch (error) {
            console.error("Failed to clear portfolio", error);
        } finally {
            setIsClearing(false);
            setIsClearConfirmOpen(false);
        }
    };
    
    const handleConfirmDelete = async () => {
        if (!investmentToDelete) return;
        setIsDeleting(true);
        setDeleteError(null);
        try {
            await onDeleteInvestment(investmentToDelete.id);
            setInvestmentToDelete(null); // Close modal on success
        } catch (error: any) {
            console.error("Failed to delete investment", error);
            setDeleteError(error.message || 'An unknown error occurred. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };


    const { openPositions, closedPositions } = useMemo(() => {
        return investments.reduce((acc: { openPositions: Investment[], closedPositions: Investment[] }, inv: Investment) => {
            if (inv.sell_price === null) {
                acc.openPositions.push(inv);
            } else {
                acc.closedPositions.push(inv);
            }
            return acc;
        }, { openPositions: [], closedPositions: [] });
    }, [investments]);
    
    const summaryStats = useMemo(() => {
        let totalValue = 0;
        let unrealisedProfit = 0;
        let realisedProfit = 0;
        let totalTaxPaid = 0;

        openPositions.forEach(inv => {
            const currentSellPrice = latestPrices[inv.item_id]?.low;
    
            // Use != to catch both null and undefined
            if (currentSellPrice != null) {
                const purchaseValue = inv.purchase_price * inv.quantity;
                const currentValue = currentSellPrice * inv.quantity;
                totalValue += currentValue;
                unrealisedProfit += (currentValue - purchaseValue);
            } else {
                // If the current price is unknown, value the asset at its purchase price.
                // This results in 0 P/L for this item, which is a more neutral
                // assumption than assuming it's worthless (price of 0).
                totalValue += inv.purchase_price * inv.quantity;
            }
        });

        closedPositions.forEach(inv => {
            if(inv.sell_price !== null) {
                const purchaseValue = inv.purchase_price * inv.quantity;
                const sellValue = inv.sell_price * inv.quantity;
                realisedProfit += (sellValue - purchaseValue);
                totalTaxPaid += inv.tax_paid ?? 0;
            }
        });

        return { totalValue, unrealisedProfit, realisedProfit, totalTaxPaid };
    }, [openPositions, closedPositions, latestPrices]);

    const handleShareFlip = async (inv: Investment) => {
        if (!session || !profile?.username) return;
        setSharingFlipId(inv.id);
        
        try {
            const item = items[inv.item_id];
            const purchaseValue = inv.purchase_price * inv.quantity;
            const sellValue = inv.sell_price! * inv.quantity;
            const profit = sellValue - purchaseValue - (inv.tax_paid ?? 0);
            const roi = purchaseValue > 0 ? (profit / purchaseValue) * 100 : 0;

            await createPost(session.user.id, {
                title: null,
                content: `Check out my latest flip on the ${item.name}!`,
                flip_data: {
                    item_id: item.id,
                    item_name: item.name,
                    quantity: inv.quantity,
                    purchase_price: inv.purchase_price,
                    sell_price: inv.sell_price!,
                    profit: profit,
                    roi: roi,
                }
            });

            setSharedFlips(prev => new Set(prev).add(inv.id));
            setShareNotification("Successfully shared flip to the community feed!");

        } catch (error) {
            console.error("Failed to share flip", error);
            setShareNotification("Error: Could not share flip.");
        } finally {
            setSharingFlipId(null);
            setTimeout(() => setShareNotification(null), 3000);
        }
    };


    if (investments.length === 0) {
        return (
          <div className="text-center py-20 flex flex-col items-center">
            <BriefcaseIcon className="w-16 h-16 text-gray-600 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Your Portfolio is Empty</h2>
            <p className="text-gray-400">Find an item and use the briefcase icon to add your first investment.</p>
          </div>
        );
    }
    
    return (
        <div>
            {shareNotification && (
                <div className={`fixed top-5 right-5 ${shareNotification.includes("Error") ? 'bg-red-500' : 'bg-emerald-500'} text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in`}>
                    {shareNotification}
                </div>
            )}
            {investmentToSell && items[investmentToSell.item_id] && (
                <SellInvestmentModal
                    investment={investmentToSell}
                    item={items[investmentToSell.item_id]}
                    latestPrice={latestPrices[investmentToSell.item_id]}
                    onClose={() => setInvestmentToSell(null)}
                    onSave={onCloseInvestment}
                />
            )}
            {investmentToEdit && items[investmentToEdit.item_id] && (
                <EditInvestmentModal
                    investment={investmentToEdit}
                    item={items[investmentToEdit.item_id]}
                    onClose={() => setInvestmentToEdit(null)}
                    onSave={onEditInvestment}
                />
            )}
            {investmentToDelete && items[investmentToDelete.item_id] && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-50 flex justify-center items-center p-4">
                    <Card className="max-w-md w-full">
                        <h3 className="text-xl font-bold text-white mb-2">Delete Investment</h3>
                        {deleteError && (
                            <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-sm p-3 rounded-md my-4" role="alert">
                                {deleteError}
                            </div>
                        )}
                        <p className="text-gray-300 mb-6">
                            Are you sure you want to delete the investment for{' '}
                            <span className="font-semibold text-white">{investmentToDelete.quantity.toLocaleString()}x {items[investmentToDelete.item_id].name}</span>?
                            This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-4">
                            <Button variant="secondary" onClick={() => setInvestmentToDelete(null)} disabled={isDeleting}>
                                Cancel
                            </Button>
                            <Button
                                className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? <Loader size="sm" /> : 'Confirm & Delete'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
            {isClearConfirmOpen && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-50 flex justify-center items-center p-4">
                    <Card className="max-w-md w-full border-red-500/50">
                        <h3 className="text-xl font-bold text-white mb-2">Confirm Clear Portfolio</h3>
                        <p className="text-gray-300 mb-6">Are you sure? This will permanently delete all open and closed positions. This action cannot be undone.</p>
                        <div className="flex justify-end gap-4">
                            <Button variant="secondary" onClick={() => setIsClearConfirmOpen(false)} disabled={isClearing}>
                                Cancel
                            </Button>
                            <Button
                                className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                                onClick={handleConfirmClear}
                                disabled={isClearing}
                            >
                                {isClearing ? <Loader size="sm" /> : 'Confirm & Delete'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-3xl font-bold text-white">Your Portfolio</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 self-end sm:self-center">
                    <div className="flex items-center gap-2 bg-gray-800/60 p-1 rounded-lg">
                        <label htmlFor="format-toggle" className="text-sm text-gray-300 cursor-pointer select-none pl-2">
                            Abbreviate GP
                        </label>
                        <button
                            id="format-toggle"
                            role="switch"
                            aria-checked={numberFormat === 'short'}
                            onClick={() => setNumberFormat(p => p === 'raw' ? 'short' : 'raw')}
                            className={`${
                            numberFormat === 'short' ? 'bg-emerald-600' : 'bg-gray-600'
                            } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900`}
                        >
                            <span
                            aria-hidden="true"
                            className={`${
                                numberFormat === 'short' ? 'translate-x-5' : 'translate-x-0'
                            } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-300 transition-bounce`}
                            />
                        </button>
                    </div>
                    <Button onClick={handleRefresh} disabled={isRefreshing} variant="secondary" size="sm" className="px-3 py-2">
                        {isRefreshing ? <Loader size="sm" className="mr-2 animate-spin" /> : <RefreshCwIcon className="w-4 h-4 mr-2" />}
                        <span>Refresh</span>
                    </Button>
                    {investments.length > 0 && (
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-400 px-3 py-2" onClick={() => setIsClearConfirmOpen(true)}>
                            <Trash2Icon className="w-4 h-4 mr-2" />
                            Clear All
                        </Button>
                    )}
                </div>
            </div>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Card>
                    <p className="text-sm text-gray-400">Portfolio Value</p>
                    <p className="text-2xl font-bold text-white"><FormattedGP value={summaryStats.totalValue} format={numberFormat} /></p>
                </Card>
                <Card>
                    <p className="text-sm text-gray-400">Unrealised P/L</p>
                    <p className="text-2xl font-bold"><ProfitText value={summaryStats.unrealisedProfit} format={numberFormat} /></p>
                </Card>
                <Card>
                    <p className="text-sm text-gray-400">Realised Profit</p>
                    <p className="text-2xl font-bold"><ProfitText value={summaryStats.realisedProfit - summaryStats.totalTaxPaid} format={numberFormat} /></p>
                </Card>
                <Card>
                    <p className="text-sm text-gray-400">Total Tax Paid</p>
                    <p className="text-2xl font-bold text-red-400">-<FormattedGP value={summaryStats.totalTaxPaid} format={numberFormat} /></p>
                </Card>
            </div>

             {/* Portfolio Performance Chart */}
            <div className="mb-8">
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white">Cumulative Realised P/L</h3>
                        <div className="flex items-center gap-1 bg-gray-900/50 p-1 rounded-lg">
                            {(['1M', '3M', '1Y', 'ALL'] as TimeRange[]).map(range => (
                                <Button
                                    key={range}
                                    size="sm"
                                    variant={timeRange === range ? 'secondary' : 'ghost'}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-3 py-1 ${timeRange !== range ? 'text-gray-400 hover:text-white' : 'shadow-md'}`}
                                >
                                    {range}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div className="h-80">
                        {isHistoryLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader />
                            </div>
                        ) : (
                            <PortfolioChart data={portfolioHistory} />
                        )}
                    </div>
                </Card>
            </div>

            {/* Open Positions */}
            <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-4">Open Positions ({openPositions.length})</h3>
                {openPositions.length > 0 ? (
                    <div className="space-y-4">
                        {openPositions.map(inv => {
                            const item = items[inv.item_id];
                            if (!item) return null;
                            
                            const currentPrice = latestPrices[item.id]?.low;
                            const hasPrice = currentPrice != null;
                            const purchaseValue = inv.purchase_price * inv.quantity;
                            const currentValue = hasPrice ? currentPrice * inv.quantity : purchaseValue;
                            const profit = currentValue - purchaseValue;

                            return (
                                <Card key={inv.id} className="flex items-center flex-wrap gap-4">
                                    <img src={getHighResImageUrl(item.name)} onError={(e) => { e.currentTarget.src = createIconDataUrl(item.icon); }} alt={item.name} className="w-10 h-10 object-contain bg-gray-700/50 rounded-md"/>
                                    <div className="flex-1 min-w-[150px]">
                                        <button onClick={() => onSelectItem(item)} className="font-bold text-white text-left hover:underline hover:text-emerald-300 transition-colors">
                                            {item.name}
                                        </button>
                                        <p className="text-sm text-gray-400">{inv.quantity.toLocaleString()} @ <FormattedGP value={inv.purchase_price} format={numberFormat} /></p>
                                    </div>
                                    <div className="text-sm">
                                        <p className="text-gray-400">Current Value</p>
                                        <p className="font-semibold"><FormattedGP value={currentValue} format={numberFormat} /></p>
                                    </div>
                                    <div className="text-sm">
                                        <p className="text-gray-400">Unrealised P/L</p>
                                        <p className="font-semibold"><ProfitText value={profit} format={numberFormat} /></p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => setInvestmentToSell(inv)}>Sell</Button>
                                        <Button size="icon" variant="ghost" className="w-8 h-8 text-gray-500 hover:text-emerald-400" onClick={() => setInvestmentToEdit(inv)}>
                                            <EditIcon className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="w-8 h-8 text-gray-500 hover:text-red-400" onClick={() => { setInvestmentToDelete(inv); setDeleteError(null); }}>
                                            <Trash2Icon className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                ) : <p className="text-gray-500">No open positions.</p>}
            </div>

            {/* Trade History */}
            <div>
                <h3 className="text-2xl font-bold text-white mb-4">Trade History ({closedPositions.length})</h3>
                 {closedPositions.length > 0 ? (
                    <div className="space-y-4">
                        {closedPositions.map(inv => {
                            const item = items[inv.item_id];
                            if (!item || inv.sell_price === null) return null;
                            const profit = ((inv.sell_price - inv.purchase_price) * inv.quantity) - (inv.tax_paid ?? 0);
                            return (
                                <Card key={inv.id} className="flex items-center flex-wrap gap-4 opacity-70">
                                    <img src={getHighResImageUrl(item.name)} onError={(e) => { e.currentTarget.src = createIconDataUrl(item.icon); }} alt={item.name} className="w-10 h-10 object-contain bg-gray-700/50 rounded-md"/>
                                    <div className="flex-1 min-w-[150px]">
                                        <button onClick={() => onSelectItem(item)} className="font-bold text-white text-left hover:underline hover:text-emerald-300 transition-colors">
                                            {item.name}
                                        </button>
                                        <p className="text-sm text-gray-400">{inv.quantity.toLocaleString()} units</p>
                                    </div>
                                    <div className="text-sm">
                                        <p className="text-gray-400">Buy: <FormattedGP value={inv.purchase_price} format={numberFormat} /></p>
                                        <p className="text-gray-400">Sell: <FormattedGP value={inv.sell_price} format={numberFormat} /></p>
                                    </div>
                                    <div className="flex-grow flex items-center justify-between gap-2">
                                        <div className="text-sm">
                                            <p className="text-gray-400">Realised P/L</p>
                                            <p className="font-semibold"><ProfitText value={profit} format={numberFormat} /></p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="w-8 h-8 text-gray-500 hover:text-emerald-400"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleShareFlip(inv);
                                                }}
                                                disabled={sharedFlips.has(inv.id) || sharingFlipId === inv.id}
                                                title="Share this flip to the community feed"
                                            >
                                                {sharingFlipId === inv.id ? (
                                                    <Loader size="sm" />
                                                ) : sharedFlips.has(inv.id) ? (
                                                    <CheckIcon className="w-4 h-4 text-emerald-400" />
                                                ) : (
                                                    <Share2Icon className="w-4 h-4" />
                                                )}
                                            </Button>
                                            <Button size="icon" variant="ghost" className="w-8 h-8 text-gray-500 hover:text-red-400" onClick={() => { setInvestmentToDelete(inv); setDeleteError(null); }}>
                                                <Trash2Icon className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                ) : <p className="text-gray-500">No completed trades yet.</p>}
            </div>
        </div>
    );
};