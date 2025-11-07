import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Card } from './ui/Card';
import { Loader } from './ui/Loader';
import { Button } from './ui/Button';
import { UsersIcon, TrophyIcon, StarIcon, MessageSquareIcon, UserIcon, Trash2Icon, ChevronRightIcon, SearchIcon, XIcon } from './icons/Icons';
import { fetchLeaderboard, fetchPosts, createPost, fetchCommentsForPost, createComment, deletePost, deleteComment, searchProfilesByUsername } from '../services/database';
import type { LeaderboardEntry, LeaderboardTimeRange, Post, Comment, Profile, Item, FlipData, SearchedProfile } from '../types';
import { getHighResImageUrl, createIconDataUrl, formatLargeNumber } from '../utils/image';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface CommunityPageProps {
    onViewProfile: (user: LeaderboardEntry | { username: string | null } | string) => void;
    profile: (Profile & { email: string | null; }) | null;
    session: Session | null;
    items: Record<string, Item>;
    onSelectItem: (item: Item) => void;
    onLoginClick: () => void;
}

const MAX_VISIBLE_DEPTH = 3;

const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
};

const ProfitText: React.FC<{ value: number }> = ({ value }) => {
    const colorClass = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
    const sign = value > 0 ? '+' : '';
    return <span className={`font-bold ${colorClass}`}>{sign}{value.toLocaleString()} gp</span>;
};

