import React, { useState, useMemo, useEffect } from 'react';
import type { Item, LatestPrice, PriceAlert } from '../types';
import { Button } from './ui/Button';
import { Loader } from './ui/Loader';
import { XIcon, BellIcon, Trash2Icon } from './icons/Icons';
import { getHighResImageUrl, createIconDataUrl, parseShorthandPrice } from '../utils/image';

interface AlertSettingsModalProps {
  item: Item;
  latestPrice: LatestPrice;
  existingAlert: PriceAlert | null;
  onClose: () => void;
  onSave: (alertData: PriceAlert) => void;
  onRemove: (itemId: number) => void;
}

export const AlertSettingsModal: React.FC<AlertSettingsModalProps> = ({ item, latestPrice, existingAlert, onClose, onSave, onRemove }) => {
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState<'above' | 'below'>('below');
  const [priceType, setPriceType] = useState<'high' | 'low'>('high');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingAlert) {
      setTargetPrice(existingAlert.targetPrice.toString());
      setCondition(existingAlert.condition);
      setPriceType(existingAlert.priceType ?? 'high'); // Default to high for old alerts
    } else {
      setTargetPrice((latestPrice?.high ?? item.value).toString());
      setCondition('below');
      setPriceType('high');
    }
  }, [existingAlert, latestPrice, item.value]);

  const parsedTargetPrice = useMemo(() => parseShorthandPrice(targetPrice), [targetPrice]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isNaN(parsedTargetPrice) || parsedTargetPrice <= 0) {
      setError('Please enter a valid positive price. Shorthand like "120k" or "3.5m" is supported.');
      return;
    }

    onSave({
      itemId: item.id,
      targetPrice: parsedTargetPrice,
      condition,
      priceType,
    });
  };

  const handleRemove = () => {
      onRemove(item.id);
  }

  return (
    <div
      className="fixed inset-0 bg-gray-900 bg-opacity-80 z-40 flex justify-center items-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md relative border border-gray-700/50"
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
                <h2 className="text-xl font-bold text-white">{existingAlert ? 'Edit' : 'Set'} Price Alert</h2>
                <p className="text-gray-300">{item.name}</p>
            </div>
        </div>
         <div className="text-sm text-center text-gray-400 bg-gray-900/50 py-2 rounded-md mb-4 flex justify-around">
            <span>
                High: <span className="font-bold text-white">{latestPrice?.high?.toLocaleString() ?? 'N/A'} gp</span>
            </span>
            <span>
                Low: <span className="font-bold text-white">{latestPrice?.low?.toLocaleString() ?? 'N/A'} gp</span>
            </span>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-sm p-3 rounded-md mb-4" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">Track Price:</label>
                <div className="flex items-center gap-2 p-1 bg-gray-900/50 rounded-lg">
                    <Button
                        type="button"
                        variant={priceType === 'high' ? 'secondary' : 'ghost'}
                        onClick={() => setPriceType('high')}
                        className="w-1/2"
                    >
                        High Price (Buy)
                    </Button>
                     <Button
                        type="button"
                        variant={priceType === 'low' ? 'secondary' : 'ghost'}
                        onClick={() => setPriceType('low')}
                        className="w-1/2"
                    >
                        Low Price (Sell)
                    </Button>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">Notify me when price is:</label>
                <div className="flex items-center gap-2 p-1 bg-gray-900/50 rounded-lg">
                    <Button
                        type="button"
                        variant={condition === 'above' ? 'secondary' : 'ghost'}
                        onClick={() => setCondition('above')}
                        className="w-1/2"
                    >
                        Above
                    </Button>
                     <Button
                        type="button"
                        variant={condition === 'below' ? 'secondary' : 'ghost'}
                        onClick={() => setCondition('below')}
                        className="w-1/2"
                    >
                        Below
                    </Button>
                </div>
            </div>
          <div>
            <label htmlFor="target-price" className="block text-sm font-medium text-gray-300 mb-1">Target Price</label>
            <input
              id="target-price"
              type="text"
              placeholder="e.g., 120k or 3.5m"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              required
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
            />
             {targetPrice && !isNaN(parsedTargetPrice) && (
                <p className="text-xs text-gray-400 mt-1">
                    Parsed value: {parsedTargetPrice.toLocaleString()} gp
                </p>
            )}
          </div>
          <div className="flex items-center gap-4 pt-2">
            {existingAlert && (
                <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    onClick={handleRemove}
                >
                    <Trash2Icon className="w-5 h-5 mr-2"/>
                    Remove Alert
                </Button>
            )}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader size="sm" /> : (existingAlert ? 'Update Alert' : 'Set Alert')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};