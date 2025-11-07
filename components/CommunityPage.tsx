
import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Loader } from './ui/Loader';
import { Button } from './ui/Button';
import { UsersIcon, TrophyIcon } from './icons/Icons';
import { fetchLeaderboard } from '../services/database';
import type { LeaderboardEntry, LeaderboardTimeRange } from '../types';

interface CommunityPageProps {
    onViewProfile: (user: LeaderboardEntry) => void;
}

const ProfitText: React.FC<{ value: number }> = ({ value }) => {
    const colorClass = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
    const sign = value > 0 ? '+' : '';
    return <span className={`font-bold ${colorClass}`}>{sign}{value.toLocaleString()} gp</span>;
};

const RankIcon: React.FC<{ rank: number }> = ({ rank }) => {
    const rankClasses: Record<number, string> = {
        1: 'text-yellow-400',
        2: 'text-gray-300',
        3: 'text-yellow-600',
    };
    if (rank <= 3) {
        return <TrophyIcon className={`w-6 h-6 ${rankClasses[rank]}`} />;
    }
    return <span className="text-gray-400 font-bold text-lg w-6 text-center">{rank}</span>;
};

const TIME_RANGES: { label: string; value: LeaderboardTimeRange }[] = [
    { label: 'Today', value: 'today' },
    { label: 'This Month', value: 'month' },
    { label: 'This Year', value: 'year' },
    { label: 'All Time', value: 'all' },
];

export const CommunityPage: React.FC<CommunityPageProps> = ({ onViewProfile }) => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [timeRange, setTimeRange] = useState<LeaderboardTimeRange>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadLeaderboard = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await fetchLeaderboard(timeRange);
                setLeaderboard(data);
            } catch (err) {
                console.error(err);
                setError("Failed to load the community leaderboard. The G.E. scribes might be on a break.");
            } finally {
                setIsLoading(false);
            }
        };
        loadLeaderboard();
    }, [timeRange]);

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-64"><Loader /></div>;
        }

        if (error) {
            return <div className="text-center text-red-400 mt-8">{error}</div>;
        }
        
        if (leaderboard.length === 0) {
            return (
                 <div className="text-center py-20 border-2 border-dashed border-gray-700 rounded-lg">
                    <p className="text-gray-500">The leaderboard is empty for this time period. Be the first to close a profitable trade!</p>
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {leaderboard.map((user) => (
                    <Card key={`${user.username}-${user.rank}`} className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="flex-shrink-0">
                                <RankIcon rank={user.rank} />
                            </div>
                            <div className="flex-1">
                                <Button variant="ghost" className="p-0 h-auto text-lg font-bold text-white hover:text-emerald-300" onClick={() => onViewProfile(user)}>
                                    {user.username}
                                </Button>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-400">Total Profit</p>
                                <ProfitText value={user.total_profit} />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        );
    };
    
    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <UsersIcon className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                <h1 className="text-4xl font-bold text-white">Community Leaderboard</h1>
                <p className="text-gray-400 mt-2">See who's making the biggest profits on the Grand Exchange.</p>
            </div>

            <div className="flex justify-center mb-6">
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