const UserSearch: React.FC<{ onViewProfile: (username: string) => void; }> = ({ onViewProfile }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedTerm, setDebouncedTerm] = useState('');
    const [results, setResults] = useState<SearchedProfile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        if (!debouncedTerm.trim()) {
            setResults([]);
            return;
        }
        const performSearch = async () => {
            setIsSearching(true);
            try {
                const data = await searchProfilesByUsername(debouncedTerm);
                setResults(data);
            } catch (error) {
                console.error("Failed to search for users", error);
                setResults([]);
            } finally {
                setIsSearching(false);
            }
        };
        performSearch();
    }, [debouncedTerm]);
    
    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectUser = (username: string | null) => {
        if (!username) return;
        onViewProfile(username);
        setSearchTerm('');
        setResults([]);
        setIsFocused(false);
    };

    const showResults = isFocused && (searchTerm.length > 0);

    return (
        <div className="relative max-w-lg mx-auto mb-8" ref={searchContainerRef}>
            <div className="relative">
                <SearchIcon className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    placeholder="Search for a user..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    className="w-full p-3 pl-12 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                />
                 {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white">
                        <XIcon className="w-5 h-5"/>
                    </button>
                 )}
            </div>

            {showResults && (
                <div className="absolute top-full mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto">
                    {isSearching ? (
                        <div className="flex justify-center items-center p-4"><Loader size="sm" /></div>
                    ) : results.length > 0 ? (
                        <ul>
                            {results.map(profile => (
                                <li key={profile.id}>
                                    <button
                                        onClick={() => handleSelectUser(profile.username)}
                                        className="w-full text-left flex items-center gap-3 p-3 hover:bg-gray-700/50 transition-colors"
                                    >
                                        <UserIcon className="w-8 h-8 p-1.5 bg-gray-700/60 text-emerald-300 rounded-full flex-shrink-0"/>
                                        <div className="flex-1">
                                            <p className="font-semibold text-white flex items-center gap-2">
                                                <span>{profile.username}</span>
                                                {profile.premium && <StarIcon className="w-4 h-4 text-yellow-400" />}
                                            </p>
                                            <p className="text-sm text-gray-400">Level {profile.level}</p>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 text-center p-4">No users found.</p>
                    )}
                </div>
            )}
        </div>
    );
};


const LeaderboardPanel: React.FC<{ onViewProfile: (user: LeaderboardEntry) => void }> = ({ onViewProfile }) => {
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
                setError("Failed to load the community leaderboard.");
            } finally {
                setIsLoading(false);
            }
        };
        loadLeaderboard();
    }, [timeRange]);

    const TIME_RANGES: { label: string; value: LeaderboardTimeRange }[] = [
        { label: 'Today', value: 'today' }, { label: 'This Month', value: 'month' },
        { label: 'This Year', value: 'year' }, { label: 'All Time', value: 'all' },
    ];

    const RankIcon: React.FC<{ rank: number }> = ({ rank }) => {
        const rankClasses: Record<number, string> = { 1: 'text-yellow-400', 2: 'text-gray-300', 3: 'text-yellow-600' };
        if (rank <= 3) return <TrophyIcon className={`w-6 h-6 ${rankClasses[rank]}`} />;
        return <span className="text-gray-400 font-bold text-lg w-6 text-center">{rank}</span>;
    };
    
    return (
        <div>
             <div className="flex justify-center mb-6">
                <div className="flex items-center gap-1 bg-gray-900/50 p-1 rounded-lg">
                    {TIME_RANGES.map(({ label, value }) => (
                        <Button key={value} size="sm" variant={timeRange === value ? 'secondary' : 'ghost'}
                            onClick={() => setTimeRange(value)} className={`px-3 py-1 ${timeRange !== value ? 'text-gray-400 hover:text-white' : 'shadow-md'}`}>
                            {label}
                        </Button>
                    ))}
                </div>
            </div>
            {isLoading && <div className="flex justify-center items-center h-64"><Loader /></div>}
            {error && <div className="text-center text-red-400 mt-8">{error}</div>}
            {!isLoading && !error && (
                 leaderboard.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-gray-700 rounded-lg">
                        <p className="text-gray-500">The leaderboard is empty for this time period.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {leaderboard.map((user) => (
                            <Card key={`${user.username}-${user.rank}`} className="p-4">
                                <div className="flex items-center gap-4">
                                    <RankIcon rank={user.rank} />
                                    <div className="flex-1">
                                        <button className="p-0 h-auto text-lg font-bold text-white hover:text-emerald-300 transition-colors" onClick={() => onViewProfile(user)}>
                                            {user.username}
                                        </button>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-400">Total Profit</p>
                                        <ProfitText value={user.total_profit} />
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )
            )}
        </div>
    )
};


const CommunityFeedPanel: React.FC<Omit<CommunityPageProps, 'onViewProfile'> & {onViewProfile: (user: {username: string | null}) => void}> = ({ profile, session, items, onSelectItem, onViewProfile, onLoginClick }) => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);

    const fetchAndSetPosts = useCallback(async () => {
        try {
            const fetchedPosts = await fetchPosts();
            setPosts(fetchedPosts);
        } catch (err) {
            setError("Failed to load community feed.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAndSetPosts();
    }, [fetchAndSetPosts]);

    const handlePostCreated = (newPost: Post) => {
        setPosts(prevPosts => [newPost, ...prevPosts]);
        setIsCreatePostOpen(false);
    };

    const handlePostDeleted = (postId: string) => {
        setPosts(prevPosts => prevPosts.filter(p => p.id !== postId));
    };

    return (
        <div className="space-y-6">
            {!session && (
                <Card className="p-6 text-center bg-gray-800/60 border border-emerald-500/20 shadow-lg">
                    <h3 className="text-xl font-bold text-white">Join the Conversation!</h3>
                    <p className="text-gray-400 mt-2 mb-4">Log in or create an account to post, comment, and share your own successful flips with the community.</p>
                    <Button onClick={onLoginClick} variant="primary" size="md">
                        Login / Sign Up
                    </Button>
                </Card>
            )}
            {session && profile && (
                isCreatePostOpen ? (
                    <CreatePostForm 
                        profile={profile} 
                        session={session} 
                        onPostCreated={handlePostCreated}
                        onCancel={() => setIsCreatePostOpen(false)}
                    />
                ) : (
                    <Card 
                        isHoverable 
                        onClick={() => setIsCreatePostOpen(true)} 
                        className="p-4"
                    >
                        <div className="flex items-center gap-3">
                            <UserIcon className="w-8 h-8 p-1.5 bg-gray-700/60 text-emerald-300 rounded-full flex-shrink-0"/>
                            <div className="text-gray-500">Create a post...</div>
                        </div>
                    </Card>
                )
            )}
            
            {isLoading && <div className="flex justify-center items-center h-64"><Loader /></div>}
            {error && <div className="text-center text-red-400 mt-8">{error}</div>}
            {!isLoading && !error && posts.length === 0 && (
                 <div className="text-center py-20 border-2 border-dashed border-gray-700 rounded-lg">
                    <p className="text-gray-500">The community feed is empty. Be the first to post!</p>
                </div>
            )}
            <div className="space-y-6">
                {posts.map(post => (
                    <PostCard key={post.id} post={post} items={items} onSelectItem={onSelectItem} profile={profile} session={session} onViewProfile={onViewProfile} onPostDeleted={handlePostDeleted} />
                ))}
            </div>
        </div>
    );
};

const CreatePostForm: React.FC<{ profile: Profile; session: Session; onPostCreated: (post: Post) => void; onCancel: () => void; }> = ({ profile, session, onPostCreated, onCancel }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string|null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() && !title.trim()) return;

        setIsSubmitting(true);
        setError(null);
        try {
            const newPost = await createPost(session.user.id, { title: title.trim(), content: content.trim() });
            onPostCreated(newPost);
            setTitle('');
            setContent('');
        } catch (err) {
            setError("Failed to create post.");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <form onSubmit={handleSubmit}>
                <div className="flex items-center gap-3 mb-4">
                     <UserIcon className="w-8 h-8 p-1.5 bg-gray-700/60 text-emerald-300 rounded-full flex-shrink-0"/>
                     <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Post title (optional)" className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-2 text-white placeholder-gray-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition" />
                </div>
                <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={`What's on your mind, ${profile.username}?`}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition min-h-[80px]" required />
                <div className="flex justify-end items-center mt-3 gap-2">
                    {error && <p className="text-red-400 text-sm mr-auto">{error}</p>}
                    <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !content.trim()}>
                        {isSubmitting ? <Loader size="sm" /> : 'Post'}
                    </Button>
                </div>
            </form>
        </Card>
    );
};

