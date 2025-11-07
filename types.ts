

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
  priceType: 'high' | 'low';
}

export interface Profile {
  id: string;
  username: string | null;
  developer: boolean;
  beta_tester: boolean;
  banned: boolean;
  premium: boolean;
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
// FIX: Updated `webSources` type to allow optional `uri` and `title` properties,
// matching the structure returned by the Gemini API's `groundingChunks`.
export interface FlippingSuggestion {
    itemId: number;
    itemName: string;
    buyPrice: number;
    sellPrice: number;
    netMarginPerItem: number;
    potentialProfit: number;
    justification: string;
    confidenceScore: number; // Numerical score from 0-100
    riskLevel: 'High' | 'Medium' | 'Low';
    riskJustification: string; // Single sentence explaining the risk
    flipVelocity: 'Very High' | 'High' | 'Medium' | 'Low';
    webSources?: {
      web?: {
        uri?: string;
        title?: string;
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

// --- Community Feed Types ---
export interface FlipData {
  item_id: number;
  item_name: string;
  quantity: number;
  purchase_price: number;
  sell_price: number;
  profit: number;
  roi: number; // Return on Investment
}

export interface Post {
  id: string;
  user_id: string;
  created_at: string;
  title: string | null;
  content: string | null;
  flip_data: FlipData | null;
  profiles: { // For author info
    username: string | null;
    level: number;
    premium: boolean;
  };
  comment_count: number;
}

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  parent_comment_id: string | null;
  profiles: { // For author info
    username: string | null;
    level: number;
    premium: boolean;
  };
  replies?: Comment[]; // Added on client-side
}