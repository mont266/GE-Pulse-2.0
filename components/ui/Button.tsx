
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button: React.FC<ButtonProps> = ({ children, className, variant = 'primary', size = 'md', ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
    secondary: 'bg-gray-700 text-gray-100 hover:bg-gray-600 focus:ring-gray-500',
    ghost: 'bg-transparent text-gray-300 hover:bg-gray-700/50 hover:text-white',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'h-10 w-10',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