const buildCommentTree = (comments: Comment[]): Comment[] => {
    const commentMap: { [id: string]: Comment } = {};
    const rootComments: Comment[] = [];

    // First pass: create a map of all comments by their ID and initialize replies array
    for (const comment of comments) {
        comment.replies = [];
        commentMap[comment.id] = comment;
    }

    // Second pass: link replies to their parents
    for (const comment of comments) {
        if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
            commentMap[comment.parent_comment_id].replies!.push(comment);
        } else {
            rootComments.push(comment);
        }
    }

    return rootComments;
};


const PostCard: React.FC<{ post: Post; items: Record<string, Item>; onSelectItem: (item: Item) => void; profile: Profile | null; session: Session | null; onViewProfile: (user: {username: string | null}) => void; onPostDeleted: (postId: string) => void; }> = ({ post, items, onSelectItem, profile, session, onViewProfile, onPostDeleted }) => {
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [commentTree, setCommentTree] = useState<Comment[]>([]);
    const [allComments, setAllComments] = useState<Comment[]>([]); // Flat list for easier updates
    const [isCommentsLoading, setIsCommentsLoading] = useState(false);
    const [commentCount, setCommentCount] = useState(post.comment_count);
    
    // State for deleting posts
    const [isDeletePostConfirmOpen, setIsDeletePostConfirmOpen] = useState(false);
    const [isDeletingPost, setIsDeletingPost] = useState(false);
    const [deletePostError, setDeletePostError] = useState<string | null>(null);

    // State for deleting comments
    const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null);
    const [isDeletingComment, setIsDeletingComment] = useState(false);
    const [deleteCommentError, setDeleteCommentError] = useState<string | null>(null);

    const canDeletePost = profile && (profile.id === post.user_id || profile.developer);
    
    const handleToggleComments = async () => {
        const currentlyOpen = isCommentsOpen;
        setIsCommentsOpen(!currentlyOpen);
        if (!currentlyOpen && allComments.length === 0 && commentCount > 0) {
            setIsCommentsLoading(true);
            try {
                const fetchedComments = await fetchCommentsForPost(post.id);
                setAllComments(fetchedComments);
                setCommentTree(buildCommentTree(fetchedComments));
            } catch (error) {
                console.error("Failed to fetch comments", error);
            } finally {
                setIsCommentsLoading(false);
            }
        }
    };
    
    const handleCommentAdded = (newComment: Comment) => {
        const updatedComments = [...allComments, newComment];
        setAllComments(updatedComments);
        setCommentTree(buildCommentTree(updatedComments));
        setCommentCount(prev => prev + 1);
    };
    
    const handleConfirmDeletePost = async () => {
        setIsDeletingPost(true);
        setDeletePostError(null);
        try {
            await deletePost(post.id);
            onPostDeleted(post.id);
            setIsDeletePostConfirmOpen(false);
        } catch (err: any) {
            setDeletePostError(err.message || "Failed to delete post.");
        } finally {
            setIsDeletingPost(false);
        }
    };

    const handleConfirmDeleteComment = async () => {
        if (!commentToDelete) return;
        setIsDeletingComment(true);
        setDeleteCommentError(null);
        try {
            await deleteComment(commentToDelete.id);

            const idsToDelete = new Set<string>();
            const queue: string[] = [commentToDelete.id];
            idsToDelete.add(commentToDelete.id);

            // Using the flat list `allComments`, find all children, grandchildren, etc.
            while (queue.length > 0) {
                const currentId = queue.shift()!;
                for (const c of allComments) {
                    if (c.parent_comment_id === currentId) {
                        idsToDelete.add(c.id);
                        queue.push(c.id);
                    }
                }
            }

            const newAllComments = allComments.filter(c => !idsToDelete.has(c.id));
            setAllComments(newAllComments);
            setCommentTree(buildCommentTree(newAllComments));
            setCommentCount(prev => prev - idsToDelete.size);
            setCommentToDelete(null);

        } catch (err: any) {
            setDeleteCommentError(err.message || "Failed to delete comment.");
        } finally {
            setIsDeletingComment(false);
        }
    };


    const item = post.flip_data ? items[post.flip_data.item_id] : null;

    return (
        <>
            {isDeletePostConfirmOpen && (
                <DeleteConfirmationModal
                    title="Delete Post"
                    message={<>Are you sure you want to permanently delete this post and all its comments? This action cannot be undone.</>}
                    onClose={() => setIsDeletePostConfirmOpen(false)}
                    onConfirm={handleConfirmDeletePost}
                    isLoading={isDeletingPost}
                    error={deletePostError}
                />
            )}
             {commentToDelete && (
                <DeleteConfirmationModal
                    title="Delete Comment"
                    message="Are you sure you want to permanently delete this comment and all its replies? This action cannot be undone."
                    onClose={() => setCommentToDelete(null)}
                    onConfirm={handleConfirmDeleteComment}
                    isLoading={isDeletingComment}
                    error={deleteCommentError}
                />
            )}
            <Card className="p-5">
                <div className="flex items-start gap-4">
                    <UserIcon className="w-10 h-10 p-2 bg-gray-700/60 text-emerald-300 rounded-full flex-shrink-0 mt-1"/>
                    <div className="flex-1">
                         <div className="flex justify-between items-start gap-4">
                            <div className="flex items-center gap-2 flex-wrap">
                                <button onClick={() => onViewProfile({ username: post.profiles.username })} className="font-bold text-white hover:underline">{post.profiles.username || 'Anonymous'}</button>
                                {post.profiles.premium && <StarIcon className="w-4 h-4 text-yellow-400" />}
                                <span className="text-gray-400 text-sm">· {timeAgo(post.created_at)}</span>
                            </div>
                            {canDeletePost && (
                                <button 
                                    onClick={() => { setDeletePostError(null); setIsDeletePostConfirmOpen(true); }} 
                                    className="p-1 -m-1 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0" 
                                    aria-label="Delete post"
                                    title="Delete post"
                                >
                                    <Trash2Icon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="text-gray-300 mt-2 space-y-3">
                            {post.title && <h3 className="text-lg font-semibold text-white">{post.title}</h3>}
                            {post.content && <p className="whitespace-pre-wrap">{post.content}</p>}
                            {post.flip_data && item && <FlipPost flip={post.flip_data} item={item} onSelectItem={onSelectItem} />}
                        </div>
                    </div>
                </div>
                 <div className="flex items-center gap-4 mt-4 pl-14">
                    <button onClick={handleToggleComments} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-semibold">
                        <MessageSquareIcon className="w-5 h-5" />
                        <span>{commentCount} Comment{commentCount !== 1 && 's'}</span>
                    </button>
                </div>
                {isCommentsOpen && (
                     <div className="mt-4 pl-14 border-t border-gray-700/50 pt-4 space-y-4">
                        {isCommentsLoading ? (
                            <div className="flex justify-center p-4"><Loader /></div>
                        ) : commentTree.length > 0 ? (
                            commentTree.map(c => (
                                <CommentCard 
                                    key={c.id} 
                                    comment={c} 
                                    session={session}
                                    profile={profile}
                                    onViewProfile={onViewProfile}
                                    onCommentAdded={handleCommentAdded}
                                    onSetCommentToDelete={setCommentToDelete}
                                />
                            ))
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-4">No comments yet.</p>
                        )}
                         {session && (
                            <CreateCommentForm 
                                postId={post.id} 
                                session={session} 
                                onCommentAdded={handleCommentAdded} 
                            />
                         )}
                    </div>
                )}
            </Card>
        </>
    )
};

const FlipPost: React.FC<{ flip: FlipData; item: Item; onSelectItem: (item: Item) => void; }> = ({ flip, item, onSelectItem }) => {
    return (
        <div onClick={() => onSelectItem(item)} className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4 cursor-pointer hover:border-gray-600 transition-colors">
            <div className="flex items-center gap-4">
                 <img src={getHighResImageUrl(flip.item_name)} onError={(e) => { e.currentTarget.src = createIconDataUrl(item.icon); }} alt={flip.item_name} className="w-12 h-12 object-contain bg-gray-700/50 rounded-md"/>
                 <div className="flex-1">
                     <p className="font-bold text-white">{flip.quantity.toLocaleString()} x {flip.item_name}</p>
                     <p className="text-xs text-gray-400">ROI: <span className="font-semibold text-emerald-400">{flip.roi.toFixed(2)}%</span></p>
                 </div>
                 <div className="text-right">
                     <p className="text-sm text-gray-400">Profit</p>
                     <p className="text-xl font-bold text-emerald-400">+{formatLargeNumber(flip.profit)}</p>
                 </div>
            </div>
        </div>
    )
};

const CommentCard: React.FC<{ comment: Comment; session: Session | null; profile: Profile | null; onViewProfile: (user: {username: string | null}) => void; onCommentAdded: (comment: Comment) => void; onSetCommentToDelete: (comment: Comment) => void; depth?: number; }> = ({ comment, session, profile, onViewProfile, onCommentAdded, onSetCommentToDelete, depth = 0 }) => {
    const [isReplying, setIsReplying] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const canDelete = profile && (profile.id === comment.user_id || profile.developer);

    const hasReplies = comment.replies && comment.replies.length > 0;
    const isDeepThread = depth >= MAX_VISIBLE_DEPTH;

    return (
        <div className="flex items-start gap-3">
            <div className="flex-shrink-0 flex flex-col items-center">
                <UserIcon className="w-8 h-8 p-1.5 bg-gray-700/60 text-emerald-300 rounded-full mt-1"/>
                {hasReplies && (
                    <div className="w-0.5 bg-gray-600/50 flex-grow mt-1"></div>
                )}
            </div>
            <div className="flex-1">
                <div className="bg-gray-700/40 rounded-lg px-3 py-2">
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => onViewProfile({ username: comment.profiles.username })} className="font-bold text-white text-sm hover:underline">{comment.profiles.username || 'Anonymous'}</button>
                            {comment.profiles.premium && <StarIcon className="w-3 h-3 text-yellow-400" />}
                            <span className="text-gray-500 text-xs">· {timeAgo(comment.created_at)}</span>
                        </div>
                        {canDelete && (
                            <button
                                onClick={() => onSetCommentToDelete(comment)}
                                className="p-1 -m-1 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                                aria-label="Delete comment"
                                title="Delete comment"
                            >
                                <Trash2Icon className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                    <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                </div>
                {session && (
                    <div className="mt-1">
                        <button onClick={() => setIsReplying(!isReplying)} className="text-xs font-bold text-gray-400 hover:text-white px-2 py-1 rounded">
                            Reply
                        </button>
                    </div>
                )}
                {isReplying && session && (
                    <div className="mt-2">
                        <CreateCommentForm
                            postId={comment.post_id}
                            session={session}
                            onCommentAdded={(newComment) => {
                                onCommentAdded(newComment);
                                setIsReplying(false);
                            }}
                            parentCommentId={comment.id}
                            onCancel={() => setIsReplying(false)}
                        />
                    </div>
                )}
                {hasReplies && (
                    <div className="mt-4 space-y-4">
                        {isDeepThread && !isExpanded ? (
                             <div className="flex items-center gap-2">
                                <div className="w-8 h-px bg-gray-700"></div>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setIsExpanded(true)}
                                    className="text-xs text-emerald-400 hover:text-emerald-300 h-auto py-1 px-2"
                                >
                                    Show {comment.replies?.length} more repl{comment.replies?.length === 1 ? 'y' : 'ies'}
                                </Button>
                            </div>
                        ) : (
                            comment.replies?.map(reply => (
                                <CommentCard 
                                    key={reply.id} 
                                    comment={reply} 
                                    session={session}
                                    profile={profile}
                                    onViewProfile={onViewProfile} 
                                    onCommentAdded={onCommentAdded}
                                    onSetCommentToDelete={onSetCommentToDelete}
                                    depth={depth + 1} 
                                />
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const CreateCommentForm: React.FC<{ postId: string; session: Session; onCommentAdded: (comment: Comment) => void; parentCommentId?: string; onCancel?: () => void; }> = ({ postId, session, onCommentAdded, parentCommentId, onCancel }) => {
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if(parentCommentId){ // only autofocus for replies
            textareaRef.current?.focus();
        }
    }, [parentCommentId]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;
        setIsSubmitting(true);
        try {
            const newComment = await createComment(session.user.id, postId, content.trim(), parentCommentId);
            onCommentAdded(newComment);
            setContent('');
        } catch (error) {
            console.error("Failed to post comment", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-start gap-3 mt-4">
            {!parentCommentId && (
                 <UserIcon className="w-8 h-8 p-1.5 bg-gray-700/60 text-emerald-300 rounded-full flex-shrink-0 mt-1"/>
            )}
            <div className="flex-1">
                 <textarea 
                    ref={textareaRef}
                    value={content} 
                    onChange={e => setContent(e.target.value)} 
                    placeholder="Write a comment..." 
                    rows={1}
                    className="w-full bg-gray-700/40 border border-gray-600 rounded-lg p-2 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-none" 
                 />
                <div className="flex justify-end mt-2 gap-2">
                     {onCancel && <Button size="sm" type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
                     <Button size="sm" type="submit" disabled={isSubmitting || !content.trim()}>
                        {isSubmitting ? <Loader size="sm" /> : parentCommentId ? 'Reply' : 'Comment'}
                    </Button>
                </div>
            </div>
        </form>
    )
};


export const CommunityPage: React.FC<CommunityPageProps> = ({ onViewProfile, profile, session, items, onSelectItem, onLoginClick }) => {
    const [activeTab, setActiveTab] = useState<'feed' | 'leaderboard'>('feed');

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <UsersIcon className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                <h1 className="text-4xl font-bold text-white">Community Hub</h1>
                <p className="text-gray-400 mt-2">Discuss market trends, share flips, and see who's making the biggest profits.</p>
            </div>

            <UserSearch onViewProfile={onViewProfile} />

            <div className="flex justify-center mb-6">
                 <div className="flex items-center gap-1 bg-gray-800/60 p-1 rounded-lg">
                    <Button size="md" variant={activeTab === 'feed' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('feed')} className="px-6 py-2">Community Feed</Button>
                    <Button size="md" variant={activeTab === 'leaderboard' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('leaderboard')} className="px-6 py-2">Leaderboard</Button>
                </div>
            </div>
            
            {activeTab === 'feed' ? <CommunityFeedPanel profile={profile} session={session} items={items} onSelectItem={onSelectItem} onViewProfile={onViewProfile} onLoginClick={onLoginClick} /> : <LeaderboardPanel onViewProfile={onViewProfile} />}
        </div>
    );
};
