



import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabase';
import { fetchItemMapping, fetchTimeseries, fetchLatestPrices, fetch1hPrices, fetch24hPrices } from './services/osrsWikiApi';
import { fetchUserWatchlist, addToWatchlist, removeFromWatchlist, getProfile, fetchUserInvestments, addInvestment, closeInvestment, clearUserInvestments, deleteInvestment, getProfileByUsername, fetchAppStats, recordLogin, recordActivity, processClosedTrade, spendAiToken, processMultipleSales, updateInvestment } from './services/database';
import type { Item, TimeseriesData, LatestPrice, Profile, PriceAlert, Investment, AggregatePrice, LeaderboardEntry, AppStats, ProgressionNotification, ProgressionNotificationData } from './types';
import { HomePage } from './components/HomePage';
import { ItemView } from './components/ItemView';
import { Watchlist } from './components/Watchlist';
import { AlertsPage } from './components/AlertsPage';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { ProfilePage } from './components/ProfilePage';
import { PortfolioPage } from './components/PortfolioPage';
import { MarketActivityPage } from './components/TopMoversPage';
import { CommunityPage } from './components/CommunityPage';
import { AddInvestmentModal } from './components/AddInvestmentModal';
import { StatsPage } from './components/StatsPage';
import { FlippingAssistantPage } from './components/FlippingAssistantPage';
import { PremiumPage } from './components/PremiumPage';
import { PulseIcon, HomeIcon, StarIcon, UserIcon, LogOutIcon, SettingsIcon, UserSquareIcon, BellIcon, LogInIcon, BriefcaseIcon, TrendingUpIcon, UsersIcon, BarChartIcon, BotIcon } from './components/icons/Icons';
import { Loader } from './components/ui/Loader';
import { Button } from './components/ui/Button';
import { useLocalStorage } from './hooks/useLocalStorage';
import { TooltipWrapper } from './components/ui/Tooltip';
import { ProgressionNotifications } from './components/ProgressionNotifications';


