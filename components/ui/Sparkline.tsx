import React from 'react';
import { AreaChart, Area, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { TimeseriesData } from '../../types';

interface SparklineProps {
  data: TimeseriesData[];
}

export const Sparkline: React.FC<SparklineProps> = ({ data }) => {
  const priceData = data
    .map(d => ({ timestamp: d.timestamp, price: d.avgHighPrice }))
    .filter(d => d.price !== null && d.price !== undefined) as { timestamp: number; price: number }[];

  const averagePrice = React.useMemo(() => {
    if (priceData.length < 2) return null;
    const validPrices = priceData.map(d => d.price).filter((p): p is number => p > 0);
    if (validPrices.length === 0) return null;
    const sum = validPrices.reduce((acc, p) => acc + p, 0);
    return sum / validPrices.length;
  }, [priceData]);

  if (priceData.length < 2) {
    return <div className="h-full w-full flex items-center justify-center text-gray-500 text-xs">Not enough data</div>;
  }

  const strokeColor = '#10b981'; // emerald-500, same as main chart
  const gradientId = 'sparkline-gradient-static';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={priceData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0}/>
            </linearGradient>
        </defs>
        {averagePrice !== null && (
            <ReferenceLine 
                y={averagePrice} 
                stroke="#6366f1" // indigo-500
                strokeDasharray="2 2" 
                strokeWidth={1.5}
            />
        )}
        <Area
          type="monotone"
          dataKey="price"
          stroke={strokeColor}
          strokeWidth={2}
          fillOpacity={1}
          fill={`url(#${gradientId})`}
          connectNulls
          activeDot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};