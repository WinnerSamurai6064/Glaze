/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Search, Users, MessageSquare, ArrowUpRight } from 'lucide-react';
import { User, Post } from '../types';
import { dbInstance } from '../db';
import { PostCard } from './PostCard';

interface SearchModuleProps {
  initialQuery?: string;
  currentUser: User | null;
  onSelectUser: (username: string) => void;
  onToast: (msg: string) => void;
}

export function SearchModule({
  initialQuery = '',
  currentUser,
  onSelectUser,
  onToast
}: SearchModuleProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<{ posts: Post[]; users: User[] }>({ posts: [], users: [] });

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const triggerSearch = async () => {
      if (!query.trim()) {
        setResults({ posts: [], users: [] });
        return;
      }
      try {
        const searchRes = await dbInstance.searchUsersAndPosts(query);
        setResults(searchRes);
      } catch (err) {
        console.error(err);
      }
    };

    const handler = setTimeout(triggerSearch, 150);
    return () => clearTimeout(handler);
  }, [query]);

  // If search matches are empty, show some nice suggestions
  const hasResults = results.users.length > 0 || results.posts.length > 0;

  const handlePresetTag = (tag: string) => {
    setQuery(tag);
  };

  const sampleTags = ['SwordOfMilligan', 'PhaserJS', 'nigerian', 'OLEDBlack', 'TREYTEK'];

  return (
    <div className="space-y-6">
      {/* Mobile-First layout input */}
      <div className="relative group w-full lg:hidden pb-1 border-b border-white/5">
        <input
          id="mobile-search-module-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search broadcast signals, pilot hashtags..."
          className="w-full bg-[#0d0d0d] border border-white/10 group-hover:border-brand-orange focus:border-brand-orange text-white placeholder-gray-500 rounded-xl py-2.5 pl-11 pr-4 text-xs focus:outline-none transition-all"
        />
        <Search className="absolute left-4 top-3 text-gray-500" size={15} />
      </div>

      {query.trim().length === 0 ? (
        <div className="space-y-5 animate-fadeIn">
          {/* Default Discovery Panel */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/5 space-y-3.5">
            <h3 className="text-xs font-bold font-mono text-brand-orange uppercase tracking-widest leading-none orange-glow-text">
              Recommended Search Hub
            </h3>
            <p className="text-xs text-gray-400">
              Glaze processes query indices instantly. Tap on any trending beta tag below to discover related transmissions:
            </p>
            
            <div className="flex flex-wrap gap-2 pt-1">
              {sampleTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handlePresetTag(tag)}
                  className="px-3.5 py-1.5 bg-white/[0.02] border border-white/5 rounded-full hover:border-brand-orange/30 text-xs text-gray-300 hover:text-white hover:bg-brand-orange/5 transition-all font-mono"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-2 text-center text-gray-500 py-12">
            <Search className="mx-auto text-gray-600 mb-2" size={24} />
            <p className="text-sm font-mono italic">Waiting for broadcast signals...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center space-x-2 text-xs font-mono text-gray-400 uppercase tracking-widest border-b border-white/5 pb-2">
            <span>Query index search results for</span>
            <span className="text-brand-orange font-bold">"{query}"</span>
          </div>

          {/* Users Matches */}
          {results.users.length > 0 && (
            <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
                <Users size={14} className="text-brand-orange" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Matched Pilot Terminal Profiles</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {results.users.map((matchedUser) => (
                  <div
                    key={matchedUser.id}
                    onClick={() => onSelectUser(matchedUser.username)}
                    className="flex items-start justify-between p-3 rounded-xl bg-black border border-white/5 hover:border-brand-orange/30 cursor-pointer hover:bg-white/[0.01] transition-all group"
                  >
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <img
                        src={matchedUser.avatar}
                        alt={matchedUser.displayName}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover border border-white/10"
                      />
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-semibold text-white group-hover:text-brand-orange transition-colors truncate">
                          {matchedUser.displayName}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-mono truncate">
                          @{matchedUser.username}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight size={14} className="text-gray-500 group-hover:text-brand-orange transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Posts Matches */}
          {results.posts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 border-b border-white/5 pb-1">
                <MessageSquare size={14} className="text-brand-orange" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Matched Broadcast Signals</h3>
              </div>

              <div className="space-y-3">
                {results.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser}
                    onToast={onToast}
                    onPostSelect={(handle) => onSelectUser(handle)}
                  />
                ))}
              </div>
            </div>
          )}

          {!hasResults && (
            <div className="text-center py-16 glass-panel rounded-2xl border border-white/5 space-y-2">
              <p className="text-sm font-mono text-gray-500 italic">No exact matched telemetry found for "{query}".</p>
              <button
                id="search-clear-query-btn"
                onClick={() => setQuery('')}
                className="text-xs font-mono text-brand-orange hover:underline uppercase"
              >
                [Reset Search Query]
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
