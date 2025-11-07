import React, { useState, useMemo } from 'react';
import type { Item, Investment } from '../types';
import { Button } from './ui/Button';
import { Loader } from './ui/Loader';
import { XIcon } from './icons/Icons';
import { getHighResImageUrl, createIconDataUrl, parseShorthandPrice } from '../utils/image';

interface EditInvestmentModalProps {
  investment: Investment;
  item: Item;
  onClose: () => void;
  onSave: (investmentId: string, updates: Partial<Pick<Investment, 'quantity' | 'purchase_price' | 'purchase_date'>>) => Promise<void>;
}

export const EditInvestmentModal: React.FC<EditInvestmentModalProps> = ({ investment, item, onClose, onSave }) => {
  const [quantity, setQuantity] = useState(investment.quantity.toString());
  const [price, setPrice] = useState(investment.purchase_price.toString());
  const [date, setDate] = useState(new Date(investment.purchase_date).toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedPrice = useMemo(() => parseShorthandPrice(price), [price]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const numQuantity = parseInt(quantity, 10);
    const numPrice = parsedPrice;

    if (isNaN(numQuantity) || numQuantity <= 0) {
      setError('Quantity must be a positive number.');
      setLoading(false);
      return;
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Price must be a positive number. You can use "k" for thousands and "m" for millions.');
      setLoading(false);
      return;
    }
    if (!date) {
        setError('Please select a valid date.');
        setLoading(false);
        return;
    }

    try {
      await onSave(investment.id, {
        quantity: numQuantity,
        purchase_price: numPrice,
        purchase_date: new Date(date).toISOString(),
      });
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
        className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md relative border border-gray-700/50"
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
                <h2 className="text-xl font-bold text-white">Edit Investment</h2>
                <p className="text-gray-300">{item.name}</p>
            </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-sm p-3 rounded-md mb-4" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-300">Quantity</label>
              {item.limit > 0 && (
                  <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto py-0.5 px-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-gray-700/50"
                      onClick={() => setQuantity(item.limit.toString())}
                      title={`Set quantity to the OSRS buy limit of ${item.limit.toLocaleString()}`}
                  >
                      Set Limit ({item.limit.toLocaleString()})
                  </Button>
              )}
            </div>
            <input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              min="1"
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
            />
          </div>
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-300 mb-1">Purchase Price (each)</label>
            <input
              id="price"
              type="text"
              placeholder="e.g., 120k or 3.5m"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
            />
            {price && !isNaN(parsedPrice) && (
                <p className="text-xs text-gray-400 mt-1">
                    Parsed value: {parsedPrice.toLocaleString()} gp
                </p>
            )}
          </div>
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-300 mb-1">Purchase Date</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
            />
          </div>
          <Button type="submit" variant="primary" size="lg" className="w-full mt-2" disabled={loading}>
            {loading ? <Loader size="sm" /> : 'Save Changes'}
          </Button>
        </form>
      </div>
    </div>
  );
};