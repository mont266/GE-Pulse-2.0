import { supabase, Json } from './supabase';
import type { Profile, Investment, LeaderboardEntry, LeaderboardTimeRange, AppStats, StatsTimeRange, ProgressionNotificationData, Achievement, UserProgressStats, Post, FlipData, Comment, SearchedProfile } from '../types';

/**
 * Fetches the item IDs from the current user's watchlist.
 * @param userId The ID of the user.
 * @returns A promise that resolves to an array of item IDs.
 */
export const fetchUserWatchlist = async (userId: string): Promise<number[]> => {
    const { data, error } = await supabase
        .from('watchlists')
        .select('item_id')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching watchlist:', error);
        throw error;
    }
    // `data` can be null if no records are found, so we handle that case.
    return data ? data.map(item => item.item_id) : [];
};

/**
 * Adds a new item to the user's watchlist in the database.
 * @param userId The ID of the user.
 * @param itemId The ID of the item to add.
 * @returns A promise that resolves when the operation is complete.
 */
export const addToWatchlist = async (userId: string, itemId: number) => {
    const { error } = await supabase
        .from('watchlists')
        .insert({ user_id: userId, item_id: itemId });

    if (error) {
        console.error('Error adding to watchlist:', error);
        throw error;
    }
};

/**
 * Removes an item from the user's watchlist in the database.
 * @param userId The ID of the user.
 * @param itemId The ID of the item to remove.
 * @returns A promise that resolves when the operation is complete.
 */
export const removeFromWatchlist = async (userId: string, itemId: number) => {
    const { error, count } = await supabase
        .from('watchlists')
        .delete({ count: 'exact' })
        .match({ user_id: userId, item_id: itemId });

    if (error) {
        console.error('Error removing from watchlist:', error);
        throw error;
    }

    if (count === 0) {
        // Throwing an error ensures that the calling function's catch block is triggered,
        // allowing the UI to revert its optimistic update if the item was not actually deleted
        // on the backend (e.g., it was already removed in another tab).
        throw new Error(`Watchlist item with ID ${itemId} not found for deletion.`);
    }
};

/**
 * Fetches a user's profile data by their user ID.
 * @param userId The ID of the user.
 * @returns A promise that resolves to the user's profile or null if not found.
 */
export const getProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, developer, beta_tester, banned, xp, level, login_streak, tokens, premium')
      .eq('id', userId)
      .single();

    // "PGRST116" is the code for "exact one row expected" which means no profile was found.
    // We don't want to throw an error in that case, just return null.
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
      throw error;
    }

    return data;
};


/**
 * Fetches a user's profile by their unique username.
 * @param username The username of the user.
 * @returns A promise that resolves to the user's profile or null if not found.
 */
export const getProfileByUsername = async (username: string): Promise<Profile | null> => {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, developer, beta_tester, banned, xp, level, login_streak, tokens, premium')
      .eq('username', username)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') return null; // User not found, which is not an error here.
      console.error(`Error fetching profile for ${username}:`, profileError);
      throw profileError;
    }

    return profileData;
};


/**
 * Updates a user's profile data, such as their username.
 * @param userId The ID of the user.
 * @param updates An object containing the profile fields to update.
 * @returns A promise that resolves when the operation is complete.
 */
export const updateProfile = async (userId: string, updates: { username: string }) => {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('Error updating profile:', error);
      // "23505" is the PostgreSQL error code for a unique constraint violation.
      if (error.code === '23505') {
        throw new Error('This username is already taken. Please choose another one.');
      }
      throw error;
    }
};

/**
 * Searches for user profiles by username prefix.
 * @param searchText The username prefix to search for.
 * @returns A promise that resolves to an array of matching profiles.
 */
export const searchProfilesByUsername = async (searchText: string): Promise<SearchedProfile[]> => {
    if (!searchText.trim()) {
        return [];
    }
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, level, premium')
        .ilike('username', `${searchText}%`)
        .not('username', 'is', null) // Only search for users with a username
        .limit(10);
    
    if (error) {
        console.error('Error searching profiles:', error);
        throw error;
    }

    return (data as SearchedProfile[]) ?? [];
};

