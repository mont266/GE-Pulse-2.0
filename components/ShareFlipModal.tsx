import React, { useState } from 'react';
import type { Item, Investment, FlipData } from '../types';
import { Button } from './ui/Button';
import { Loader } from './ui/Loader';
import { XIcon } from './icons/Icons';
import { getHighResImageUrl, createIconDataUrl, formatLargeNumber } from '../utils/image';

const FlipPostCardContent: React.FC<{ flip: FlipData; item: Item; }> = ({ flip, item }) => {
    return (
        <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-4">
                 <img src={getHighResImageUrl(flip.item_name)} onError={(e) => { e.currentTarget.src = createIconDataUrl(item.icon); }} alt={flip.item_name} className="w-12 h-12 object-contain bg-gray-700/50 rounded-md"/>
                 <div className="flex-1">
                     <p className="font-bold text-white">{flip.quantity.toLocaleString()} x {flip.item_name}</p>
                     <p className="text-xs text-gray-400">ROI: <span className="font-semibold text-emerald-400">{flip.roi.toFixed(2)}%</span></p>
                 </div>
                 <div className="text-right">
                     <p className="text-sm text-gray-400">Profit</p>
                     <p className="text-xl font-bold text-emerald-400">+{formatLargeNumber(flip.profit)}</p>
                 </div>
            </div>
        </div>
    )
};


interface ShareFlipModalProps {
  investment: Investment;
  item: Item;
  onClose: () => void;
  onShare: (postData: { title: string | null; content: string | null; flip_data: FlipData }) => Promise<void>;
}

export const ShareFlipModal: React.FC<ShareFlipModalProps> = ({ investment, item, onClose, onShare }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState(`Check out my latest flip on the ${item.name}!`);
    const [isSharing, setIsSharing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const flipData: FlipData = React.useMemo(() => {
        const purchaseValue = investment.purchase_price * investment.quantity;
        const sellValue = investment.sell_price!;
        const profit = (sellValue * investment.quantity) - purchaseValue - (investment.tax_paid ?? 0);
        const roi = purchaseValue > 0 ? (profit / purchaseValue) * 100 : 0;

        return {
            item_id: item.id,
            item_name: item.name,
            quantity: investment.quantity,
            purchase_price: investment.purchase_price,
            sell_price: investment.sell_price!,
            profit,
            roi
        };
    }, [investment, item]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSharing(true);
        setError(null);
        try {
            await onShare({
                title: title.trim() || null,
                content: content.trim() || null,
                flip_data: flipData
            });
            // The parent will close the modal on success
        } catch (err: any) {
            setError(err.message || 'Failed to share flip.');
            setIsSharing(false);
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

            <h2 className="text-xl font-bold text-white mb-4">Share Flip to Community</h2>
            
            <div className="mb-4">
                <FlipPostCardContent flip={flipData} item={item} />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-sm p-3 rounded-md my-4" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="share-title" className="block text-sm font-medium text-gray-300 mb-1">Title (optional)</label>
                    <input id="share-title" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Massive profit on Twisted Bows!" className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-2 text-white placeholder-gray-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition" />
                </div>
                <div>
                    <label htmlFor="share-content" className="block text-sm font-medium text-gray-300 mb-1">Message</label>
                    <textarea id="share-content" value={content} onChange={e => setContent(e.target.value)} rows={3}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-2 text-white placeholder-gray-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition" />
                </div>

              <div className="flex items-center justify-end gap-4 pt-2">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSharing}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={isSharing || (!title.trim() && !content.trim())}>
                    {isSharing ? <Loader size="sm" /> : 'Share Post'}
                </Button>
              </div>
            </form>
          </div>
        </div>
    );
};
