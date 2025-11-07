import React, { useState, useEffect } from 'react';
import type { Achievement, Profile, UserProgressStats } from '../types';
import { fetchAllAchievements, fetchUserAchievements, fetchUserAchievementProgress } from '../services/database';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Loader } from './ui/Loader';
import { XIcon, TrophyIcon, AwardIcon, BriefcaseIcon, DollarSignIcon, FlameIcon, StarIcon, ZapIcon } from './icons/Icons';
import { ProgressBar } from './ui/ProgressBar';

interface AchievementsModalProps {
  profile: Profile;
  onClose: () => void;
}

const AchievementIcon: React.FC<{ iconName: string | null, earned: boolean }> = ({ iconName, earned }) => {
    const iconProps = {
        className: `w-10 h-10 ${earned ? 'text-yellow-400' : 'text-gray-500 opacity-80'}`,
    };
    switch (iconName) {
        case 'trophy': return <TrophyIcon {...iconProps} />;
        case 'briefcase': return <BriefcaseIcon {...iconProps} />;
        case 'dollar': return <DollarSignIcon {...iconProps} />;
        case 'flame': return <FlameIcon {...iconProps} />;
        case 'star': return <StarIcon {...iconProps} />;
        case 'zap': return <ZapIcon {...iconProps} />;
        default: return <AwardIcon {...iconProps} />;
    }
};

const AchievementCard: React.FC<{
  achievement: Achievement;
  earned: boolean;
  progress: number;
  currentValue: number;
}> = ({ achievement, earned, progress, currentValue }) => {
  const isProgressBased = achievement.type && achievement.threshold;

  return (
    <Card className={`flex flex-col p-4 transition-all duration-300 ${earned ? 'border-yellow-500/30 bg-gray-800' : 'bg-gray-800/60'}`}>
        <div className="flex items-start gap-4">
            <AchievementIcon iconName={achievement.icon_name} earned={earned} />
            <div className="flex-1">
                <h4 className={`font-bold ${earned ? 'text-white' : 'text-gray-400'}`}>{achievement.name}</h4>
                <p className="text-sm text-gray-400 mt-1">{achievement.description}</p>
            </div>
            <div className="text-right flex-shrink-0">
                <p className={`font-bold text-sm ${earned ? 'text-emerald-400' : 'text-gray-500'}`}>{achievement.xp_reward} XP</p>
            </div>
        </div>
        {!earned && isProgressBased && (
            <div className="mt-3">
                <ProgressBar progress={progress} />
                <p className="text-xs text-right text-gray-500 mt-1">
                    {currentValue.toLocaleString()} / {achievement.threshold!.toLocaleString()}
                </p>
            </div>
        )}
    </Card>
  );
};


export const AchievementsModal: React.FC<AchievementsModalProps> = ({ profile, onClose }) => {
    const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
    const [earnedIds, setEarnedIds] = useState<Set<number>>(new Set());
    const [progress, setProgress] = useState<UserProgressStats>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [achievements, earned, userProgress] = await Promise.all([
                    fetchAllAchievements(),
                    fetchUserAchievements(profile.id),
                    fetchUserAchievementProgress(profile.id),
                ]);
                setAllAchievements(achievements);
                setEarnedIds(earned);
                setProgress(userProgress);
            } catch (err: any) {
                setError(err.message || 'Failed to load achievements.');
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [profile.id]);

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-64"><Loader /></div>;
        }

        if (error) {
            return <div className="text-center text-red-400 mt-8 bg-red-500/10 p-4 rounded-lg">{error}</div>;
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allAchievements.map(ach => {
                    const earned = earnedIds.has(ach.id);
                    let progressPercent = 0;
                    let currentValue = 0;
                    
                    if (ach.type && ach.threshold && progress[ach.type] !== undefined) {
                        currentValue = progress[ach.type];
                        progressPercent = Math.min((currentValue / ach.threshold) * 100, 100);
                    }
                    
                    return (
                        <AchievementCard
                            key={ach.id}
                            achievement={ach}
                            earned={earned}
                            progress={progressPercent}
                            currentValue={currentValue}
                        />
                    );
                })}
            </div>
        );
    }

    return (
        <div 
          className="fixed inset-0 bg-gray-900 bg-opacity-80 z-40 flex justify-center items-center p-4"
          onClick={onClose}
          aria-modal="true"
          role="dialog"
        >
          <div 
            className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl relative border border-gray-700/50 flex flex-col h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="p-6 border-b border-gray-700/50 flex justify-between items-center flex-shrink-0">
                <h3 className="text-2xl font-bold text-white">All Achievements</h3>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={onClose} aria-label="Close achievements modal">
                    <XIcon className="w-6 h-6" />
                </Button>
            </header>
            <main className="p-6 overflow-y-auto">
                {renderContent()}
            </main>
          </div>
        </div>
    );
};