/**
 * Fetches the total realised profit for a specific user.
 * This assumes the existence of a `get_user_total_profit` RPC function.
 * @param userId The ID of the user.
 * @returns A promise that resolves to the user's total profit.
 */
export const fetchUserTotalProfit = async (userId: string): Promise<number> => {
    const { data, error } = await supabase.rpc('get_user_total_profit', {
        p_user_id: userId,
    });

    if (error) {
        console.error(`Error fetching total profit for user ${userId}:`, error);
        // If the function doesn't exist, provide a helpful error message.
        if (error.message.includes('function public.get_user_total_profit')) {
             throw new Error('Database function `get_user_total_profit` not found. Please add it to your Supabase project.');
        }
        throw error;
    }
    
    return data ?? 0;
};

/**
 * Fetches all investments for a user.
 * @param userId The ID of the user.
 * @returns A promise that resolves to an array of investments.
 */
export const fetchUserInvestments = async (userId: string): Promise<Investment[]> => {
    const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', userId)
        .order('purchase_date', { ascending: false });

    if (error) {
        console.error('Error fetching investments:', error);
        throw error;
    }
    return data ?? [];
};

/**
 * Adds a new investment to the database.
 * @param investmentData The investment data to insert.
 * @returns A promise that resolves to the newly created investment.
 */
export const addInvestment = async (investmentData: Omit<Investment, 'id' | 'created_at'>): Promise<Investment> => {
    const { data, error } = await supabase
        .from('investments')
        .insert(investmentData)
        .select()
        .single(); // Return the newly created row

    if (error) {
        console.error('Error adding investment:', error);
        throw error;
    }
    // If Row Level Security (RLS) is enabled and the insert is disallowed,
    // Supabase may return null data and null error. This check handles that case.
    if (!data) {
        throw new Error('Failed to add investment. This might be due to database permissions (Row Level Security). Please ensure you are logged in.');
    }
    return data;
};

/**
 * Updates an existing investment's details (quantity, price, date).
 * @param investmentId The ID of the investment to update.
 * @param updates The fields to update.
 * @returns A promise that resolves to the updated investment.
 */
export const updateInvestment = async (
    investmentId: string,
    updates: Partial<Pick<Investment, 'quantity' | 'purchase_price' | 'purchase_date'>>
): Promise<Investment> => {
    const { data, error } = await supabase
        .from('investments')
        .update(updates)
        .eq('id', investmentId)
        .select()
        .single();

    if (error) {
        console.error('Error updating investment:', error);
        throw error;
    }
    if (!data) {
        throw new Error('Failed to update investment: No data returned from update.');
    }
    return data;
};

/**
 * Updates an investment to mark it as "sold".
 * @param investmentId The ID of the investment to update.
 * @param sellData The sell price, sell date, and tax paid.
 * @returns A promise that resolves to the updated investment.
 */
export const closeInvestment = async (investmentId: string, sellData: { sell_price: number; sell_date: string; tax_paid: number; }): Promise<Investment> => {
    const { data, error } = await supabase
        .from('investments')
        .update(sellData)
        .eq('id', investmentId)
        .select()
        .single(); // Return the updated row

    if (error) {
        console.error('Error closing investment:', error);
        throw error;
    }
    if (!data) {
        throw new Error('Failed to close investment: No data returned from update.');
    }
    return data;
};

/**
 * Processes multiple sales against a single investment record.
 * It updates the original investment if shares remain, or deletes it if fully sold.
 * It then creates new, separate investment records for each closed portion.
 * @param investment The original investment record.
 * @param sales An array of sale data objects.
 * @returns A promise that resolves to the updated/null original record and an array of new closed records.
 */
