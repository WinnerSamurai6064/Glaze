/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Mail, Calendar, MapPin, Link as LinkIcon, Edit2, UserPlus, Check, ArrowLeft, MessageSquare } from 'lucide-react';
import { User, Post } from '../types';
import { dbInstance } from '../db';
import { PostCard } from './PostCard';

interface ProfileViewProps {
  user: User;
  currentUser: User | null;
  onEditTrigger: () => void;
  onFollowToggle: (userId: string) => void;
  isFollowing: boolean;
  onSelectUser: (username: string) => void;
  onToast: (msg: string) => void;
  onBack?: () => void;
}

export function ProfileView({
  user,
  currentUser,
  onEditTrigger,
  onFollowToggle,
  isFollowing,
  onSelectUser,
  onToast,
  onBack
}: ProfileViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'broadcasts' | 'replies'>('broadcasts');
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  
  const isSelf = currentUser?.id === user.id;

  const loadPosts = async () => {
    setLoadingPosts(true);
    try {
      const data = await dbInstance.getPostsByUser(user.id);
      setUserPosts(data);
    } catch (err) {
      console.error("Error loading profile posts:", err);
    } finally {
      setLoadingPosts(false);
    }
  };

  React.useEffect(() => {
    loadPosts();
  }, [user.id]);

  return (
    <div className="space-y-6">
      {/* Small Header Nav Bar */}
      <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
        {onBack && (
          <button
            id="profile-view-back-icon-btn"
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-all scale-100 active:scale-95"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div>
          <h2 className="font-bold text-base sm:text-lg text-white flex items-center space-x-1.5">
            <span>{user.displayName}</span>
            {user.isVerified && (
              <span className="w-3.5 h-3.5 rounded-full bg-brand-orange text-white text-[8px] font-bold flex items-center justify-center">
                ✓
              </span>
            )}
          </h2>
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
            {userPosts.length} broadcast units
          </p>
        </div>
      </div>

      {/* Hero Visual Card Panel */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/5 relative">
        {/* Cover Banner */}
        <div className="h-40 sm:h-44 bg-[#0a0a0a] relative overflow-hidden">
          <img
            src={user.coverImage}
            alt="Cover pattern"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          {/* Glass Overlay on bottom of Banner */}
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>

        {/* Profile Card details wrapper */}
        <div className="px-4 sm:px-6 pb-5 relative">
          
          {/* Avatar floating absolute over banner boundary */}
          <div className="absolute -top-12 left-4 sm:left-6 w-24 sm:w-28 h-24 sm:h-28 rounded-full border-4 border-black overflow-hidden bg-zinc-900 shadow-2xl shrink-0">
            <img
              src={user.avatar}
              alt={user.displayName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover hover:scale-103 transition-transform duration-300"
            />
          </div>

          {/* Action Row absolute to the right */}
          <div className="flex justify-end pt-3 sm:pt-4">
            {isSelf ? (
              <button
                id="edit-profile-trigger-btn"
                onClick={onEditTrigger}
                className="flex items-center space-x-1.5 px-4.5 py-1.5 sm:py-2 border border-white/10 hover:border-brand-orange/40 text-xs font-semibold tracking-wider uppercase font-sans text-white hover:bg-brand-orange/5 rounded-full transition-all"
              >
                <Edit2 size={12} className="text-brand-orange" />
                <span>Configure Profile</span>
              </button>
            ) : (
              <button
                id="profile-toggle-follow-btn"
                onClick={() => {
                  if (!currentUser) {
                    onToast('Standard terminal requires Google Authentication to follow pilots');
                    return;
                  }
                  onFollowToggle(user.id);
                }}
                className={`flex items-center space-x-1.5 px-4.5 py-1.5 sm:py-2 text-xs font-bold font-sans rounded-full tracking-wider uppercase transition-all ${
                  isFollowing
                    ? 'bg-white/10 hover:bg-red-500/10 text-white hover:text-red-500 border border-white/5 hover:border-red-500/20'
                    : 'bg-brand-orange hover:bg-brand-orange-hover text-white shadow-md shadow-brand-orange/10'
                }`}
              >
                {isFollowing ? (
                  <>
                    <Check size={12} />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={12} />
                    <span>Follow</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Bio Identity Segment */}
          <div className="mt-5 space-y-3.5">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
                <span>{user.displayName}</span>
                {user.isVerified && (
                  <span className="w-4 h-4 rounded-full bg-brand-orange text-white text-[9px] font-bold flex items-center justify-center shrink-0 shadow-inner">
                    ✓
                  </span>
                )}
              </h1>
              <p className="text-xs text-gray-400 font-mono">@{user.username}</p>
            </div>

            <p className="text-sm text-gray-250 leading-relaxed font-sans max-w-xl">
              {user.bio}
            </p>

            {/* Directory Metadata Rows */}
            <div className="flex flex-wrap text-xs text-gray-400 gap-x-4 gap-y-2 pt-1 font-mono">
              {user.location && (
                <div className="flex items-center space-x-1.5">
                  <MapPin size={13} className="text-brand-orange" />
                  <span>{user.location}</span>
                </div>
              )}
              {user.website && (
                <div className="flex items-center space-x-1.5">
                  <LinkIcon size={13} className="text-brand-orange animate-pulse" />
                  <a
                    href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand-orange hover:underline truncate max-w-[170px]"
                  >
                    {user.website.replace(/(^\w+:|^)\/\//, '')}
                  </a>
                </div>
              )}
              <div className="flex items-center space-x-1.5">
                <Calendar size={13} className="text-gray-500" />
                <span>{user.joinedDate}</span>
              </div>
            </div>

            {/* Followers / Following Counters */}
            <div className="flex space-x-5 text-sm pt-2 font-sans border-t border-white/5">
              <div className="flex items-baseline space-x-1">
                <span className="font-bold text-white tracking-tight">{user.followingCount}</span>
                <span className="text-xs text-gray-400">Following</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="font-bold text-white tracking-tight">{user.followersCount}</span>
                <span className="text-xs text-gray-400">Followers</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation for Profile post types */}
      <div className="flex border-b border-white/5 font-mono text-xs uppercase tracking-widest font-bold">
        <button
          id="profile-tab-broadcasts-btn"
          onClick={() => setActiveSubTab('broadcasts')}
          className={`px-6 py-3 transition-colors border-b-2 relative ${
            activeSubTab === 'broadcasts'
              ? 'text-brand-orange border-brand-orange font-bold orange-glow-text'
              : 'text-gray-400 hover:text-white border-transparent'
          }`}
        >
          Broadcasting feed
        </button>
      </div>

      {/* Posts Feed for Profile */}
      <div className="space-y-4">
        {userPosts.length > 0 ? (
          userPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onToast={onToast}
              onPostSelect={onSelectUser}
              onPostDeleted={() => {
                loadPosts();
              }}
            />
          ))
        ) : (
          <div className="text-center py-12 glass-panel rounded-2xl border border-white/5 space-y-1.5">
            <MessageSquare className="mx-auto text-gray-600 mb-1" size={20} />
            <p className="text-sm font-mono text-gray-500 italic">No feeds broadcasted by @{user.username} yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
