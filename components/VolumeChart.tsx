import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TimeseriesData } from '../types';
import { formatLargeNumber } from '../utils/image';

interface VolumeChartProps {
  data: TimeseriesData[];
  isInitialLoad: boolean;
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const buyVolume = data.highPriceVolume;
      const sellVolume = data.lowPriceVolume;
      const totalVolume = buyVolume + sellVolume;
      return (
        <div className="bg-gray-800/80 backdrop-blur-sm p-3 border border-gray-600 rounded-lg shadow-lg text-sm">
          <p className="text-gray-300 mb-2">{new Date(data.timestamp * 1000).toLocaleString()}</p>
          <p className="font-semibold text-emerald-400">Buy Volume: {buyVolume.toLocaleString()}</p>
          <p className="font-semibold text-red-400">Sell Volume: {sellVolume.toLocaleString()}</p>
          <hr className="border-gray-600 my-1"/>
          <p className="font-bold text-white">Total Volume: {totalVolume.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

export const VolumeChart: React.FC<VolumeChartProps> = ({ data, isInitialLoad }) => {
    
  const chartData = data.map(d => ({
    timestamp: d.timestamp,
    highPriceVolume: d.highPriceVolume || 0,
    lowPriceVolume: d.lowPriceVolume || 0,
  }));

  const hasValidVolumeData = chartData.some(d => d.highPriceVolume > 0 || d.lowPriceVolume > 0);

  if (!hasValidVolumeData) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-xs">No volume data available.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
        barGap={0}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        <XAxis 
            dataKey="timestamp" 
            axisLine={false}
            tickLine={false}
            tick={false}
            height={1}
        />
        <YAxis 
            axisLine={false}
            tickLine={false}
            tickFormatter={(volume) => formatLargeNumber(volume)}
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            width={50}
        />
        <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(107, 114, 128, 0.2)'}}/>
        <Legend 
            verticalAlign="top" 
            align="right" 
            height={36} 
            iconSize={10}
            wrapperStyle={{ top: -5, right: 0 }}
            formatter={(value, entry) => <span className="text-gray-300 text-xs">{value}</span>}
        />
        <Bar dataKey="highPriceVolume" name="Buy Volume" stackId="a" fill="#10b981" animationDuration={isInitialLoad ? 800 : 0} />
        <Bar dataKey="lowPriceVolume" name="Sell Volume" stackId="a" fill="#f87171" animationDuration={isInitialLoad ? 800 : 0} />
      </BarChart>
    </ResponsiveContainer>
  );
};