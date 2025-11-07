
import React, { useState } from 'react';
import type { Profile } from '../types';
import { UserIcon, ArrowLeftIcon, BriefcaseIcon, CodeIcon, BarChartIcon, ShieldCheckIcon, SlashIcon, ShieldOffIcon, FlameIcon, TrophyIcon } from './icons/Icons';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { setUserRole, banUser } from '../services/database';
import { Loader } from './ui/Loader';
import { getRankForLevel, getTotalXpForLevel } from '../utils/progression';
import { AchievementsModal } from './AchievementsModal';

interface ProfilePageProps {
  profile: Profile;
  viewerProfile: (Profile & { email: string | null; }) | null;
  onBack: () => void;
  totalProfit: number;
  isOwnProfile: boolean;
  onNavigateToStats: () => void;
  onProfileUpdate: (updatedProfileData: Partial<Profile>) => void;
}

const ProfitText: React.FC<{ value: number }> = ({ value }) => {
    const colorClass = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
    const sign = value > 0 ? '+' : '';
    return <span className={colorClass}>{sign}{value.toLocaleString()} gp</span>;
};


const AdminControls: React.FC<{ 
    profile: Profile; 
    onUpdate: (updates: Partial<Profile>) => void; 
    onBanned: () => void;
}> = ({ profile, onUpdate, onBanned }) => {
    const [isDevLoading, setIsDevLoading] = React.useState(false);
    const [isBetaLoading, setIsBetaLoading] = React.useState(false);
    const [isBanConfirmOpen, setIsBanConfirmOpen] = React.useState(false);
    const [isBanning, setIsBanning] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const handleRoleChange = async (role: 'developer' | 'beta_tester', newStatus: boolean) => {
        const setLoading = role === 'developer' ? setIsDevLoading : setIsBetaLoading;
        setLoading(true);
        setError(null);
        try {
            await setUserRole(profile.id, role, newStatus);
            onUpdate({ [role]: newStatus });
        } catch (err: any) {
            setError(err.message || `Failed to update ${role} status.`);
        } finally {
            setLoading(false);
        }
    };

    const handleBanUser = async () => {
        setIsBanning(true);
        setError(null);
        try {
            await banUser(profile.id);
            setIsBanConfirmOpen(false);
            onBanned(); // Navigate away
        } catch (err: any) {
            setError(err.message || 'Failed to ban user.');
        } finally {
            setIsBanning(false);
        }
    };
    
    const ToggleSwitch: React.FC<{
        label: string;
        checked: boolean;
        onChange: (checked: boolean) => void;
        loading: boolean;
        color: 'yellow' | 'blue';
    }> = ({ label, checked, onChange, loading, color }) => {
        const colorClasses = {
            yellow: 'bg-yellow-500 focus:ring-yellow-400',
            blue: 'bg-blue-500 focus:ring-blue-400'
        };
        return (
            <div className="flex items-center justify-between">
                <label className="text-gray-300 font-medium">{label}</label>
                <div className="flex items-center gap-2">
                    {loading && <Loader size="sm" />}
                    <button
                        role="switch"
                        aria-checked={checked}
                        onClick={() => onChange(!checked)}
                        disabled={loading}
                        className={`${
                        checked ? colorClasses[color] : 'bg-gray-600'
                        } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50`}
                    >
                        <span aria-hidden="true" className={`${checked ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}/>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            {isBanConfirmOpen && (
                 <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-50 flex justify-center items-center p-4">
                    <Card className="max-w-md w-full border-red-500/50">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-500/20 rounded-full">
                                <ShieldOffIcon className="w-6 h-6 text-red-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Ban User</h3>
                        </div>
                         {error && <p className="bg-red-500/20 text-red-300 text-sm p-3 rounded-md my-4">{error}</p>}
                        <p className="text-gray-300 mb-6">
                            Are you sure you want to ban <span className="font-semibold text-white">{profile.username}</span>?
                            This will permanently delete all of their trades and watchlist items, and they will be removed from leaderboards. This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-4">
                            <Button variant="secondary" onClick={() => setIsBanConfirmOpen(false)} disabled={isBanning}>
                                Cancel
                            </Button>
                            <Button
                                className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                                onClick={handleBanUser}
                                disabled={isBanning}
                            >
                                {isBanning ? <Loader size="sm" /> : 'Confirm & Ban User'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
            <Card className="border-yellow-500/30">
                <h3 className="text-xl font-bold text-white mb-4">Admin Controls</h3>
                 {error && <p className="bg-red-500/20 text-red-300 text-sm p-3 rounded-md mb-4">{error}</p>}
                <div className="space-y-4">
                    <ToggleSwitch label="Developer" checked={!!profile.developer} onChange={(status) => handleRoleChange('developer', status)} loading={isDevLoading} color="yellow" />
                    <ToggleSwitch label="Beta Tester" checked={!!profile.beta_tester} onChange={(status) => handleRoleChange('beta_tester', status)} loading={isBetaLoading} color="blue" />
                    
                    <div className="pt-4 border-t border-gray-700/50">
                         <Button
                            variant="ghost"
                            className="w-full justify-center text-red-400 hover:bg-red-500/20 hover:text-red-300"
                            onClick={() => setIsBanConfirmOpen(true)}
                        >
                            <SlashIcon className="w-5 h-5 mr-2" />
                            Ban User
                        </Button>
                    </div>
                </div>
            </Card>
        </>
    );
};


export const ProfilePage: React.FC<ProfilePageProps> = ({ profile, viewerProfile, onBack, totalProfit, isOwnProfile, onNavigateToStats, onProfileUpdate }) => {
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState(false);
  
  if (!profile) {
    return null; // Should not happen if parent component handles this
  }

  const isViewerDeveloper = viewerProfile?.developer ?? false;
  const canManageUser = isViewerDeveloper && !isOwnProfile;

  const rank = getRankForLevel(profile.level);
  const xpForCurrentLevel = getTotalXpForLevel(profile.level);
  const xpForNextLevel = profile.level < 99 ? getTotalXpForLevel(profile.level + 1) : xpForCurrentLevel;
  const xpInCurrentLevel = profile.xp - xpForCurrentLevel;
  const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
  const levelProgress = xpNeededForNextLevel > 0 ? (xpInCurrentLevel / xpNeededForNextLevel) * 100 : 100;

  if (profile.banned) {
      return (
          <div className="text-center py-20 flex flex-col items-center">
              <ShieldOffIcon className="w-24 h-24 text-red-500 mb-4" />
              <h1 className="text-4xl font-bold text-white">User Banned</h1>
              <p className="text-gray-400 mt-2">This user's account has been suspended.</p>
               <Button onClick={onBack} variant="secondary" className="mt-8">
                    <ArrowLeftIcon className="w-5 h-5 mr-2" />
                    Go Back
                </Button>
          </div>
      );
  }

  return (
    <>
      {isAchievementsModalOpen && (
        <AchievementsModal profile={profile} onClose={() => setIsAchievementsModalOpen(false)} />
      )}
      <div>
        <div className="flex items-center gap-4 mb-8">
          <Button onClick={onBack} variant="ghost" size="icon" className="mr-2 self-start">
              <ArrowLeftIcon className="w-6 h-6" />
          </Button>
          <UserIcon className="w-16 h-16 p-3 bg-gray-800 text-emerald-400 rounded-full border-2 border-gray-700"/>
          <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-4xl font-bold text-white">{profile.username}</h1>
                  {profile.login_streak > 0 && (
                      <span className="relative group flex items-center gap-1.5 self-center bg-orange-500/20 text-orange-400 border border-orange-500/50 rounded-full px-3 py-1 text-xs font-bold cursor-pointer">
                          <FlameIcon className="w-4 h-4" />
                          <span>{profile.login_streak}</span>
                          {/* Tooltip */}
                          <div 
                              className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max
                                        bg-gray-800 text-white text-xs font-semibold
                                        rounded-md py-1.5 px-3 shadow-lg border border-gray-700/50
                                        opacity-0 group-hover:opacity-100 transition-opacity duration-200
                                        pointer-events-none z-10"
                              role="tooltip"
                          >
                              Current login streak: {profile.login_streak} day{profile.login_streak !== 1 ? 's' : ''}
                              {/* Arrow pointing down */}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 transform rotate-45 border-b border-r border-gray-700/50"></div>
                          </div>
                      </span>
                  )}
                  {profile.developer && (
                      <span className="flex items-center gap-1.5 self-center bg-yellow-400/20 text-yellow-300 border border-yellow-500/50 rounded-full px-3 py-1 text-xs font-bold" title="This user is a GE Pulse developer">
                          <CodeIcon className="w-4 h-4" />
                          <span>Developer</span>
                      </span>
                  )}
                  {profile.beta_tester && (
                      <span className="flex items-center gap-1.5 self-center bg-blue-400/20 text-blue-300 border border-blue-500/50 rounded-full px-3 py-1 text-xs font-bold" title="This user is a Beta Tester">
                          <ShieldCheckIcon className="w-4 h-4" />
                          <span>Beta Tester</span>
                      </span>
                  )}
              </div>
              <p className="text-lg text-gray-300 font-semibold">{rank}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Card className="lg:col-span-2">
              <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-bold text-white">Level {profile.level}</p>
                  {profile.level < 99 && (
                      <p className="text-sm text-gray-400">{xpInCurrentLevel.toLocaleString()} / {xpNeededForNextLevel.toLocaleString()} XP</p>
                  )}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-4 border border-gray-600">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{width: `${levelProgress}%`}}></div>
              </div>
              <div className="mt-4 flex items-center gap-6">
                  <div>
                      <p className="text-sm text-gray-400">Total XP</p>
                      <p className="text-xl font-bold text-white">{profile.xp.toLocaleString()}</p>
                  </div>
                  <div>
                      <p className="text-sm text-gray-400">Total Realised Profit</p>
                      <p className="text-xl font-bold">
                          <ProfitText value={totalProfit} />
                      </p>
                  </div>
              </div>
            </Card>
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Trophy Case</h3>
                    <Button variant="secondary" size="sm" onClick={() => setIsAchievementsModalOpen(true)}>View All</Button>
                </div>
                <div className="text-center text-gray-500 py-4 flex flex-col items-center justify-center">
                    <TrophyIcon className="w-8 h-8 mb-2" />
                    <p>No achievements earned yet.</p>
                    <p className="text-xs mt-1">Click "View All" to see your progress!</p>
                </div>
            </Card>
        </div>
        
        <div className="flex items-center gap-4 mb-3">
              {isOwnProfile && profile.developer && (
                  <Button
                      onClick={onNavigateToStats}
                      variant="secondary"
                      size="sm"
                      className="self-center md:hidden"
                  >
                      <BarChartIcon className="w-4 h-4 mr-2" />
                      Stats
                  </Button>
              )}
          </div>

        {canManageUser && (
            <div className="mt-8">
                <AdminControls profile={profile} onUpdate={onProfileUpdate} onBanned={onBack} />
            </div>
        )}
      </div>
    </>
  );
};