type View = 'home' | 'watchlist' | 'item' | 'profile' | 'alerts' | 'portfolio' | 'market' | 'community' | 'stats' | 'assistant' | 'premium';
type ProfileWithEmail = Profile & { email: string | null };
type ViewedProfileData = { profile: Profile; profit: number };

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [items, setItems] = useState<Record<string, Item>>({});
  const [latestPrices, setLatestPrices] = useState<Record<string, LatestPrice>>({});
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isItemLoading, setIsItemLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Auth and Profile State ---
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileWithEmail | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [viewedProfileData, setViewedProfileData] = useState<ViewedProfileData | null>(null);
  const initialRoutingDone = useRef(false);

  // --- Progression System State ---
  const [notifications, setNotifications] = useState<ProgressionNotification[]>([]);
  const loggedInSince = useRef<number | null>(null);

  // --- Watchlist, Alerts, and Portfolio State ---
  const [watchlist, setWatchlist] = useState<number[]>([]);
  const [alerts, setAlerts] = useLocalStorage<PriceAlert[]>('priceAlerts', []);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [watchlistTimeseries, setWatchlistTimeseries] = useState<Record<string, TimeseriesData[]>>({});
  const [isAddInvestmentModalOpen, setIsAddInvestmentModalOpen] = useState(false);
  const [investmentModalItem, setInvestmentModalItem] = useState<Item | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useLocalStorage<number[]>('recentlyViewed', []);

  // --- Top Movers State ---
  const [oneHourPrices, setOneHourPrices] = useState<Record<string, AggregatePrice>>({});
  const [twentyFourHourPrices, setTwentyFourHourPrices] = useState<Record<string, AggregatePrice>>({});
  const [isMoversLoading, setIsMoversLoading] = useState(false);
  
  // --- Developer Stats State ---
  // State for stats is now managed inside StatsPage.tsx

  // --- Progression Notification Handlers ---
  const addNotifications = useCallback((progressionEvents: ProgressionNotificationData[]) => {
    const newNotifs = progressionEvents.map(data => ({ id: crypto.randomUUID(), data }));
    setNotifications(prev => [...prev, ...newNotifs]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleSetAlertActivity = useCallback(async () => {
    if (!session) {
      setIsAuthModalOpen(true);
      return;
    }
    const activityEvents = await recordActivity(session.user.id, 'alert_set');
    addNotifications(activityEvents);
  }, [session, addNotifications]);

  // Close profile menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If the menu isn't open, no need to do anything.
      if (!isProfileMenuOpen) return;
      // Check if the click occurred outside any element with the 'data-profile-menu-container' attribute.
      // This works for both the mobile and desktop menu containers.
      if (!(event.target as HTMLElement).closest('[data-profile-menu-container]')) {
          setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen]);

  // --- Supabase Auth & Profile Listener ---
  useEffect(() => {
    const fetchSessionAndProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session) {
            const userProfile = await getProfile(session.user.id);
            if (userProfile) {
              setProfile({ ...userProfile, email: session.user.email ?? null });
              if (!userProfile.username) {
                  setIsProfileModalOpen(true); // Prompt for username if not set
              }
            }
        }
    };

    fetchSessionAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setSession(session);
        if (session) {
            setIsAuthModalOpen(false); // Close auth modal on login
            const userProfile = await getProfile(session.user.id);
            if (userProfile) {
                setProfile({ ...userProfile, email: session.user.email ?? null });
                if (!userProfile.username) {
                    setIsProfileModalOpen(true);
                }
                // Record login and show notifications
                const now = Date.now();
                if (!loggedInSince.current || (now - loggedInSince.current > 1000 * 60 * 5)) { // Only if not logged in recently
                    loggedInSince.current = now;
                    const loginEvents = await recordLogin(session.user.id);
                    addNotifications(loginEvents);
                    // Refetch profile to get updated streak/xp
                    const updatedProfile = await getProfile(session.user.id);
                    if(updatedProfile) setProfile(p => ({...p, ...updatedProfile, email: session.user.email ?? null }));
                }

            } else {
                setProfile(null);
            }
        } else {
            setProfile(null);
            loggedInSince.current = null;
            setCurrentView('home'); // Go to home on logout
        }
    });

    return () => subscription.unsubscribe();
  }, [addNotifications]);
  
  // --- Fetch User Data (Watchlist, Investments) from DB on Login ---
  useEffect(() => {
    if (session) {
      const loadUserData = async () => {
        try {
          const [userWatchlist, userInvestments] = await Promise.all([
            fetchUserWatchlist(session.user.id),
            fetchUserInvestments(session.user.id)
          ]);
          setWatchlist(userWatchlist);
          setInvestments(userInvestments);
        } catch (err) {
          console.error("Failed to load user data", err);
        }
      };
      loadUserData();
    } else {
      setWatchlist([]);
      setInvestments([]);
    }
  }, [session]);

  // --- Fetch Watchlist Timeseries Data ---
  useEffect(() => {
    const fetchWatchlistTimeseries = async () => {
      if (watchlist.length === 0) {
        setWatchlistTimeseries({});
        return;
      }

      const itemsToFetch = watchlist.filter(id => watchlistTimeseries[id] === undefined);
      if (itemsToFetch.length === 0) return;

      const results = await Promise.allSettled(
        itemsToFetch.map(id => fetchTimeseries(id, '1h'))
      );
      
      const newTimeseries: Record<string, TimeseriesData[]> = {};
      results.forEach((result, index) => {
        const itemId = itemsToFetch[index];
        if (result.status === 'fulfilled') {
          newTimeseries[itemId] = result.value.sort((a, b) => a.timestamp - b.timestamp);
        } else {
          console.error(`Failed to fetch timeseries for item ${itemId}:`, result.reason);
          newTimeseries[itemId] = []; // Mark as failed/empty
        }
      });
      
      setWatchlistTimeseries(prev => ({ ...prev, ...newTimeseries }));
    };

    if (currentView === 'watchlist') {
      fetchWatchlistTimeseries();
    }
  }, [currentView, watchlist, watchlistTimeseries]);

  // --- Fetch Top Movers Data ---
  useEffect(() => {
      const loadMoversData = async () => {
          if ((currentView === 'home' || currentView === 'market' || currentView === 'assistant' || currentView === 'item') && (Object.keys(oneHourPrices).length === 0 || Object.keys(twentyFourHourPrices).length === 0)) {
              setIsMoversLoading(true);
              setError(null);
              try {
                  const [oneHour, twentyFourHour] = await Promise.all([
                      fetch1hPrices(),
                      fetch24hPrices()
                  ]);
                  setOneHourPrices(oneHour);
                  setTwentyFourHourPrices(twentyFourHour);
              } catch (err) {
                  console.error("Failed to load movers data", err);
                  setError("Failed to load Top Movers data. Please try again later.");
              } finally {
                  setIsMoversLoading(false);
              }
          }
      };
      loadMoversData();
  }, [currentView, oneHourPrices, twentyFourHourPrices]);


  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        const [itemMapping, prices] = await Promise.all([fetchItemMapping(), fetchLatestPrices()]);
        
        const itemMap: Record<string, Item> = {};
        itemMapping.forEach(item => {
            itemMap[item.id] = item;
        });
        
        setItems(itemMap);
        setLatestPrices(prices);
      } catch (err) {
        setError('Failed to load initial item data. Please try refreshing the page.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    initializeData();
  }, []);
  
  const handleSelectTimedItem = useCallback(async (item: Item, timeStep: '5m' | '1h' | '6h' = '1h') => {
    setIsItemLoading(true);
    setSelectedItem(item);
    setCurrentView('item');
    
    // Add to recently viewed
    setRecentlyViewed(prev => {
        const newRecentlyViewed = [item.id, ...prev.filter(id => id !== item.id)];
        return newRecentlyViewed.slice(0, 6); // Keep only the last 6
    });

    try {
      const data = await fetchTimeseries(item.id, timeStep);
      const sortedData = data.sort((a, b) => a.timestamp - b.timestamp);
      setTimeseries(sortedData);
    } catch (err)      {
      setError(`Failed to load price data for ${item.name}.`);
      console.error(err);
    } finally {
      setIsItemLoading(false);
    }
  }, [setRecentlyViewed]);

  const handleItemSelection = useCallback((item: Item) => {
    handleSelectTimedItem(item);
  }, [handleSelectTimedItem]);
  
  // --- Initial Hash-based Routing ---
  useEffect(() => {
    // This effect runs once on page load after the initial data is fetched.
    // It checks for a URL hash like '#/item/123' to deep-link to an item.
    if (isLoading || Object.keys(items).length === 0 || initialRoutingDone.current) {
        return;
    }

    const hash = window.location.hash;
    if (hash.startsWith('#/item/')) {
        initialRoutingDone.current = true; // Mark as done to prevent re-routing on state changes
        const itemIdStr = hash.substring('#/item/'.length);
        const itemId = parseInt(itemIdStr, 10);
        if (!isNaN(itemId) && items[itemId]) {
            handleItemSelection(items[itemId]);
        }
    } else {
        // If there's no valid item hash, mark routing as done so we don't re-check
        initialRoutingDone.current = true;
    }
  }, [items, isLoading, handleItemSelection]);

  const switchView = (view: View) => {
    setCurrentView(view);
    // Clear item-specific state when navigating to a list view
    if (view !== 'item') {
        setSelectedItem(null);
        setTimeseries([]);
    }
    if (view !== 'profile') {
        setViewedProfileData(null);
    }
     // Close profile menu on navigation
    setIsProfileMenuOpen(false);
  };

  const showProfilePage = () => {
    if (!profile) return;
    const ownProfileForView: Profile = {
        id: profile.id,
        username: profile.username,
        developer: profile.developer,
        beta_tester: profile.beta_tester,
        banned: profile.banned,
        premium: profile.premium,
        xp: profile.xp,
        level: profile.level,
        login_streak: profile.login_streak,
        tokens: profile.tokens,
    };
    setViewedProfileData({ profile: ownProfileForView, profit: totalRealisedProfit });
    switchView('profile');
    setIsProfileMenuOpen(false);
  };

  const handleViewProfile = async (leaderboardEntry: LeaderboardEntry) => {
    if (!leaderboardEntry.username) return;
    // TODO: Add a loading state for profile viewing
    try {
        const userProfile = await getProfileByUsername(leaderboardEntry.username);
        if (userProfile) {
            setViewedProfileData({ profile: userProfile, profit: leaderboardEntry.total_profit });
            switchView('profile');
        } else {
            // TODO: Handle user not found error gracefully
            console.error("Profile not found for username:", leaderboardEntry.username);
        }
    } catch (error) {
        console.error("Failed to fetch profile:", error);
    }
  };

  const handleBack = () => {
    switchView('home');
  }

  const toggleWatchlist = useCallback(async (itemId: number) => {
    if (!session) {
      setIsAuthModalOpen(true);
      return;
    }
    if (profile && !profile.username) {
        setIsProfileModalOpen(true);
        return;
    }
    const isWatched = watchlist.includes(itemId);
    const userId = session.user.id;
    if (isWatched) {
      setWatchlist(prev => prev.filter(id => id !== itemId));
      try {
        await removeFromWatchlist(userId, itemId);
      } catch (err) {
        setWatchlist(prev => [...prev, itemId]);
      }
    } else {
      setWatchlist(prev => [...prev, itemId]);
      try {
        await addToWatchlist(userId, itemId);
        const activityEvents = await recordActivity(userId, 'watchlist_add');
        addNotifications(activityEvents);
      } catch (err) {
        setWatchlist(prev => prev.filter(id => id !== itemId));
      }
    }
  }, [session, profile, watchlist, addNotifications]);
  
  const watchlistItems = useMemo(() => {
    return watchlist.map(id => items[id]).filter(Boolean);
  }, [watchlist, items]);
  
  const totalRealisedProfit = useMemo(() => {
    let realisedProfit = 0;
    let totalTaxPaid = 0;
    
    const closedPositions = investments.filter(inv => inv.sell_price !== null);

    closedPositions.forEach(inv => {
        if(inv.sell_price !== null) {
            const purchaseValue = inv.purchase_price * inv.quantity;
            const sellValue = inv.sell_price * inv.quantity;
            realisedProfit += (sellValue - purchaseValue);
            totalTaxPaid += inv.tax_paid ?? 0;
        }
    });
    
    return realisedProfit - totalTaxPaid;
  }, [investments]);
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsProfileMenuOpen(false);
    switchView('home');
  };

  const handleProfileUpdate = (updatedProfile: Profile) => {
    setProfile(prev => prev ? { ...prev, ...updatedProfile } : null);
  };
  
  const handleAdminProfileUpdate = (updates: Partial<Profile>) => {
    setViewedProfileData(prev => {
        if (!prev) return null;
        return {
            ...prev,
            profile: { ...prev.profile, ...updates }
        };
    });
  };

  const handleOpenAddInvestmentModal = (item: Item) => {
    if (!session) {
      setIsAuthModalOpen(true);
      return;
    }
    setInvestmentModalItem(item);
    setIsAddInvestmentModalOpen(true);
  };

  const handleSaveInvestment = async (investmentData: Omit<Investment, 'id' | 'user_id' | 'created_at'>) => {
    if (!session) throw new Error("User not authenticated");
    try {
        const newInvestment = await addInvestment({ ...investmentData, user_id: session.user.id });
        setInvestments(prev => [newInvestment, ...prev]);
    } catch (error) {
        console.error("Failed to save investment:", error);
        // Re-throw the error so the modal can catch it and handle its UI state (e.g., stop loading, show message).
        throw error;
    }
  };

  const handleUpdateInvestment = async (investmentId: string, updates: Partial<Pick<Investment, 'quantity' | 'purchase_price' | 'purchase_date'>>) => {
    if (!session) throw new Error("User not authenticated");
    try {
        const updatedInvestment = await updateInvestment(investmentId, updates);
        setInvestments(prev =>
            prev.map(inv => (inv.id === investmentId ? updatedInvestment : inv))
        );
    } catch (error) {
        console.error("Failed to update investment:", error);
        throw error;
    }
  };

  const handleCloseInvestment = async (investmentId: string, sales: Array<{ quantity: number; sell_price: number; sell_date: string; tax_paid: number }>) => {
    const originalInvestment = investments.find(inv => inv.id === investmentId);
    if (!originalInvestment) throw new Error("Investment not found");

    const { updatedOriginal, newClosed } = await processMultipleSales(originalInvestment, sales);
    
    setInvestments(prev => {
        const index = prev.findIndex(inv => inv.id === investmentId);
        const newInvestments = [...prev];
        const newEntries = newClosed.filter((i): i is Investment => i !== null);
        
        if (updatedOriginal) { // If it was updated (partial sale)
            newInvestments.splice(index, 1, updatedOriginal, ...newEntries);
        } else { // If it was deleted (full sale)
            newInvestments.splice(index, 1, ...newEntries);
        }
        return newInvestments;
    });

    if (session) {
        const totalProfit = sales.reduce((sum, s) => {
            const purchaseValue = originalInvestment.purchase_price * s.quantity;
            const sellValue = s.sell_price * s.quantity;
            return sum + (sellValue - purchaseValue - s.tax_paid);
        }, 0);
        const totalTradeValue = sales.reduce((sum, s) => sum + (s.sell_price * s.quantity), 0);
        
        const progressionEvents = await processClosedTrade(session.user.id, totalProfit, totalTradeValue);
        addNotifications(progressionEvents);
         // Refetch profile to get updated xp/level
        const updatedProfile = await getProfile(session.user.id);
        if(updatedProfile) setProfile(p => ({...p, ...updatedProfile, email: session.user.email ?? null }));
    }
  };

  const handleClearPortfolio = async () => {
    if (!session) throw new Error("User not authenticated");
    await clearUserInvestments(session.user.id);
    setInvestments([]);
  };

  const handleDeleteInvestment = async (investmentId: string) => {
    if (!session) {
      setIsAuthModalOpen(true);
      // It's crucial to throw here so the calling function's catch block is triggered,
      // preventing the UI from getting stuck in a loading state or mis-representing success.
      throw new Error("User is not authenticated. Please log in.");
    }
    // The try-catch is (and should be) handled in PortfolioPage.tsx where the action is initiated.
    // This function will propagate the error from deleteInvestment if it fails.
    await deleteInvestment(investmentId);
    // Only update state if the deletion was successful
    setInvestments(prev => prev.filter(inv => inv.id !== investmentId));
  };

  const handleSpendToken = async () => {
    if (!session) throw new Error("User not authenticated");
    try {
        const newTokens = await spendAiToken(session.user.id);
        setProfile(prev => (prev ? { ...prev, tokens: newTokens } : null));
    } catch (error) {
        console.error("Failed to spend token:", error);
        // Refetch profile to ensure UI is in sync with the database, especially on failure
        const userProfile = await getProfile(session.user.id);
        if (userProfile) {
            setProfile(p => ({ ...(p as ProfileWithEmail), ...userProfile, email: session.user.email ?? null }));
        }
        throw error; // Re-throw so the calling component can handle the UI feedback
    }
  };

  const handleRefreshPrices = useCallback(async () => {
    try {
        const prices = await fetchLatestPrices();
        setLatestPrices(prices);
    } catch (err) {
        console.error("Failed to refresh prices", err);
        setError("Failed to refresh latest prices. Please try again later.");
    }
  }, []);

  const getNavButtonClasses = (viewName: View, disabled = false) => {
    const base = 'flex items-center justify-start gap-3 px-4 py-2 rounded-lg transition-colors w-full text-left';
    if (disabled) {
        return `${base} text-gray-500 cursor-not-allowed`;
    }
    if (currentView === viewName) {
        return `${base} bg-emerald-500/20 text-emerald-300`;
    }
    return `${base} hover:bg-gray-700/50`;
  };

  const getMobileNavButtonClasses = (viewName: View, disabled = false) => {
    const base = 'flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-colors w-full text-xs';
    if (disabled) {
      return `${base} text-gray-600`;
    }
    if (currentView === viewName) {
      return `${base} text-emerald-300`;
    }
    return `${base} text-gray-400 hover:bg-gray-700/50 hover:text-white`;
  };

  const MobileProfileMenu = () => (
    <>
      {isProfileMenuOpen && profile && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-30 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700/50">
            <p className="font-semibold text-white truncate flex items-center gap-2">
              <span>{profile.username}</span>
              {profile.premium && <StarIcon className="w-4 h-4 text-yellow-400" />}
            </p>
            <p className="text-sm text-gray-400">Level {profile.level}</p>
          </div>
          <div className="px-4 py-2 border-b border-gray-700/50">
            <div className="flex justify-between items-center text-gray-300">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <BotIcon className="w-5 h-5 text-emerald-400" />
                    <span>AI Tokens</span>
                </div>
                <span className="font-semibold text-base text-white bg-gray-700/60 px-2.5 py-1 rounded-md">{profile.tokens}</span>
            </div>
          </div>
          <div className="py-1">
            {!profile.premium && (
              <button onClick={() => { switchView('premium'); setIsProfileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-yellow-300 hover:bg-gray-700/50 rounded-md">
                <StarIcon className="w-5 h-5" />
                <span>Get Premium</span>
              </button>
            )}
            <button onClick={showProfilePage} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50 rounded-md">
              <UserSquareIcon className="w-5 h-5" />
              <span>My Profile</span>
            </button>
            <button onClick={() => switchView('alerts')} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50 rounded-md">
              <BellIcon className="w-5 h-5" />
              <span>Price Alerts</span>
            </button>
            <button onClick={() => { setIsProfileModalOpen(true); setIsProfileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50 rounded-md">
              <SettingsIcon className="w-5 h-5" />
              <span>Profile Settings</span>
            </button>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-gray-700/50 rounded-md">
              <LogOutIcon className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setIsProfileMenuOpen(prev => !prev)}
        className="flex items-center justify-center"
        disabled={isProfileModalOpen}
      >
        <UserIcon className="w-8 h-8 p-1 bg-emerald-500/20 text-emerald-300 rounded-full" />
      </button>
    </>
  );

  const renderContent = () => {
    if (isLoading && !initialRoutingDone.current) {
      return <div className="flex justify-center items-center h-full pt-20"><Loader /></div>;
    }
    if (error && !['item', 'market'].includes(currentView)) {
      return <div className="text-center text-red-400 mt-8">{error}</div>;
    }
    
    switch (currentView) {
      case 'item':
        if (!selectedItem) return null;
        return (
          <ItemView
            item={selectedItem}
            latestPrice={latestPrices[selectedItem.id]}
            timeseriesData={timeseries}
            isLoading={isItemLoading}
            onBack={handleBack}
            onRefresh={handleSelectTimedItem}
            watchlist={watchlist}
            toggleWatchlist={toggleWatchlist}
            alerts={alerts}
            setAlerts={setAlerts}
            onOpenAddInvestmentModal={handleOpenAddInvestmentModal}
            onSetAlertActivity={handleSetAlertActivity}
            profile={profile}
            onSpendToken={handleSpendToken}
            oneHourPrices={oneHourPrices}
            twentyFourHourPrices={twentyFourHourPrices}
          />
        );
      case 'home':
        return <HomePage 
                    items={Object.values(items)} 
                    onSelectItem={handleItemSelection} 
                    latestPrices={latestPrices}
                    recentlyViewedIds={recentlyViewed}
                    allItems={items}
                    onClearRecentlyViewed={() => setRecentlyViewed([])}
                    twentyFourHourPrices={twentyFourHourPrices}
                    isMoversLoading={isMoversLoading}
                />;
      case 'market':
        return <MarketActivityPage 
                 items={Object.values(items)}
                 latestPrices={latestPrices}
                 oneHourPrices={oneHourPrices}
                 twentyFourHourPrices={twentyFourHourPrices}
                 isLoading={isMoversLoading}
                 onSelectItem={handleItemSelection}
                 error={error}
               />;
      case 'assistant':
        return <FlippingAssistantPage 
                  items={items}
                  latestPrices={latestPrices}
                  oneHourPrices={oneHourPrices}
                  twentyFourHourPrices={twentyFourHourPrices}
                  isLoading={isMoversLoading}
                  onSelectItem={handleItemSelection}
                  error={error}
                  profile={profile}
                  onSpendToken={handleSpendToken}
               />;
      case 'community':
        return <CommunityPage onViewProfile={handleViewProfile} />;
      case 'watchlist':
        return <Watchlist 
                  items={watchlistItems} 
                  onSelectItem={handleItemSelection} 
                  latestPrices={latestPrices} 
                  timeseries={watchlistTimeseries}
                  toggleWatchlist={toggleWatchlist}
               />;
      case 'alerts':
        return <AlertsPage
                 alerts={alerts}
                 setAlerts={setAlerts}
                 items={items}
                 latestPrices={latestPrices}
                 onSelectItem={handleItemSelection}
               />;
      case 'portfolio':
        return <PortfolioPage 
                  investments={investments}
                  items={items}
                  latestPrices={latestPrices}
                  onCloseInvestment={handleCloseInvestment}
                  onClearPortfolio={handleClearPortfolio}
                  onDeleteInvestment={handleDeleteInvestment}
                  onEditInvestment={handleUpdateInvestment}
                  onRefreshPrices={handleRefreshPrices}
                  onSelectItem={handleItemSelection}
                />;
      case 'profile':
        if (!viewedProfileData) return null;
        return <ProfilePage
                  key={viewedProfileData.profile.id}
                  profile={viewedProfileData.profile}
                  viewerProfile={profile}
                  onBack={handleBack}
                  totalProfit={viewedProfileData.profit}
                  isOwnProfile={viewedProfileData.profile.id === session?.user.id}
                  onNavigateToStats={() => switchView('stats')}
                  onProfileUpdate={handleAdminProfileUpdate}
               />
      case 'stats':
        if (!profile?.developer) {
          switchView('home'); // Redirect non-devs
          return null;
        }
        return <StatsPage />;
      case 'premium':
        return <PremiumPage onBack={handleBack} />;
      default:
        return null;
    }
  };

  return (
    <>
      {isAuthModalOpen && !session && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
      {isProfileModalOpen && profile && (
        <ProfileModal
            profile={profile}
            onClose={() => setIsProfileModalOpen(false)}
            onProfileUpdate={handleProfileUpdate}
        />
      )}
      {isAddInvestmentModalOpen && investmentModalItem && (
        <AddInvestmentModal
          item={investmentModalItem}
          latestPrice={latestPrices[investmentModalItem.id]}
          onClose={() => setIsAddInvestmentModalOpen(false)}
          onSave={handleSaveInvestment}
        />
      )}
      <ProgressionNotifications notifications={notifications} onRemove={removeNotification} />
      
      <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col md:flex-row">
        
        {/* --- DESKTOP SIDEBAR --- */}
        <header className="hidden md:w-64 bg-gray-800/50 backdrop-blur-sm md:p-6 md:h-screen md:flex md:flex-col md:border-r md:border-gray-700/50">
          <div className="flex items-center gap-3 mb-8 px-4 pt-6 md:p-0">
            <PulseIcon className="w-8 h-8 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white tracking-tighter">GE Pulse</h1>
          </div>
          <nav className="flex-col gap-2 hidden md:flex">
            <button onClick={() => switchView('home')} className={getNavButtonClasses('home')}>
              <HomeIcon className="w-5 h-5" />
              <span className="font-medium">Home</span>
            </button>
            <button onClick={() => switchView('market')} className={getNavButtonClasses('market')}>
              <TrendingUpIcon className="w-5 h-5" />
              <span className="font-medium">Market Activity</span>
            </button>
             <TooltipWrapper text="Login to use the AI Assistant" show={!session}>
              <button onClick={() => switchView('assistant')} disabled={!session} className={getNavButtonClasses('assistant', !session)}>
                <BotIcon className="w-5 h-5" />
                <span className="font-medium">AI Assistant</span>
              </button>
            </TooltipWrapper>
            <button onClick={() => switchView('community')} className={getNavButtonClasses('community')}>
              <UsersIcon className="w-5 h-5" />
              <span className="font-medium">Community</span>
            </button>
            <TooltipWrapper text="Login to use your Watchlist" show={!session}>
              <button onClick={() => switchView('watchlist')} disabled={!session} className={getNavButtonClasses('watchlist', !session)}>
                <StarIcon className="w-5 h-5" />
                <span className="font-medium">Watchlist</span>
              </button>
            </TooltipWrapper>
            <TooltipWrapper text="Login to track your Portfolio" show={!session}>
              <button onClick={() => switchView('portfolio')} disabled={!session} className={getNavButtonClasses('portfolio', !session)}>
                <BriefcaseIcon className="w-5 h-5" />
                <span className="font-medium">Portfolio</span>
              </button>
            </TooltipWrapper>
            <TooltipWrapper text="Login to set Price Alerts" show={!session}>
              <button onClick={() => switchView('alerts')} disabled={!session} className={getNavButtonClasses('alerts', !session)}>
                <BellIcon className="w-5 h-5" />
                <span className="font-medium">Alerts</span>
              </button>
            </TooltipWrapper>
            {profile && !profile.premium && (
                <button onClick={() => switchView('premium')} className="flex items-center justify-start gap-3 px-4 py-2 rounded-lg transition-colors w-full text-left bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 mt-2 border border-yellow-500/20">
                    <StarIcon className="w-5 h-5" />
                    <span className="font-medium">Get Premium</span>
                </button>
            )}
            {profile?.developer && (
                <button onClick={() => switchView('stats')} className={getNavButtonClasses('stats')}>
                    <BarChartIcon className="w-5 h-5" />
                    <span className="font-medium">Stats</span>
                </button>
            )}
          </nav>
          
          <div className="mt-auto hidden md:block">
            {session && profile && (
              <div className="px-4 pb-4">
                  <div className="flex justify-between items-center text-gray-300">
                      <div className="flex items-center gap-2 text-sm font-medium">
                          <BotIcon className="w-5 h-5 text-emerald-400" />
                          <span>AI Tokens</span>
                      </div>
                      <span className="font-semibold text-base text-white bg-gray-700/60 px-2.5 py-1 rounded-md">{profile.tokens}</span>
                  </div>
              </div>
            )}
            <div className="pt-4 border-t border-gray-700/50 relative" data-profile-menu-container>
              {session && profile ? (
                <>
                  {isProfileMenuOpen && (
                    <div className="absolute bottom-full mb-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1">
                      <button onClick={showProfilePage} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50 rounded-md">
                        <UserSquareIcon className="w-5 h-5" />
                        <span>My Profile</span>
                      </button>
                      <button onClick={() => { setIsProfileModalOpen(true); setIsProfileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50 rounded-md">
                        <SettingsIcon className="w-5 h-5" />
                        <span>Profile Settings</span>
                      </button>
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-gray-700/50 rounded-md">
                        <LogOutIcon className="w-5 h-5" />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setIsProfileMenuOpen(prev => !prev)}
                    className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-700/50"
                    disabled={isProfileModalOpen}
                  >
                    <UserIcon className="w-8 h-8 p-1.5 bg-emerald-500/20 text-emerald-300 rounded-full"/>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium text-sm truncate text-white flex items-center gap-1.5">
                        <span>{profile.username || profile.email}</span>
                        {profile.premium && <StarIcon className="w-3 h-3 text-yellow-400" />}
                      </p>
                      <p className="text-xs text-gray-400">Level {profile.level}</p>
                    </div>
                  </button>
                </>
              ) : !session ? (
                  <Button onClick={() => setIsAuthModalOpen(true)} variant="secondary" className="w-full justify-center">
                    <LogInIcon className="w-5 h-5 md:mr-2" />
                    <span>Login / Sign Up</span>
                  </Button>
              ) : (
                  <div className="flex items-center justify-center h-10">
                      <Loader size="sm" />
                  </div>
              )}
            </div>
          </div>
        </header>
        
        {/* --- MAIN CONTENT & MOBILE TOP BAR WRAPPER --- */}
        <div className="flex-1 flex flex-col w-full md:w-auto">
            {/* --- MOBILE TOP BAR --- */}
            <header className="md:hidden flex justify-between items-center p-4 bg-gray-800/70 backdrop-blur-sm sticky top-0 z-20 border-b border-gray-700/50">
              <div className="flex items-center gap-3">
                <PulseIcon className="w-8 h-8 text-emerald-400" />
                <h1 className="text-xl font-bold text-white tracking-tighter">GE Pulse</h1>
              </div>
              <div className="relative" data-profile-menu-container>
                {session && profile ? (
                  <MobileProfileMenu />
                ) : !session ? (
                  <Button onClick={() => setIsAuthModalOpen(true)} variant="secondary" size="sm" className="px-3 py-1.5">
                    Login
                  </Button>
                ) : <Loader size="sm" />}
              </div>
            </header>

            <main className="flex-1 p-4 md:p-8 overflow-y-auto pb-24 md:pb-8">
              {renderContent()}
              <footer className="mt-16 pt-6 border-t border-gray-700/50 text-center text-xs text-gray-500">
                <p className="font-semibold">GE Pulse - Beta V1.0</p>
                <p className="mt-2">
                  Not affiliated with Jagex Ltd. All item data and images are sourced from the OSRS Wiki.
                </p>
              </footer>
            </main>
        </div>
      </div>

      {/* --- MOBILE BOTTOM NAV --- */}
      <nav className="md:hidden grid grid-cols-5 gap-1 p-2 bg-gray-800/70 backdrop-blur-sm fixed bottom-0 left-0 right-0 z-20 border-t border-gray-700/50">
        <button onClick={() => switchView('home')} className={getMobileNavButtonClasses('home')}>
            <HomeIcon className="w-5 h-5" />
            <span>Home</span>
        </button>
        <button onClick={() => switchView('market')} className={getMobileNavButtonClasses('market')}>
            <TrendingUpIcon className="w-5 h-5" />
            <span>Market</span>
        </button>
         <button onClick={() => session ? switchView('assistant') : setIsAuthModalOpen(true)} className={getMobileNavButtonClasses('assistant', !session)}>
            <BotIcon className="w-5 h-5" />
            <span>AI</span>
        </button>
        <button onClick={() => session ? switchView('watchlist') : setIsAuthModalOpen(true)} className={getMobileNavButtonClasses('watchlist', !session)}>
            <StarIcon className="w-5 h-5" />
            <span>Watchlist</span>
        </button>
        <button onClick={() => session ? switchView('portfolio') : setIsAuthModalOpen(true)} className={getMobileNavButtonClasses('portfolio', !session)}>
            <BriefcaseIcon className="w-5 h-5" />
            <span>Portfolio</span>
        </button>
      </nav>
    </>
  );
}