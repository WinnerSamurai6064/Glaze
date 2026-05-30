/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Heart, Reply, ArrowUpRight, Copy, Check, Trash2, Send, MessageCircle } from 'lucide-react';
import { Post, Comment, User } from '../types';
import { dbInstance } from '../db';

interface PostCardProps {
  key?: string;
  post: Post;
  currentUser: User | null;
  onPostDeleted?: () => void;
  onPostSelect?: (username: string) => void;
  onToast: (msg: string) => void;
}

export function PostCard({
  post,
  currentUser,
  onPostDeleted,
  onPostSelect,
  onToast
}: PostCardProps) {
  const [likeState, setLikeState] = useState({
    liked: currentUser ? post.likedBy.includes(currentUser.id) : false,
    count: post.likesCount
  });
  const [repostState, setRepostState] = useState({
    reposted: currentUser ? post.repostedBy.includes(currentUser.id) : false,
    count: post.repostsCount
  });
  
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Toggle Likes with Optimistic UI updates
  const handleLike = async () => {
    if (!currentUser) {
      onToast('You must register/login to like broadcasts');
      return;
    }
    
    // Toggle state immediately for perfect responsive feedback
    const isLikedNow = !likeState.liked;
    setLikeState({
      liked: isLikedNow,
      count: isLikedNow ? likeState.count + 1 : Math.max(0, likeState.count - 1)
    });

    try {
      await dbInstance.toggleLike(post.id);
    } catch (e) {
      // Revert in case of failure
      setLikeState(prev => ({
        liked: !prev.liked,
        count: !prev.liked ? prev.count + 1 : Math.max(0, prev.count - 1)
      }));
    }
  };

  // Toggle Reposts with Optimistic updates
  const handleRepost = async () => {
    if (!currentUser) {
      onToast('You must register/login to repost broadcasts');
      return;
    }

    const isRepostedNow = !repostState.reposted;
    setRepostState({
      reposted: isRepostedNow,
      count: isRepostedNow ? repostState.count + 1 : Math.max(0, repostState.count - 1)
    });

    try {
      await dbInstance.toggleRepost(post.id);
      onToast(isRepostedNow ? 'Shared to your feed!' : 'Removed repost');
    } catch (e) {
      setRepostState(prev => ({
        reposted: !prev.reposted,
        count: !prev.reposted ? prev.count + 1 : Math.max(0, prev.count - 1)
      }));
    }
  };

  // Comments Retrieval & Submissions
  const handleCommentClick = async () => {
    if (!showComments) {
      try {
        const data = await dbInstance.getComments(post.id);
        setComments(data);
      } catch (err) {
        onToast('Failed to load comments');
      }
    }
    setShowComments(!showComments);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onToast('You must register/login to join discussion threads');
      return;
    }
    if (!newComment.trim()) return;

    try {
      const added = await dbInstance.addComment(post.id, newComment.trim());
      setComments(prev => [...prev, added]);
      setNewComment('');
      post.commentsCount++; // Increment localized object to reflect sync
    } catch (err: any) {
      onToast(err.message || 'Failed to publish comment');
    }
  };

  // Clipboard Copier (no windows alerts)
  const handleCopyLink = () => {
    const url = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setIsCopied(true);
      onToast('Broadcast terminal url copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(() => {
      onToast('Failed to write to clipboard');
    });
  };

  // Handle post deletion (owner-protected)
  const handleDeletePost = async () => {
    if (!currentUser) return;
    try {
      await dbInstance.deletePost(post.id);
      onToast('Broadcast purged successfully.');
      if (onPostDeleted) onPostDeleted();
    } catch (e: any) {
      onToast(e.message || 'Purging failed.');
    }
  };

  const isOwner = currentUser?.id === post.userId;

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/5 glass-panel-hover overflow-hidden relative group">
      {/* Visual top border filament indicator */}
      {repostState.reposted && (
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-brand-orange to-transparent opacity-60" />
      )}

      {/* Repost Header Accent */}
      {repostState.reposted && (
        <div className="flex items-center space-x-1.5 text-[10px] font-mono text-brand-orange uppercase tracking-wider mb-2.5 ml-14">
          <Reply size={10} className="transform rotate-180" />
          <span>You broad-casted this feed</span>
        </div>
      )}

      <div className="flex items-start space-x-3.5">
        {/* Author DP clickable */}
        <img
          src={post.authorAvatar}
          alt={post.authorName}
          referrerPolicy="no-referrer"
          onClick={() => onPostSelect && onPostSelect(post.authorHandle)}
          className="w-10 sm:w-11 h-10 sm:h-11 rounded-full border border-white/15 object-cover cursor-pointer hover:border-brand-orange-hover hover:scale-103 transition-all flex-shrink-0"
        />

        {/* Post Metadata Pane */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-baseline space-x-1.5 cursor-pointer"
              onClick={() => onPostSelect && onPostSelect(post.authorHandle)}
            >
              <span className="text-sm font-semibold text-white hover:text-brand-orange transition-colors truncate block">
                {post.authorName}
              </span>
              
              {post.authorIsVerified && (
                <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-brand-orange text-white text-[7px] font-bold shrink-0 self-center">
                  ✓
                </span>
              )}
              
              <span className="text-xs text-gray-500 font-mono truncate hidden sm:inline">
                @{post.authorHandle}
              </span>
            </div>

            {/* Timing & Actions panel */}
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-gray-500 font-mono">
                {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>

              {isOwner && (
                <button
                  id={`delete-btn-${post.id}`}
                  onClick={handleDeletePost}
                  className="text-gray-500 hover:text-red-500 p-1 rounded-md hover:bg-white/5 transition-all"
                  title="Purge broadcast"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Social Content */}
          <div className="mt-2 text-sm text-gray-200 leading-relaxed break-words whitespace-pre-wrap font-sans">
            {post.content}
          </div>

          {/* Image Attachments */}
          {post.image && (
            <div className="mt-3.5 rounded-xl border border-white/10 overflow-hidden bg-black max-h-[340px]">
              <img
                src={post.image}
                alt="Broadcast visual asset"
                referrerPolicy="no-referrer"
                className="w-full object-cover max-h-[340px] hover:scale-101 transition-transform duration-300"
              />
            </div>
          )}

          {/* Feedback buttons */}
          <div className="flex items-center justify-between mt-4 border-t border-white/5 pt-3 text-gray-500">
            {/* Comment Count Trigger */}
            <button
              id={`comment-trigger-${post.id}`}
              onClick={handleCommentClick}
              className={`flex items-center space-x-1.5 text-xs font-mono py-1 px-2.5 rounded-lg transition-all ${
                showComments
                  ? 'text-brand-orange bg-brand-orange/5 border border-brand-orange/15 shadow-inner'
                  : 'hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageCircle size={14} />
              <span>{post.commentsCount}</span>
            </button>

            {/* Repost interaction */}
            <button
              id={`repost-btn-${post.id}`}
              onClick={handleRepost}
              className={`flex items-center space-x-1.5 text-xs font-mono py-1 px-2.5 rounded-lg transition-all ${
                repostState.reposted
                  ? 'text-brand-orange font-semibold orange-glow-text'
                  : 'hover:text-white hover:bg-white/5'
              }`}
            >
              <Reply size={14} className={`transform rotate-180 ${repostState.reposted ? 'text-brand-orange scale-110' : ''}`} />
              <span>{repostState.count}</span>
            </button>

            {/* Like Interactive Button */}
            <button
              id={`like-btn-${post.id}`}
              onClick={handleLike}
              className={`flex items-center space-x-1.5 text-xs font-mono py-1 px-2.5 rounded-lg transition-all ${
                likeState.liked
                  ? 'text-brand-orange font-semibold'
                  : 'hover:text-red-500 hover:bg-white/5'
              }`}
            >
              <Heart
                size={14}
                fill={likeState.liked ? 'currentColor' : 'none'}
                className={`transition-transform duration-200 ${
                  likeState.liked ? 'text-brand-orange scale-120 animate-wiggle' : ''
                }`}
              />
              <span className={likeState.liked ? 'orange-glow-text' : ''}>
                {likeState.count}
              </span>
            </button>

            {/* Sharing link */}
            <button
              id={`share-btn-${post.id}`}
              onClick={handleCopyLink}
              className="flex items-center space-x-1 text-xs py-1 px-2 rounded-lg hover:text-white hover:bg-white/5 transition-all"
              title="Copy link"
            >
              {isCopied ? <Check size={14} className="text-brand-orange" /> : <Copy size={13} />}
            </button>
          </div>

          {/* Localized sliding Discussions Box */}
          {showComments && (
            <div className="mt-4 border-t border-white/5 pt-4 space-y-4 animate-fadeIn">
              {/* Comment Thread */}
              {comments.length > 0 ? (
                <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex items-start space-x-2.5 text-xs border-b border-white/[0.03] pb-2">
                      <img
                        src={comment.authorAvatar}
                        alt={comment.authorName}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-full object-cover border border-white/5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-white">{comment.authorName}</span>
                          {comment.authorIsVerified && (
                            <span className="inline-flex items-center justify-center w-2.5 h-2.5 rounded-full bg-brand-orange text-white text-[6px] font-bold">
                              ✓
                            </span>
                          )}
                          <span className="text-gray-500 font-mono tracking-tighter">@{comment.authorHandle}</span>
                        </div>
                        <p className="text-gray-300 mt-1 break-words">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] font-mono text-gray-500 italic text-center py-2">
                  No signals transmitted in this thread yet. Be the first!
                </p>
              )}

              {/* Thread drafting interface */}
              {currentUser && (
                <form onSubmit={handlePostComment} className="flex items-center space-x-2">
                  <input
                    id={`comment-input-${post.id}`}
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Contribute to this discussion..."
                    className="flex-1 bg-black text-xs border border-white/10 hover:border-brand-orange/30 focus:border-brand-orange text-white rounded-lg px-2.5 py-2 focus:outline-none transition-all"
                  />
                  <button
                    id={`submit-comment-btn-${post.id}`}
                    type="submit"
                    disabled={!newComment.trim()}
                    className={`p-2 rounded-lg transition-all ${
                      newComment.trim()
                        ? 'bg-brand-orange hover:bg-brand-orange-hover text-white'
                        : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                    }`}
                  >
                    <Send size={11} />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
