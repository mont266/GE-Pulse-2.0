
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TimeseriesData } from '../types';

interface PriceChartProps {
  data: TimeseriesData[];
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

export const PriceChart: React.FC<PriceChartProps> = ({ data }) => {
    
  const hasValidPriceData = useMemo(() => data.some(d => d.avgHighPrice !== null), [data]);

  if (data.length === 0 || !hasValidPriceData) {
    return <div className="flex items-center justify-center h-full text-gray-500">No price data available for this period.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 5, right: 20, left: 10, bottom: 25 }} // More bottom margin for angled labels
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
            tickFormatter={(unixTime) => new Date(unixTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            angle={-30}
            textAnchor="end"
            dy={10}
            minTickGap={80}
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
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            width={50}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area 
            type="monotone" 
            dataKey="avgHighPrice" 
            stroke="#10b981" 
            strokeWidth={2} 
            fillOpacity={1} 
            fill="url(#colorPrice)" 
            connectNulls={true}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};