import React from 'react';
import { Card } from './Card';

const SkeletonLine: React.FC<{ width?: string; height?: string; className?: string }> = ({ width = '100%', height = '1rem', className = '' }) => (
    <div className={`shimmer-bg rounded ${className}`} style={{ width, height }}></div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
    <Card className={`p-4 ${className}`}>
        <div className="flex items-center gap-4">
            <div className="shimmer-bg w-10 h-10 rounded-md flex-shrink-0"></div>
            <div className="flex-1 space-y-2">
                <SkeletonLine width="75%" />
                <SkeletonLine width="50%" height="0.75rem" />
            </div>
        </div>
    </Card>
);

export const SkeletonChart: React.FC = () => {
    return (
        <div className="h-full flex flex-col">
            {/* Price Chart Area */}
            <div className="flex-grow h-2/3 relative p-4 border border-gray-700/50 rounded-lg overflow-hidden">
                <div className="w-full h-full shimmer-bg opacity-50"></div>
                 {/* Grid lines to make it look more like a chart */}
                <div className="absolute inset-x-4 top-0 bottom-0 flex flex-col justify-around">
                    <div className="w-full h-px bg-gray-700 opacity-50"></div>
                    <div className="w-full h-px bg-gray-700 opacity-50"></div>
                    <div className="w-full h-px bg-gray-700 opacity-50"></div>
                </div>
                <div className="absolute inset-y-4 right-0 left-0 flex justify-around">
                     <div className="h-full w-px bg-gray-700 opacity-50"></div>
                     <div className="h-full w-px bg-gray-700 opacity-50"></div>
                     <div className="h-full w-px bg-gray-700 opacity-50"></div>
                </div>
            </div>
            {/* Volume Chart Area */}
            <div className="flex-grow h-1/3 pt-4 mt-4 relative">
                 <div className="h-full w-full relative p-2 border border-gray-700/50 rounded-lg overflow-hidden">
                     <div className="w-full h-full flex items-end justify-between">
                        <SkeletonLine width="5%" height="30%" />
                        <SkeletonLine width="5%" height="50%" />
                        <SkeletonLine width="5%" height="20%" />
                        <SkeletonLine width="5%" height="60%" />
                        <SkeletonLine width="5%" height="40%" />
                        <SkeletonLine width="5%" height="70%" />
                        <SkeletonLine width="5%" height="25%" />
                        <SkeletonLine width="5%" height="45%" />
                        <SkeletonLine width="5%" height="55%" />
                        <SkeletonLine width="5%" height="35%" />
                        <SkeletonLine width="5%" height="65%" />
                     </div>
                </div>
            </div>
        </div>
    );
};
