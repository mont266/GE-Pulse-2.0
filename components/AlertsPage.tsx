import React from 'react';
import type { Item, LatestPrice, PriceAlert } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { BellIcon, XIcon } from './icons/Icons';
import { getHighResImageUrl, createIconDataUrl } from '../utils/image';

interface AlertsPageProps {
  alerts: PriceAlert[];
  setAlerts: React.Dispatch<React.SetStateAction<PriceAlert[]>>;
  items: Record<string, Item>;
  latestPrices: Record<string, LatestPrice>;
  onSelectItem: (item: Item) => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ alerts, setAlerts, items, latestPrices, onSelectItem }) => {
  
  const handleRemoveAlert = (itemId: number) => {
    setAlerts(prev => prev.filter(alert => alert.itemId !== itemId));
  };

  if (alerts.length === 0) {
    return (
      <div className="text-center py-20 flex flex-col items-center">
        <BellIcon className="w-16 h-16 text-gray-600 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">You have no active alerts.</h2>
        <p className="text-gray-400">Click the bell icon on an item's page to set a price alert.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-white mb-6">Price Alerts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alerts.map(alert => {
          const item = items[alert.itemId];
          if (!item) return null; // Should not happen if data is consistent

          return (
            <Card 
              key={alert.itemId} 
              onClick={() => onSelectItem(item)} 
              isHoverable={true}
              className="flex flex-col"
            >
              <div className="flex items-center gap-4 flex-1">
                <img 
                  src={getHighResImageUrl(item.name)}
                  onError={(e) => {
                    e.currentTarget.onerror = null; // Prevent infinite loops
                    e.currentTarget.src = createIconDataUrl(item.icon);
                  }}
                  alt={item.name} 
                  className="w-10 h-10 object-contain bg-gray-700/50 rounded-md"
                />
                <div className="flex-1">
                  <p className="font-bold text-white">{item.name}</p>
                  <p className="text-sm text-emerald-400">
                    Price is {alert.condition} {alert.targetPrice.toLocaleString()} gp
                  </p>
                   <p className="text-xs text-gray-400">
                    Current: {latestPrices[item.id]?.high?.toLocaleString() || 'N/A'} gp
                  </p>
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-8 h-8 text-gray-400 hover:text-red-400" 
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent card click
                        handleRemoveAlert(item.id);
                    }}
                    aria-label={`Remove alert for ${item.name}`}
                >
                    <XIcon className="w-5 h-5"/>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};