export const processMultipleSales = async (
    investment: Investment,
    sales: Array<{ quantity: number; sell_price: number; sell_date: string; tax_paid: number }>
): Promise<{ updatedOriginal: Investment | null; newClosed: (Investment | null)[] }> => {
    const totalQuantitySold = sales.reduce((sum, s) => sum + s.quantity, 0);
    const remainingQuantity = investment.quantity - totalQuantitySold;

    if (remainingQuantity < 0) {
        throw new Error("Total sale quantity cannot exceed the investment quantity.");
    }

    const newClosedInvestmentData = sales.map(sale => ({
        user_id: investment.user_id,
        item_id: investment.item_id,
        quantity: sale.quantity,
        purchase_price: investment.purchase_price,
        purchase_date: investment.purchase_date,
        sell_price: sale.sell_price,
        sell_date: sale.sell_date,
        tax_paid: sale.tax_paid,
    }));

    let updateOrDeletePromise;
    if (remainingQuantity > 0) {
        updateOrDeletePromise = supabase
            .from('investments')
            .update({ quantity: remainingQuantity })
            .eq('id', investment.id)
            .select()
            .single();
    } else {
        updateOrDeletePromise = supabase
            .from('investments')
            .delete()
            .eq('id', investment.id)
            .then(({ error }) => {
                if (error) throw error;
                return { data: null, error: null };
            });
    }

    const insertPromise = supabase
        .from('investments')
        .insert(newClosedInvestmentData)
        .select();
    
    const [updateResult, insertResult] = await Promise.all([updateOrDeletePromise, insertPromise]);

    if (updateResult.error) {
        console.error('Error updating/deleting original investment on multi-sale:', updateResult.error);
        throw updateResult.error;
    }
    if (insertResult.error) {
        console.error('Error inserting new closed investments on multi-sale:', insertResult.error);
        throw insertResult.error;
    }
    if (!insertResult.data) {
        throw new Error('Failed to process multiple sales: insert operation returned no data.');
    }

    return { updatedOriginal: updateResult.data, newClosed: insertResult.data };
};


/**
 * Deletes a single investment record from the database.
 * This is an irreversible action.
 * @param investmentId The UUID of the investment to delete.
 */
export const deleteInvestment = async (investmentId: string): Promise<void> => {
    // We check the `count` of deleted rows to ensure the operation was successful.
    // If RLS policies prevent deletion, `count` will be 0 and `error` will be null,
    // so this check is crucial for surfacing permission issues.
    const { count, error } = await supabase
        .from('investments')
        .delete({ count: 'exact' })
        .eq('id', investmentId);

    if (error) {
        console.error('Error deleting investment:', error);
        throw error;
    }

    if (count === 0) {
        throw new Error(`Failed to delete investment. The item may have already been deleted, or database permissions (Row Level Security) might be preventing the action.`);
    }
};


/**
 * Deletes all investment records for a specific user.
 * This is an irreversible action.
 * @param userId The ID of the user whose portfolio will be cleared.
 */
export const clearUserInvestments = async (userId: string): Promise<void> => {
    // The previous implementation (`const { error } = ...`) was incorrect, as it assigned the
    // entire response object to `error`, causing a false positive error.
    // Correctly destructuring `error` and `count` fixes this bug.
    const { error, count } = await supabase
        .from('investments')
        .delete({ count: 'exact' })
        .eq('user_id', userId);

    if (error) {
        console.error('Error clearing investments:', error);
        throw error;
    }
    // It's not an error if `count` is 0; the user might be clearing an empty portfolio.
};

/**
 * Fetches the profit leaderboard from the database.
 * @param timeRange The time period to calculate profit over.
 * @returns A promise that resolves to an array of leaderboard entries.
 */
export const fetchLeaderboard = async (timeRange: LeaderboardTimeRange = 'all'): Promise<LeaderboardEntry[]> => {
    const { data, error } = await supabase.rpc('get_leaderboard', { time_range: timeRange });
  
    if (error) {
      const typedError = error as any;
      console.error(`Error fetching leaderboard for range ${timeRange}:`, typedError.message || error);
      throw error;
    }
  
    // The RPC return type is defined in services/supabase.ts, so data is correctly typed.
    return data ?? [];
};

/**
 * Fetches application-wide statistics. This is a developer-only feature.
 * @param timeRange The time period to calculate stats over.
 * @returns A promise that resolves to the application's statistics.
 */
export const fetchAppStats = async (timeRange: StatsTimeRange): Promise<AppStats> => {
    const { data, error } = await supabase.rpc('get_app_stats', { time_range: timeRange }).single();

    if (error) {
        console.error('Error fetching app stats:', error);
        throw new Error('Could not fetch application statistics. You might not have the required permissions.');
    }

    if (!data) {
        throw new Error('No data returned from app stats function.');
    }
    
    return data as AppStats;
};


// --- Admin Functions ---

