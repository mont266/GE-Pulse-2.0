import React, { useState, useEffect } from 'react';
import { BarChartIcon, UsersIcon, BriefcaseIcon, StarIcon, DollarSignIcon } from './icons/Icons';
import { Card } from './ui/Card';
import { Loader } from './ui/Loader';
import { Button } from './ui/Button';
import type { AppStats, StatsTimeRange } from '../types';
import { fetchAppStats } from '../services/database';
import { formatLargeNumber } from '../utils/image';


interface StatsPageProps {}

const TIME_RANGES: { label: string; value: StatsTimeRange }[] = [
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'This Year', value: 'year' },
    { label: 'All Time', value: 'all' },
];

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number | string; }> = ({ icon, label, value }) => (
    <Card>
        <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-700/50 rounded-lg">
                {icon}
            </div>
            <div>
                <p className="text-sm text-gray-400">{label}</p>
                <p className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            </div>
        </div>
    </Card>
);

const ProfitText: React.FC<{ value: number }> = ({ value }) => {
    const colorClass = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
    const sign = value > 0 ? '+' : '';
    return <span className={colorClass}>{sign}{formatLargeNumber(value)} gp</span>;
};

export const StatsPage: React.FC<StatsPageProps> = () => {
    const [stats, setStats] = useState<AppStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<StatsTimeRange>('all');

    useEffect(() => {
        const loadStatsData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const fetchedStats = await fetchAppStats(timeRange);
                setStats(fetchedStats);
            } catch (err: any) {
                console.error("Failed to load app stats", err);
                setError(err.message || "Failed to load developer statistics.");
            } finally {
                setIsLoading(false);
            }
        };
        loadStatsData();
    }, [timeRange]);


    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-64"><Loader /></div>;
        }

        if (error) {
            return <div className="text-center text-red-400 mt-8 bg-red-500/10 p-4 rounded-lg">{error}</div>;
        }

        if (!stats) {
             return <div className="text-center text-gray-500 mt-8">No stats available.</div>;
        }

        const timePeriodText = timeRange === 'all' ? '' : `in the last ${timeRange}`;

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                 {/* Row 1: Key Financials */}
                <StatCard 
                    icon={<DollarSignIcon className="w-8 h-8 text-emerald-400" />} 
                    label="Total Realised Profit" 
                    value={stats.totalProfit > 0 ? `+${formatLargeNumber(stats.totalProfit)}` : formatLargeNumber(stats.totalProfit)}
                />
                <StatCard 
                    icon={<DollarSignIcon className="w-8 h-8 text-red-400" />} 
                    label="Total GE Tax Paid" 
                    value={formatLargeNumber(stats.totalTax)}
                />

                {/* Row 2: Activity */}
                <StatCard icon={<BriefcaseIcon className="w-8 h-8 text-blue-400" />} label={`New Investments ${timePeriodText}`} value={stats.totalInvestments} />
                <StatCard icon={<BriefcaseIcon className="w-8 h-8 text-purple-400" />} label={`Completed Trades ${timePeriodText}`} value={stats.closedTrades} />
                
                {/* Row 3: User Growth & Engagement */}
                <StatCard icon={<UsersIcon className="w-8 h-8 text-cyan-400" />} label={`New Users ${timePeriodText}`} value={stats.newUsers} />
                <StatCard icon={<UsersIcon className="w-8 h-8 text-indigo-400" />} label="Total Users (All Time)" value={stats.totalUsers} />
                <StatCard icon={<StarIcon className="w-8 h-8 text-yellow-400" />} label="Total Watchlist Items" value={stats.totalWatchlistItems} />

            </div>
        )
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <BarChartIcon className="w-10 h-10 text-emerald-400" />
                    <div>
                        <h1 className="text-3xl font-bold text-white">Developer Stats</h1>
                        <p className="text-gray-400">An overview of application usage and metrics.</p>
                    </div>
                </div>
                 <div className="flex items-center gap-1 bg-gray-800/60 p-1 rounded-lg">
                    {TIME_RANGES.map(({ label, value }) => (
                        <Button
                            key={value}
                            size="sm"
                            variant={timeRange === value ? 'secondary' : 'ghost'}
                            onClick={() => setTimeRange(value)}
                            className={`px-3 py-1 ${timeRange !== value ? 'text-gray-400 hover:text-white' : 'shadow-md'}`}
                        >
                            {label}
                        </Button>
                    ))}
                </div>
            </div>
            {renderContent()}
        </div>
    );
};