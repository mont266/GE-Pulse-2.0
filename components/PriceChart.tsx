import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { TimeseriesData } from '../types';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface PriceChartProps {
  data: TimeseriesData[];
  isInitialLoad: boolean;
  showAverageLine: boolean;
  isFullscreen?: boolean;
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800/80 backdrop-blur-sm p-3 border border-gray-600 rounded-lg shadow-lg">
          <p className="text-sm text-gray-300">{new Date(data.timestamp * 1000).toLocaleString()}</p>
          <p className="font-bold text-emerald-400">Price: {data.avgHighPrice?.toLocaleString() || 'N/A'} gp</p>
          <p className="text-xs text-gray-400">Volume: {(data.highPriceVolume + data.lowPriceVolume).toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

const renderLiveDot = (props: any) => {
    const { cx, cy, stroke, index, data } = props;

    // Find the index of the last data point with a valid price
    let lastValidIndex = -1;
    for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].avgHighPrice !== null) {
            lastValidIndex = i;
            break;
        }
    }
    
    // Only render the dot if this point is the last valid one and has valid coordinates
    if (index === lastValidIndex && cx != null && cy != null) {
        // Using a group with a transform is more robust for animations
        return (
            <g transform={`translate(${cx}, ${cy})`}>
                <circle r="8" fill={stroke} fillOpacity={0.2} />
                <circle r="8" fill={stroke} fillOpacity={0.2} className="pulse-dot" />
                <circle r="4" fill={stroke} />
            </g>
        );
    }

    return null;
};


export const PriceChart: React.FC<PriceChartProps> = ({ data, isInitialLoad, showAverageLine, isFullscreen = false }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
    
  const hasValidPriceData = useMemo(() => data.some(d => d.avgHighPrice !== null), [data]);

  const averagePrice = useMemo(() => {
    if (!hasValidPriceData) return null;
    const validPrices = data.map(d => d.avgHighPrice).filter((p): p is number => p !== null && p > 0);
    if (validPrices.length === 0) return null;
    const sum = validPrices.reduce((acc, price) => acc + price, 0);
    return sum / validPrices.length;
  }, [data, hasValidPriceData]);
  
  // New logic to determine date format based on the time range of the data
  const timeRangeInSeconds = data.length > 0 ? data[data.length - 1].timestamp - data[0].timestamp : 0;
  const isLongTimeRange = timeRangeInSeconds > 7 * 24 * 60 * 60; // More than 7 days

  const formatXAxisLabel = (unixTime: number) => {
      const date = new Date(unixTime * 1000);
      if (isLongTimeRange) {
          // For long ranges (like '1M' or 'ALL'), show Month/Year
          return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
      }
      if (isFullscreen) {
         return date.toLocaleTimeString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      }
      // For short ranges, show Time
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  };


  if (data.length === 0 || !hasValidPriceData) {
    return <div className="flex items-center justify-center h-full text-gray-500">No price data available for this period.</div>;
  }
  
  const liveDotWithData = (props: any) => renderLiveDot({ ...props, data });

  return (
    <div className="w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
        <AreaChart
            data={data}
            margin={{ top: 5, right: 20, left: isFullscreen ? -5 : 10, bottom: isFullscreen ? 15 : 25 }}
        >
            <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
                dataKey="timestamp" 
                axisLine={false}
                tickLine={false}
                tickFormatter={formatXAxisLabel}
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: isFullscreen ? 12 : 10 }}
                angle={isFullscreen ? 0 : -30}
                textAnchor={isFullscreen ? "middle" : "end"}
                dy={isFullscreen ? 5 : 10}
                minTickGap={isFullscreen ? 80 : isMobile ? 35 : 80}
            />
            <YAxis 
                dataKey="avgHighPrice" 
                axisLine={false}
                tickLine={false}
                domain={['dataMin', 'auto']}
                tickCount={6}
                tickFormatter={(price) => {
                    if (price >= 1000000) return `${(price / 1000000).toFixed(2)}m`;
                    if (price >= 1000) return `${(price / 1000).toFixed(1)}k`;
                    return price.toString();
                }}
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: isFullscreen ? 12 : 10 }}
                width={isFullscreen ? 60 : isMobile ? 40 : 50}
            />
            <Tooltip content={<CustomTooltip />} />
            {showAverageLine && averagePrice !== null && (
                <ReferenceLine
                    y={averagePrice}
                    label={{
                        value: `Avg: ${averagePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                        position: 'insideTopLeft',
                        fill: '#c7d2fe', // indigo-200
                        fontSize: 12,
                        dy: -10,
                        dx: 10,
                    }}
                    stroke="#6366f1" // indigo-500
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    ifOverflow="visible"
                />
            )}
            <Area 
                type="monotone" 
                dataKey="avgHighPrice" 
                stroke="#10b981" 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#colorPrice)" 
                connectNulls={true}
                dot={liveDotWithData}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#10b981', fill: '#1f2937' }}
                isAnimationActive={isInitialLoad}
                animationDuration={800}
            />
        </AreaChart>
        </ResponsiveContainer>
    </div>
  );
};