/**
 * Sets a role for a target user. This can only be called by a developer.
 * @param targetUserId The UUID of the user to modify.
 * @param role The role to modify ('developer' or 'beta_tester').
 * @param status The new status for the role (true or false).
 */
export const setUserRole = async (targetUserId: string, role: 'developer' | 'beta_tester', status: boolean): Promise<void> => {
    const { error } = await supabase.rpc('set_user_role', {
        target_user_id: targetUserId,
        role: role,
        status: status,
    });

    if (error) {
        console.error(`Error setting role ${role} for user ${targetUserId}:`, error);
        throw error;
    }
};

/**
 * Bans a user and wipes their data. This can only be called by a developer.
 * @param targetUserId The UUID of the user to ban.
 */
export const banUser = async (targetUserId: string): Promise<void> => {
    const { error } = await supabase.rpc('ban_user', {
        target_user_id: targetUserId
    });

    if (error) {
        console.error(`Error banning user ${targetUserId}:`, error);
        throw error;
    }
};

// --- Progression System Functions ---

export const recordLogin = async (userId: string): Promise<ProgressionNotificationData[]> => {
    const { data, error } = await supabase.rpc('record_daily_login', { p_user_id: userId });
    if (error) {
        console.error('Error recording login:', error);
        return [];
    }
    return (data as ProgressionNotificationData[]) ?? [];
}

export const recordActivity = async (userId: string, activityType: 'watchlist_add' | 'alert_set_high' | 'alert_set_low'): Promise<ProgressionNotificationData[]> => {
    const { data, error } = await supabase.rpc('record_activity', { p_user_id: userId, p_activity_type: activityType });
    if (error) {
        console.error(`Error recording activity ${activityType}:`, error);
        return [];
    }
    return (data as ProgressionNotificationData[]) ?? [];
}

export const processClosedTrade = async (userId: string, profit: number, tradeValue: number): Promise<ProgressionNotificationData[]> => {
    const { data, error } = await supabase.rpc('process_closed_trade', { p_user_id: userId, p_profit: profit, p_trade_value: tradeValue });
    if (error) {
        console.error('Error processing closed trade:', error);
        return [];
    }
    return (data as ProgressionNotificationData[]) ?? [];
};

/**
 * Fetches all available achievements from the database.
 * @returns A promise that resolves to an array of all achievements.
 */
export const fetchAllAchievements = async (): Promise<Achievement[]> => {
    const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('id');

    if (error) {
        console.error('Error fetching all achievements:', error);
        throw error;
    }
    return data ?? [];
};

/**
 * Fetches the IDs of achievements a user has earned.
 * @param userId The ID of the user.
 * @returns A promise that resolves to a Set of earned achievement IDs.
 */
export const fetchUserAchievements = async (userId: string): Promise<Set<number>> => {
    const { data, error } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching user achievements:', error);
        throw error;
    }
    return new Set(data ? data.map(a => a.achievement_id) : []);
};

/**
 * Fetches a user's progress towards various achievements.
 * This calls the `get_user_achievement_progress` RPC function in Supabase.
 * @param userId The ID of the user.
 * @returns A promise that resolves to an object with the user's progress stats.
 */
export const fetchUserAchievementProgress = async (userId: string): Promise<UserProgressStats> => {
    const { data, error } = await supabase.rpc('get_user_achievement_progress', { p_user_id: userId });

    if (error) {
        console.error('Error fetching user achievement progress:', error);
        if (error.message.includes('function public.get_user_achievement_progress')) {
            throw new Error('Database function `get_user_achievement_progress` not found. Please add it to your Supabase project using the SQL provided.');
        }
        throw error;
    }
    return (data as UserProgressStats) ?? {};
};

/**
 * Spends one AI token for the specified user.
 * @param userId The ID of the user.
 * @returns A promise that resolves to the new token count.
 */
export const spendAiToken = async (userId: string): Promise<number> => {
    const { data, error } = await supabase.rpc('spend_ai_token', { p_user_id: userId });
    
    if (error) {
        console.error('Error spending AI token:', error);
        throw error;
    }

    if (typeof data !== 'number') {
        throw new Error('RPC function `spend_ai_token` did not return the new token count.');
    }
    
    return data;
};

// --- Community Feed Functions ---

