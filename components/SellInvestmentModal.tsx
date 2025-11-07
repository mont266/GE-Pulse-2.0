

import React, { useState, useMemo } from 'react';
import type { Item, LatestPrice, Investment } from '../types';
import { Button } from './ui/Button';
import { Loader } from './ui/Loader';
import { XIcon, InfoIcon, Trash2Icon } from './icons/Icons';
import { getHighResImageUrl, createIconDataUrl, parseShorthandPrice, calculateGeTax } from '../utils/image';

interface SellInvestmentModalProps {
  investment: Investment;
  item: Item;
  latestPrice: LatestPrice;
  onClose: () => void;
  onSave: (investmentId: string, sales: Array<{ quantity: number; sell_price: number; sell_date: string; tax_paid: number }>) => Promise<void>;
}

const ProfitText: React.FC<{ value: number }> = ({ value }) => {
    const colorClass = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
    const sign = value > 0 ? '+' : '';
    return <span className={`${colorClass} font-semibold`}>{sign}{value.toLocaleString()} gp</span>;
};

type SaleEntry = {
    id: number;
    quantity: string;
    price: string;
};

export const SellInvestmentModal: React.FC<SellInvestmentModalProps> = ({ investment, item, latestPrice, onClose, onSave }) => {
  const [saleEntries, setSaleEntries] = useState<SaleEntry[]>([{ id: Date.now(), quantity: investment.quantity.toString(), price: (latestPrice?.low ?? item.value).toString() }]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSaleEntry = () => {
    setSaleEntries(prev => [...prev, { id: Date.now(), quantity: '', price: '' }]);
  };

  const removeSaleEntry = (id: number) => {
    setSaleEntries(prev => prev.filter(entry => entry.id !== id));
  };

  const handleEntryChange = (id: number, field: 'quantity' | 'price', value: string) => {
    setSaleEntries(prev => prev.map(entry => entry.id === id ? { ...entry, [field]: value } : entry));
  };
  
  const parsedSales = useMemo(() => {
    return saleEntries.map(entry => ({
        id: entry.id,
        quantity: parseInt(entry.quantity, 10),
        price: parseShorthandPrice(entry.price)
    })).filter(s => !isNaN(s.quantity) && s.quantity > 0 && !isNaN(s.price) && s.price > 0);
  }, [saleEntries]);

  const { totalQuantitySold, totalSellValue, totalTax, totalProfit } = useMemo(() => {
    let quantity = 0;
    let value = 0;
    let tax = 0;
    let profit = 0;

    parsedSales.forEach(sale => {
        quantity += sale.quantity;
        value += sale.price * sale.quantity;
        const saleTax = calculateGeTax(item.name, sale.price, sale.quantity);
        tax += saleTax;
        profit += (sale.price * sale.quantity) - (investment.purchase_price * sale.quantity) - saleTax;
    });

    return { totalQuantitySold: quantity, totalSellValue: value, totalTax: tax, totalProfit: profit };
  }, [parsedSales, item.name, investment.purchase_price]);

  const isQuantityInvalid = totalQuantitySold > investment.quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (parsedSales.length !== saleEntries.length || parsedSales.length === 0) {
        setError('Please ensure all sale entries have a valid positive quantity and price.');
        setLoading(false);
        return;
    }

    if (isQuantityInvalid) {
        setError(`Total sale quantity cannot exceed the amount you own (${investment.quantity.toLocaleString()}).`);
        setLoading(false);
        return;
    }

    if (!date) {
        setError('Please select a valid date.');
        setLoading(false);
        return;
    }

    try {
      const salesPayload = parsedSales.map(s => ({
          quantity: s.quantity,
          sell_price: s.price,
          sell_date: new Date(date).toISOString(),
          tax_paid: calculateGeTax(item.name, s.price, s.quantity)
      }));
      await onSave(investment.id, salesPayload);
      onClose();
    } catch (err: any) {
      setError(err.error_description || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900 bg-opacity-80 z-40 flex justify-center items-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg relative border border-gray-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-gray-400 hover:text-white" onClick={onClose} aria-label="Close modal">
          <XIcon className="w-6 h-6" />
        </Button>

        <div className="flex items-center gap-4 mb-4">
            <img 
                src={getHighResImageUrl(item.name)} 
                onError={(e) => { e.currentTarget.src = createIconDataUrl(item.icon); }}
                alt={item.name} 
                className="w-12 h-12 object-contain bg-gray-700/50 rounded-md"
            />
            <div>
                <h2 className="text-xl font-bold text-white">Log Sale(s)</h2>
                <p className="text-gray-300">{item.name}</p>
            </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-sm p-3 rounded-md my-4" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="max-h-60 overflow-y-auto pr-2 space-y-3">
                {saleEntries.map((entry, index) => (
                    <div key={entry.id} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                            {index === 0 && <label className="block text-xs font-medium text-gray-400 mb-1">Quantity</label>}
                            <input
                                type="number"
                                placeholder="e.g. 100"
                                value={entry.quantity}
                                onChange={(e) => handleEntryChange(entry.id, 'quantity', e.target.value)}
                                required min="1" max={investment.quantity}
                                className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition text-sm"
                            />
                        </div>
                         <div className="col-span-5">
                            {index === 0 && <label className="block text-xs font-medium text-gray-400 mb-1">Sell Price (each)</label>}
                            <input
                                type="text"
                                placeholder="e.g., 120k"
                                value={entry.price}
                                onChange={(e) => handleEntryChange(entry.id, 'price', e.target.value)}
                                required
                                className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition text-sm"
                            />
                        </div>
                        <div className="col-span-2 flex items-end h-full">
                           <Button 
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 text-gray-500 hover:text-red-400 disabled:text-gray-600"
                                onClick={() => removeSaleEntry(entry.id)}
                                disabled={saleEntries.length <= 1}
                                aria-label="Remove sale entry"
                           >
                                <Trash2Icon className="w-4 h-4" />
                           </Button>
                        </div>
                    </div>
                ))}
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addSaleEntry} className="w-full">
                Add another sale
            </Button>
            <div>
                <label htmlFor="sell-date" className="block text-sm font-medium text-gray-300 mb-1">Sell Date (for all sales)</label>
                <input
                  id="sell-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                />
            </div>
            {parsedSales.length > 0 && (
                <div className="text-sm text-gray-300 mt-3 bg-gray-900/50 p-4 rounded-md space-y-2">
                    <div className={`flex justify-between items-center ${isQuantityInvalid ? 'text-red-400' : ''}`}>
                        <span className="font-bold">Total Quantity to Sell:</span>
                        <span className="font-semibold">{totalQuantitySold.toLocaleString()} / {investment.quantity.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400">Total Sell Value:</span>
                        <span className="font-semibold">{totalSellValue.toLocaleString()} gp</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400">GE Tax:</span>
                        <span className="font-semibold text-red-400">-{totalTax.toLocaleString()} gp</span>
                    </div>
                    <div className="flex justify-between items-center font-bold border-t border-gray-700/50 pt-2 mt-2">
                        <span>Total Estimated Profit:</span>
                        <ProfitText value={totalProfit} />
                    </div>
                </div>
            )}
            <Button type="submit" variant="primary" size="lg" className="w-full mt-2" disabled={loading}>
                {loading ? <Loader size="sm" /> : 'Confirm Sale(s)'}
            </Button>
        </form>
      </div>
    </div>
  );
};