import React from 'react';

interface ProgressBarProps {
  progress: number; // A value between 0 and 100
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const safeProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="w-full bg-gray-700 rounded-full h-2.5 border border-gray-600/50 overflow-hidden">
      <div 
        className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
        style={{ width: `${safeProgress}%` }}
        aria-valuenow={safeProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        role="progressbar"
      ></div>
    </div>
  );
};
