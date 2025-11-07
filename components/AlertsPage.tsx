import React, { useState } from 'react';
import type { Item, LatestPrice, PriceAlert, Profile } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
// FIX: Import ChevronRightIcon to resolve 'Cannot find name' error.
import { BellIcon, XIcon, StarIcon, ChevronRightIcon } from './icons/Icons';
import { getHighResImageUrl, createIconDataUrl } from '../utils/image';
import { FREE_USER_ALERT_LIMIT } from '../constants';
import { AlertSettingsModal } from './AlertSettingsModal';

interface AlertsPageProps {
  alerts: PriceAlert[];
  setAlerts: React.Dispatch<React.SetStateAction<PriceAlert[]>>;
  items: Record<string, Item>;
  latestPrices: Record<string, LatestPrice>;
  onSelectItem: (item: Item) => void;
  profile: Profile | null;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ alerts, setAlerts, items, latestPrices, onSelectItem, profile }) => {
  const [editingAlertItem, setEditingAlertItem] = useState<Item | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const existingAlertForModal = editingAlertItem ? alerts.find(a => a.itemId === editingAlertItem.id) : null;

  const handleSaveAlert = (newAlert: PriceAlert) => {
    setAlerts(prev => [...prev.filter(a => a.itemId !== newAlert.itemId), newAlert]);
    setNotification({ message: `Alert updated for ${items[newAlert.itemId].name}!`, type: 'success' });
    setTimeout(() => setNotification(null), 3000);
    setEditingAlertItem(null);
  };

  const handleRemoveAlert = (itemId: number) => {
    setAlerts(prev => prev.filter(alert => alert.itemId !== itemId));
    setNotification({ message: `Alert for ${items[itemId].name} removed.`, type: 'success' });
    setTimeout(() => setNotification(null), 3000);
    if(editingAlertItem?.id === itemId) {
        setEditingAlertItem(null);
    }
  };

  const isPremium = profile?.premium ?? false;

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
      {notification && (
        <div className={`fixed top-5 right-5 ${notification.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'} text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in`}>
          {notification.message}
        </div>
      )}
      {editingAlertItem && (
        <AlertSettingsModal
            item={editingAlertItem}
            latestPrice={latestPrices[editingAlertItem.id]}
            existingAlert={existingAlertForModal ?? null}
            onClose={() => setEditingAlertItem(null)}
            onSave={handleSaveAlert}
            onRemove={handleRemoveAlert}
        />
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-3xl font-bold text-white">Price Alerts</h2>
        {profile && (
             isPremium ? (
                 <div className="flex items-center gap-1.5 self-end sm:self-center bg-yellow-400/20 text-yellow-300 border border-yellow-500/50 rounded-full px-3 py-1 text-xs font-bold">
                    <StarIcon className="w-4 h-4" />
                    <span>Unlimited Alerts</span>
                 </div>
             ) : (
                <div className="w-full sm:w-48 self-end sm:self-center">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-semibold text-white">Slots Used</span>
                        <span className="text-sm font-bold text-white">{alerts.length} / {FREE_USER_ALERT_LIMIT}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 border border-gray-600/50">
                        <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${(alerts.length / FREE_USER_ALERT_LIMIT) * 100}%` }}
                        ></div>
                    </div>
                </div>
            )
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alerts.map(alert => {
          const item = items[alert.itemId];
          if (!item) return null;
          
          const isHighPriceAlert = (alert.priceType ?? 'high') === 'high';
          const priceTypeLabel = isHighPriceAlert ? 'High Price' : 'Low Price';
          const currentPrice = isHighPriceAlert ? latestPrices[item.id]?.high : latestPrices[item.id]?.low;

          return (
            <Card 
              key={alert.itemId} 
              onClick={() => setEditingAlertItem(item)} 
              isHoverable={true}
              className="flex flex-col"
            >
              <div className="flex items-center gap-4 flex-1">
                <img 
                  src={getHighResImageUrl(item.name)}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = createIconDataUrl(item.icon);
                  }}
                  alt={item.name} 
                  className="w-10 h-10 object-contain bg-gray-700/50 rounded-md"
                />
                <div className="flex-1">
                  <p className="font-bold text-white">{item.name}</p>
                  <p className="text-sm text-emerald-400">
                    Notify if {priceTypeLabel} is {alert.condition} {alert.targetPrice.toLocaleString()} gp
                  </p>
                   <p className="text-xs text-gray-400">
                    Current {priceTypeLabel}: {currentPrice?.toLocaleString() || 'N/A'} gp
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-8 h-8 text-gray-400 hover:text-red-400" 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAlert(item.id);
                        }}
                        aria-label={`Remove alert for ${item.name}`}
                    >
                        <XIcon className="w-5 h-5"/>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-gray-400 hover:text-white"
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelectItem(item)
                        }}
                        aria-label={`View ${item.name}`}
                    >
                        <ChevronRightIcon className="w-5 h-5"/>
                    </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};