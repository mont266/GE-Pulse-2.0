
import React from 'react';

interface TooltipWrapperProps {
  children: React.ReactNode;
  text: string;
  show: boolean; // Conditionally render the tooltip wrapper
}

export const TooltipWrapper: React.FC<TooltipWrapperProps> = ({ children, text, show }) => {
  // If the tooltip is not supposed to be shown (e.g., user is logged in),
  // just render the children without any wrapper.
  if (!show) {
    return <>{children}</>;
  }

  return (
    <div className="relative group w-full">
      {children}
      {/* Tooltip for desktop: shows on the right */}
      <div 
        className="absolute left-full ml-4 top-1/2 -translate-y-1/2 w-max
                   bg-gray-800 text-white text-xs font-semibold
                   rounded-md py-1.5 px-3 shadow-lg border border-gray-700/50
                   opacity-0 group-hover:opacity-100 transition-opacity duration-200
                   pointer-events-none hidden md:block" // Only on md screens and up
        role="tooltip"
      >
        {text}
        {/* Tooltip arrow */}
        <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-gray-800 transform rotate-45 border-l border-b border-gray-700/50"></div>
      </div>
    </div>
  );
};
