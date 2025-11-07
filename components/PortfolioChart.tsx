import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PortfolioChartProps {
  data: { date: string; value: number }[];
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const formattedDate = new Date(label).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
        });
      const profit = payload[0].value;
      const profitColor = profit > 0 ? 'text-emerald-400' : profit < 0 ? 'text-red-400' : 'text-white';

      return (
        <div className="bg-gray-800/80 backdrop-blur-sm p-3 border border-gray-600 rounded-lg shadow-lg">
          <p className="text-sm text-gray-300">{formattedDate}</p>
          <p className={`font-bold ${profitColor}`}>Cumulative P/L: {profit.toLocaleString()} gp</p>
        </div>
      );
    }
    return null;
};

export const PortfolioChart: React.FC<PortfolioChartProps> = ({ data }) => {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-center p-4">
        Not enough trade history to display chart. Close some trades to see your performance over time.
      </div>
    );
  }

  const formatYAxis = (value: number) => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}b`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
    return value.toString();
  };

  const formatXAxis = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  
  const hasProfit = data.some(d => d.value > 0);
  const hasLoss = data.some(d => d.value < 0);
  
  const strokeColor = hasProfit ? "#10b981" : hasLoss ? "#f87171" : "#9ca3af";
  const gradientId = "portfolioGradient";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 15, bottom: 5 }}>
        <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0}/>
            </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis 
            dataKey="date" 
            tickFormatter={formatXAxis}
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            minTickGap={30}
            padding={{ left: 20, right: 20 }}
        />
        <YAxis 
            dataKey="value"
            tickFormatter={formatYAxis}
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            domain={['auto', 'auto']}
            width={60}
            axisLine={false}
            tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area 
            type="monotone" 
            dataKey="value" 
            stroke={strokeColor} 
            strokeWidth={2} 
            fillOpacity={1} 
            fill={`url(#${gradientId})`}
            connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
