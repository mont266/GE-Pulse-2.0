
import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
}

export const Loader: React.FC<LoaderProps> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className={`animate-spin rounded-full ${sizeClasses[size]} border-emerald-400 border-t-transparent`}></div>
  );
};
