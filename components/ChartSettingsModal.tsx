import React from 'react';
import { Button } from './ui/Button';
import { XIcon, SlidersIcon } from './icons/Icons';

interface ChartSettings {
  showAverageLine: boolean;
  showSellLine: boolean;
}

interface ChartSettingsModalProps {
  settings: ChartSettings;
  onClose: () => void;
  onSettingsChange: (newSettings: ChartSettings) => void;
}

const ToggleSwitch: React.FC<{
    id: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}> = ({ id, label, checked, onChange }) => (
    <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-gray-300 font-medium cursor-pointer">
            {label}
        </label>
        <button
            id={id}
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`${
                checked ? 'bg-emerald-600' : 'bg-gray-600'
            } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900`}
        >
            <span
                aria-hidden="true"
                className={`${
                    checked ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-300 transition-bounce`}
            />
        </button>
    </div>
);


export const ChartSettingsModal: React.FC<ChartSettingsModalProps> = ({ settings, onClose, onSettingsChange }) => {
  return (
    <div
      className="fixed inset-0 bg-gray-900 bg-opacity-80 z-40 flex justify-center items-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm relative border border-gray-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-gray-400 hover:text-white" onClick={onClose} aria-label="Close modal">
          <XIcon className="w-6 h-6" />
        </Button>

        <div className="flex items-center gap-3 mb-4">
            <SlidersIcon className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Chart Settings</h2>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-700/50">
           <ToggleSwitch
                id="show-average-line-toggle"
                label="Show Average Price Line"
                checked={settings.showAverageLine}
                onChange={(isChecked) => onSettingsChange({ ...settings, showAverageLine: isChecked })}
            />
            <ToggleSwitch
                id="show-sell-line-toggle"
                label="Show Sell Price Line"
                checked={settings.showSellLine}
                onChange={(isChecked) => onSettingsChange({ ...settings, showSellLine: isChecked })}
            />
        </div>
      </div>
    </div>
  );
};