/**
 * Creates a new post in the community feed.
 * @param userId The ID of the user making the post.
 * @param postData The data for the post, including optional title, content, and flip data.
 * @returns The newly created post.
 */
export const createPost = async (userId: string, postData: { title?: string | null; content?: string | null; flip_data?: FlipData | null }): Promise<Post> => {
    // FIX: Explicitly create the payload and cast flip_data to Json to satisfy Supabase client types.
    const payload = {
      user_id: userId,
      title: postData.title,
      content: postData.content,
      flip_data: postData.flip_data as unknown as Json
    };

    const { data, error } = await supabase
        .from('posts')
        .insert(payload)
        .select('*, profiles(username, level, premium)')
        .single();

    if (error) {
        console.error('Error creating post:', error);
        throw error;
    }
    if (!data) {
        throw new Error('Failed to create post. This might be due to database permissions.');
    }
     // Manually add the comment_count since it's not returned on insert
    // FIX: Cast the return type to 'Post' to align with application types, resolving flip_data incompatibility.
    return { ...data, comment_count: 0 } as unknown as Post;
};

/**
 * Fetches all posts for the community feed, including author info and comment count.
 * @returns A promise that resolves to an array of posts.
 */
export const fetchPosts = async (): Promise<Post[]> => {
    const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(username, level, premium), comments(count)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching posts:', error);
        throw error;
    }

    // Transform the data to match the Post type
    const posts = (data || []).map(p => ({
        ...p,
        comment_count: Array.isArray(p.comments) ? p.comments[0]?.count ?? 0 : 0
    }));
    // FIX: Cast the return type to 'Post[]' to align with application types, resolving flip_data incompatibility.
    return posts as unknown as Post[];
};

/**
 * Creates a new comment on a post.
 * @param userId The ID of the user commenting.
 * @param postId The ID of the post being commented on.
 * @param content The text content of the comment.
 * @param parentCommentId The ID of the parent comment, if this is a reply.
 * @returns The newly created comment with author info.
 */
export const createComment = async (userId: string, postId: string, content: string, parentCommentId?: string): Promise<Comment> => {
    const { data, error } = await supabase
        .from('comments')
        .insert({ user_id: userId, post_id: postId, content, parent_comment_id: parentCommentId })
        .select('*, profiles(username, level, premium)')
        .single();

    if (error) {
        console.error('Error creating comment:', error);
        throw error;
    }
     if (!data) {
        throw new Error('Failed to create comment. This might be due to database permissions.');
    }
    // FIX: Cast the return type to 'Comment' because the schema update resolves the type mismatch for 'profiles'.
    return data as unknown as Comment;
};

/**
 * Fetches all comments for a specific post.
 * @param postId The ID of the post to fetch comments for.
 * @returns A promise that resolves to an array of comments.
 */
export const fetchCommentsForPost = async (postId: string): Promise<Comment[]> => {
    const { data, error } = await supabase
        .from('comments')
        .select('*, profiles(username, level, premium)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching comments:', error);
        throw error;
    }
    // FIX: Cast the return type to 'Comment[]' because the schema update resolves the type mismatch for 'profiles'.
    return (data as unknown as Comment[]) || [];
};

/**
 * Deletes a post from the database.
 * RLS policies should ensure only the owner or an admin can perform this action.
 * @param postId The ID of the post to delete.
 */
export const deletePost = async (postId: string): Promise<void> => {
    const { error, count } = await supabase
        .from('posts')
        .delete({ count: 'exact' })
        .eq('id', postId);

    if (error) {
        console.error('Error deleting post:', error);
        throw error;
    }

    if (count === 0) {
        // This can happen if the post was already deleted, or if RLS prevents the action.
        throw new Error('Post not found or you do not have permission to delete it.');
    }
};

/**
 * Deletes a comment from the database.
 * RLS policies should ensure only the owner or an admin can perform this action.
 * @param commentId The ID of the comment to delete.
 */
export const deleteComment = async (commentId: string): Promise<void> => {
    const { error, count } = await supabase
        .from('comments')
        .delete({ count: 'exact' })
        .eq('id', commentId);

    if (error) {
        console.error('Error deleting comment:', error);
        throw error;
    }

    if (count === 0) {
        throw new Error('Comment not found or you do not have permission to delete it.');
    }
};
