

export interface Item {
  id: number;
  name: string;
  examine: string;
  icon: string;
  members: boolean;
  lowalch: number;
  highalch: number;
  limit: number;
  value: number;
}

export interface TimeseriesData {
  timestamp: number;
  avgHighPrice: number | null;
  avgLowPrice: number | null;
  highPriceVolume: number;
  lowPriceVolume: number;
}

export interface LatestPrice {
  high: number | null;
  highTime: number | null;
  low: number | null;
  lowTime: number | null;
}

export interface AggregatePrice {
  avgHighPrice: number | null;
  avgLowPrice: number | null;
  highPriceVolume: number;
  lowPriceVolume: number;
}

export interface PriceAlert {
  itemId: number;
  targetPrice: number;
  condition: 'above' | 'below';
}

export interface Profile {
  id: string;
  username: string | null;
  developer: boolean;
  beta_tester: boolean;
  banned: boolean;
  // Progression fields
  xp: number;
  level: number;
  login_streak: number;
  tokens: number;
}

export interface Investment {
  id: string; // Using string for UUID from the database
  user_id: string;
  item_id: number;
  quantity: number;
  purchase_price: number;
  purchase_date: string; // Stored as ISO 8601 format string
  sell_price: number | null;
  sell_date: string | null; // Stored as ISO 8601 format string
  tax_paid: number | null;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  total_profit: number;
}

export type LeaderboardTimeRange = 'today' | 'month' | 'year' | 'all';
export type StatsTimeRange = 'today' | 'week' | 'month' | 'year' | 'all';


export interface AppStats {
  totalUsers: number;
  newUsers: number;
  totalInvestments: number; // Represents *new* investments in the period
  closedTrades: number;
  totalProfit: number;
  totalTax: number;
  totalWatchlistItems: number;
}

// --- Progression System Types ---

export interface Achievement {
    id: number;
    name: string;
    description: string;
    icon_name: string; // To dynamically select an icon component
    xp_reward: number;
    type: string | null;
    threshold: number | null;
}

export interface UserProgressStats {
  [key: string]: number;
}

export type ProgressionNotificationData =
  | { type: 'xp'; amount: number; reason: string }
  | { type: 'achievement'; achievement: Achievement }
  | { type: 'level_up'; newLevel: number }
  | { type: 'rank_up'; newRank: string };

export interface ProgressionNotification {
    id: string; // Unique ID for mapping and removal
    data: ProgressionNotificationData;
}

// --- AI Flipping Assistant Types ---
export interface FlippingSuggestion {
    itemId: number;
    itemName: string;
    buyPrice: number;
    sellPrice: number;
    netMarginPerItem: number;
    potentialProfit: number; // Renamed for clarity
    justification: string;
    confidence: 'High' | 'Medium' | 'Low';
    riskLevel: 'High' | 'Medium' | 'Low';
    flipVelocity: 'Very High' | 'High' | 'Medium' | 'Low';
    webSources?: {
      web?: {
        uri: string;
        title: string;
      }
    }[];
}

export interface HistoricAnalysis {
    id: string;
    date: string;
    suggestions: FlippingSuggestion[];
    params: {
        budget: string;
        strategy: 'balanced' | 'high_margin' | 'dip_buys' | 'momentum_plays';
        ignoreLowLimits: boolean;
    };
}

export interface ItemAnalysis {
    suggestion: 'Buy Now' | 'Watch' | 'Avoid' | 'Potential Quick Flip';
    confidence: 'High' | 'Medium' | 'Low';
    risk: 'High' | 'Medium' | 'Low';
    analysisText: string;
}