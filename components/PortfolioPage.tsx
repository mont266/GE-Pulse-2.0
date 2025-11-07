
import React, { useState, useMemo, useEffect } from 'react';
import type { Investment, Item, LatestPrice, TimeseriesData } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { BriefcaseIcon, Trash2Icon, EditIcon, RefreshCwIcon } from './icons/Icons';
import { getHighResImageUrl, createIconDataUrl, formatLargeNumber } from '../utils/image';
import { SellInvestmentModal } from './SellInvestmentModal';
import { EditInvestmentModal } from './EditInvestmentModal';
import { Loader } from './ui/Loader';
import { fetchTimeseries } from '../services/osrsWikiApi';
import { PortfolioChart } from './PortfolioChart';


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
}

type TimeRange = '1M' | '3M' | '1Y' | 'ALL';

type NumberFormat = 'raw' | 'short';

export const PortfolioPage: React.FC<PortfolioPageProps> = ({ investments, items, latestPrices, onCloseInvestment, onClearPortfolio, onDeleteInvestment, onEditInvestment, onRefreshPrices, onSelectItem }) => {
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

    const ProfitText: React.FC<{ value: number, format: NumberFormat }> = ({ value, format }) => {
        const colorClass = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
        const sign = value > 0 ? '+' : '';
        
        const formattedValue = format === 'raw'
            ? value.toLocaleString()
            : formatLargeNumber(value);

        const displayValue = value > 0 ? `${sign}${formattedValue}` : formattedValue;

        return <span className={colorClass}>{displayValue} gp</span>;
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onRefreshPrices();
        setIsRefreshing(false);
    };

    useEffect(() => {
        const calculateHistory = async () => {
            const openPositionsForHistory = investments.filter((inv: Investment) => inv.sell_price === null);
            if (openPositionsForHistory.length === 0) {
                setPortfolioHistory([]);
                setIsHistoryLoading(false);
                return;
            }

            setIsHistoryLoading(true);

            const itemIds = [...new Set(openPositionsForHistory.map(inv => inv.item_id))];
            
            const timeseriesResponses = await Promise.allSettled(
                itemIds.map(id => fetchTimeseries(id, '6h'))
            );

            const priceDataMap = new Map<number, { timestamp: number; price: number }[]>();
            // Replaced `forEach` with a `for...of` loop to ensure correct type narrowing for `Promise.allSettled` results.
            for (const [index, result] of timeseriesResponses.entries()) {
                if (result.status === 'fulfilled') {
                    const itemId = itemIds[index];
                    const cleanedData = result.value
                        .map((d: TimeseriesData) => ({ timestamp: d.timestamp, price: d.avgHighPrice }))
                        .filter((d): d is { timestamp: number; price: number } => d.price !== null);
                    priceDataMap.set(itemId, cleanedData.sort((a,b) => a.timestamp - b.timestamp));
                }
            }

            const getStartDate = (): Date => {
                const now = new Date();
                switch (timeRange) {
                    case '1M': return new Date(now.setMonth(now.getMonth() - 1));
                    case '3M': return new Date(now.setMonth(now.getMonth() - 3));
                    case '1Y': return new Date(now.setFullYear(now.getFullYear() - 1));
                    case 'ALL': {
                        if (investments.length === 0) {
                            return new Date();
                        }
                        // FIX: Get numeric timestamps from dates to use with Math.min and filter out any invalid dates.
                        const purchaseTimestamps = investments
                            .map((inv: Investment) => new Date(inv.purchase_date).getTime());
                        const validTimestamps = purchaseTimestamps.filter(ts => !isNaN(ts));

                        // FIX: The spread operator on an array of numbers is safe here, removing a failing explicit cast.
                        // Fix for error on line 82
                        const firstPurchaseTimestamp = validTimestamps.length > 0 ? Math.min(...validTimestamps) : Date.now();
                        return new Date(firstPurchaseTimestamp);
                    }
                }
            };

            const startDate = getStartDate();
            startDate.setHours(0,0,0,0);
            const endDate = new Date();
            const dateArray: Date[] = [];
            let currentDate = new Date(startDate);
            // FIX: Use .getTime() to compare dates as numbers for reliable comparison.
            // FIX: Removed failing explicit cast to number.
            // Fix for error on line 93
            while (currentDate.getTime() <= endDate.getTime()) {
                dateArray.push(new Date(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }

            const history = dateArray.map(date => {
                const dateTimestamp = date.getTime();
                let dailyValue = 0;

                openPositionsForHistory.forEach(inv => {
                    const purchaseDate = new Date(inv.purchase_date);
                    purchaseDate.setHours(0,0,0,0);
                    
                    if (purchaseDate.getTime() <= dateTimestamp) {
                        const itemPriceHistory = priceDataMap.get(inv.item_id);
                        let priceOnDate = inv.purchase_price;

                        if (itemPriceHistory && itemPriceHistory.length > 0) {
                            const pricePoint = [...itemPriceHistory].reverse().find(p => p.timestamp * 1000 <= dateTimestamp);
                            if (pricePoint) {
                                priceOnDate = pricePoint.price;
                            }
                        }
                        dailyValue += inv.quantity * priceOnDate;
                    }
                });

                return { date: date.toISOString().split('T')[0], value: dailyValue };
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
                            } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
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
                    <p className="text-2xl font-bold text-white">{(numberFormat === 'raw' ? summaryStats.totalValue.toLocaleString() : formatLargeNumber(summaryStats.totalValue))} gp</p>
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
                    <p className="text-2xl font-bold text-red-400">-{(numberFormat === 'raw' ? summaryStats.totalTaxPaid.toLocaleString() : formatLargeNumber(summaryStats.totalTaxPaid))} gp</p>
                </Card>
            </div>

             {/* Portfolio Performance Chart */}
            <div className="mb-8">
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white">Portfolio Performance</h3>
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
                                        <p className="text-sm text-gray-400">{inv.quantity.toLocaleString()} @ {(numberFormat === 'raw' ? inv.purchase_price.toLocaleString() : formatLargeNumber(inv.purchase_price))} gp</p>
                                    </div>
                                    <div className="text-sm">
                                        <p className="text-gray-400">Current Value</p>
                                        <p className="font-semibold">{(numberFormat === 'raw' ? currentValue.toLocaleString() : formatLargeNumber(currentValue))} gp</p>
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
                                        <p className="text-gray-400">Buy: {(numberFormat === 'raw' ? inv.purchase_price.toLocaleString() : formatLargeNumber(inv.purchase_price))}</p>
                                        <p className="text-gray-400">Sell: {(numberFormat === 'raw' ? inv.sell_price.toLocaleString() : formatLargeNumber(inv.sell_price))}</p>
                                    </div>
                                    <div className="flex-grow flex items-center justify-between gap-4">
                                        <div className="text-sm">
                                            <p className="text-gray-400">Realised P/L</p>
                                            <p className="font-semibold"><ProfitText value={profit} format={numberFormat} /></p>
                                        </div>
                                        <Button size="icon" variant="ghost" className="w-8 h-8 text-gray-500 hover:text-red-400" onClick={() => { setInvestmentToDelete(inv); setDeleteError(null); }}>
                                            <Trash2Icon className="w-4 h-4" />
                                        </Button>
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
