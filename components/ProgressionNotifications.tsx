
import React, { useEffect, useState } from 'react';
import type { ProgressionNotification } from '../types';
import { Card } from './ui/Card';
import { AwardIcon, CheckCircleIcon, TrophyIcon } from './icons/Icons';
import { getRankForLevel } from '../utils/progression';

interface ProgressionNotificationsProps {
  notifications: ProgressionNotification[];
  onRemove: (id: string) => void;
}

const NOTIFICATION_DURATION = 5000; // 5 seconds for toasts
const CELEBRATION_DURATION = 7000; // 7 seconds for major events

const XpToast: React.FC<{ amount: number; reason: string; onRemove: () => void }> = ({ amount, reason, onRemove }) => {
    useEffect(() => {
        const timer = setTimeout(onRemove, NOTIFICATION_DURATION);
        return () => clearTimeout(timer);
    }, [onRemove]);

    return (
        <div className="notification-toast animate-toast-in-out bg-gray-800 border border-gray-700/50 rounded-lg shadow-lg flex items-center gap-3 p-3 text-sm">
            <CheckCircleIcon className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span className="text-white font-semibold">+{amount.toLocaleString()} XP</span>
            <span className="text-gray-400">({reason})</span>
        </div>
    );
};

const AchievementModal: React.FC<{ achievement: ProgressionNotification['data'] & { type: 'achievement' }; onRemove: () => void }> = ({ achievement, onRemove }) => {
    useEffect(() => {
        const timer = setTimeout(onRemove, CELEBRATION_DURATION);
        return () => clearTimeout(timer);
    }, [onRemove]);

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in">
             <Card className="border-yellow-500/50 max-w-sm w-full text-center p-8 animate-zoom-in">
                <TrophyIcon className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <p className="text-sm font-semibold text-yellow-300">ACHIEVEMENT UNLOCKED</p>
                <h3 className="text-2xl font-bold text-white mt-2">{achievement.achievement.name}</h3>
                <p className="text-gray-400 mt-2 mb-4">{achievement.achievement.description}</p>
                <p className="font-bold text-emerald-400">+{achievement.achievement.xp_reward.toLocaleString()} XP</p>
            </Card>
        </div>
    );
};

const LevelUpModal: React.FC<{ levelUp: ProgressionNotification['data'] & { type: 'level_up' }; onRemove: () => void }> = ({ levelUp, onRemove }) => {
    useEffect(() => {
        const timer = setTimeout(onRemove, CELEBRATION_DURATION);
        return () => clearTimeout(timer);
    }, [onRemove]);

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in">
             <Card className="border-emerald-500/50 max-w-sm w-full text-center p-8 animate-zoom-in">
                <AwardIcon className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                <p className="text-sm font-semibold text-emerald-300">LEVEL UP!</p>
                <h3 className="text-6xl font-bold text-white my-2">{levelUp.newLevel}</h3>
                <p className="text-gray-400 mt-2">Congratulations on reaching a new level!</p>
            </Card>
        </div>
    );
};

const RankUpModal: React.FC<{ rankUp: ProgressionNotification['data'] & { type: 'rank_up' }; onRemove: () => void }> = ({ rankUp, onRemove }) => {
    useEffect(() => {
        const timer = setTimeout(onRemove, CELEBRATION_DURATION);
        return () => clearTimeout(timer);
    }, [onRemove]);

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in">
             <Card className="border-purple-500/50 max-w-sm w-full text-center p-8 animate-zoom-in">
                <AwardIcon className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                <p className="text-sm font-semibold text-purple-300">RANK UP!</p>
                <h3 className="text-3xl font-bold text-white my-2">{rankUp.newRank}</h3>
                <p className="text-gray-400 mt-2">Your dedication has been recognized. A new title is yours!</p>
            </Card>
        </div>
    );
};


export const ProgressionNotifications: React.FC<ProgressionNotificationsProps> = ({ notifications, onRemove }) => {
    // Separate notifications into toasts and modals
    const xpToasts = notifications.filter(n => n.data.type === 'xp');
    const modalNotification = notifications.find(n => n.data.type !== 'xp'); // Only show one modal at a time

    return (
        <>
            {/* Toasts container */}
            <div className="fixed top-5 right-5 z-50 space-y-3">
                {xpToasts.map(notification => {
                    if (notification.data.type === 'xp') {
                        return <XpToast key={notification.id} {...notification.data} onRemove={() => onRemove(notification.id)} />;
                    }
                    return null;
                })}
            </div>
            {/* Modal container */}
            {modalNotification && (() => {
                switch(modalNotification.data.type) {
                    case 'achievement':
                        return <AchievementModal key={modalNotification.id} achievement={modalNotification.data} onRemove={() => onRemove(modalNotification.id)} />
                    case 'level_up':
                         return <LevelUpModal key={modalNotification.id} levelUp={modalNotification.data} onRemove={() => onRemove(modalNotification.id)} />
                    case 'rank_up':
                        return <RankUpModal key={modalNotification.id} rankUp={modalNotification.data} onRemove={() => onRemove(modalNotification.id)} />
                    default:
                        return null;
                }
            })()}
            
            <style>{`
                @keyframes toast-in {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes toast-out {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                .animate-toast-in-out {
                    animation: toast-in 0.5s forwards, toast-out 0.5s ${NOTIFICATION_DURATION / 1000 - 0.5}s forwards;
                }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                @keyframes zoom-in {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-zoom-in { animation: zoom-in 0.3s ease-out forwards; }
            `}</style>
        </>
    );
};
