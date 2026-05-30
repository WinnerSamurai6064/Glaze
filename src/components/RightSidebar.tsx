/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Flame, UserPlus, Check } from 'lucide-react';
import { User } from '../types';
import { dbInstance } from '../db';

interface RightSidebarProps {
  currentUser: User | null;
  allUsers: User[];
  isFollowing: (userId: string) => boolean;
  onFollowToggle: (userId: string) => void;
  onSelectUser: (username: string) => void;
  onSearch: (query: string) => void;
}

export function RightSidebar({
  currentUser,
  allUsers,
  isFollowing,
  onFollowToggle,
  onSelectUser,
  onSearch
}: RightSidebarProps) {
  const [searchVal, setSearchVal] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchVal(e.target.value);
    onSearch(e.target.value);
  };

  // Recommend users that are not the current user
  const recommendationList = allUsers
    .filter((u) => u.id !== currentUser?.id)
    .slice(0, 3);

  const trendingTopics = [
    { tag: 'SwordOfMilligan', posts: '1.4k posts', category: 'Game Development' },
    { tag: 'PhaserJS', posts: '894 posts', category: 'Web Technologies' },
    { tag: 'OLEDBlack', posts: '2.1k posts', category: 'Creative Trends' },
    { tag: 'TREYTEK', posts: '412 posts', category: 'Engineering Team' }
  ];

  return (
    <aside className="w-80 shrink-0 hidden lg:flex flex-col space-y-6 pt-6 pr-6 stick-right">
      {/* Rapid Search Input */}
      <form onSubmit={handleSearchSubmit} className="relative group w-full">
        <input
          id="right-sidebar-search-input"
          type="text"
          value={searchVal}
          onChange={handleInputChange}
          placeholder="Curation Search..."
          className="w-full bg-[#0d0d0d] border border-white/10 group-hover:border-brand-orange/30 focus:border-brand-orange text-white placeholder-gray-500 rounded-full py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-brand-orange/40 transition-all font-sans"
        />
        <Search className="absolute left-4 top-3 text-gray-500 group-hover:text-brand-orange/75 focus:text-brand-orange transition-colors" size={17} />
      </form>

      {/* Recommended Follows */}
      <div className="glass-panel rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-sm tracking-wide text-white uppercase border-b border-white/5 pb-2">
          Who to follow
        </h3>
        <div className="space-y-3.5">
          {recommendationList.map((user) => {
            const following = isFollowing(user.id);
            return (
              <div key={user.id} className="flex items-center justify-between group">
                <div 
                  className="flex items-center space-x-2.5 cursor-pointer max-w-[150px] overflow-hidden"
                  onClick={() => onSelectUser(user.username)}
                >
                  <img
                    src={user.avatar}
                    alt={user.displayName}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full border border-white/10 hover:border-brand-orange/40 object-cover transition-colors"
                  />
                  <div className="overflow-hidden">
                    <h4 className="text-xs font-semibold text-white truncate hover:text-brand-orange transition-colors">
                      {user.displayName}
                    </h4>
                    <p className="text-[10px] text-gray-400 font-mono truncate">
                      @{user.username}
                    </p>
                  </div>
                </div>

                <button
                  id={`follow-recommendation-btn-${user.id}`}
                  onClick={() => onFollowToggle(user.id)}
                  className={`py-1 px-3 rounded-full text-[10px] font-bold tracking-wide font-sans transition-all flex items-center space-x-1 ${
                    following
                      ? 'bg-white/10 hover:bg-red-500/10 text-white hover:text-red-500 border border-white/5 hover:border-red-500/20'
                      : 'bg-brand-orange hover:bg-brand-orange-hover text-white'
                  }`}
                >
                  {following ? (
                    <>
                      <Check size={11} />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={11} />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trending Topics spotlight */}
      <div className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <h3 className="font-bold text-sm tracking-wide text-white uppercase">
            Beta Signals
          </h3>
          <Flame size={14} className="text-brand-orange" />
        </div>
        <div className="space-y-4">
          {trendingTopics.map((item, index) => (
            <div 
              key={index} 
              className="group cursor-pointer"
              onClick={() => {
                setSearchVal(`#${item.tag}`);
                onSearch(`#${item.tag}`);
              }}
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                  {item.category}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-white group-hover:text-brand-orange transition-colors mt-0.5">
                #{item.tag}
              </h4>
              <span className="text-[10px] text-gray-400 font-mono">
                {item.posts}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
