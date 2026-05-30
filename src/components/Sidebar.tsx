/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Home, Search, Bell, User, Settings, LogOut, MessageSquare, ShieldAlert } from 'lucide-react';
import { User as UserType } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: UserType | null;
  unreadNotificationsCount: number;
  onLogout: () => void;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  unreadNotificationsCount,
  onLogout
}: SidebarProps) {
  const menuItems = [
    { id: 'feed', label: 'Home', icon: Home },
    { id: 'explore', label: 'Explore', icon: Search },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined
    },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <aside className="fixed bottom-0 left-0 right-0 z-40 md:relative md:h-screen md:w-64 border-t md:border-t-0 md:border-r border-white/10 glass-panel md:bg-black/20 flex md:flex-col justify-between p-2 md:p-6 md:sticky md:top-0">
      <div className="w-full flex md:flex-col md:space-y-8 justify-around md:justify-start items-center md:items-start">
        {/* Glowing Wordmark Logo Only Visible on Desktop */}
        <div 
          id="glaze-sidebar-logo-header"
          className="hidden md:flex items-center space-x-3 pl-2 cursor-pointer group"
          onClick={() => setActiveTab('feed')}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-orange to-red-500 flex items-center justify-center shadow-lg shadow-brand-orange/30 group-hover:scale-105 transition-transform duration-300">
            <span className="font-bold text-white text-xl tracking-tight">G</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-white">
              GLAZE
            </h1>
            <p className="text-[9px] text-brand-orange tracking-widest font-mono uppercase font-bold orange-glow-text">
              Beta Terminal
            </p>
          </div>
        </div>

        {/* Curation Links */}
        <nav className="w-full flex md:flex-col justify-around md:justify-start md:space-y-1.5 md:px-0">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                id={`sidebar-tab-${item.id}`}
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex items-center space-x-4 p-3 md:w-full rounded-xl transition-all duration-300 group ${
                  isActive
                    ? 'text-brand-orange bg-brand-orange/5 border border-brand-orange/15 shadow-inner shadow-brand-orange/5'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <div className="relative">
                  <Icon 
                    size={20} 
                    className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-brand-orange' : 'text-gray-400 group-hover:text-white'}`} 
                  />
                  {item.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-brand-orange text-white text-[9px] font-bold flex items-center justify-center px-1 border border-black animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="hidden md:inline text-sm font-medium tracking-wide">
                  {item.label}
                </span>
                
                {/* Active Indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-brand-orange rounded-r-lg hidden md:block" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User profile session switcher */}
      {currentUser && (
        <div className="hidden md:flex flex-col border-t border-white/5 pt-4 space-y-3">
          <div 
            id="sidebar-session-identity-card"
            className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all"
          >
            <div className="flex items-center space-x-3 overflow-hidden">
              <img
                src={currentUser.avatar}
                alt={currentUser.displayName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full border border-white/10 object-cover"
              />
              <div className="overflow-hidden">
                <h4 className="text-sm font-semibold text-white truncate max-w-[110px]">
                  {currentUser.displayName}
                </h4>
                <p className="text-xs text-gray-400 font-mono truncate max-w-[110px]">
                  @{currentUser.username}
                </p>
              </div>
            </div>
            
            <button
              id="sidebar-logout-btn"
              onClick={onLogout}
              className="text-gray-500 hover:text-brand-orange p-1.5 rounded-lg hover:bg-white/5 transition-all"
              title="Logout session"
            >
              <LogOut size={16} />
            </button>
          </div>
          
          <div className="text-[10px] text-gray-500 text-center font-mono tracking-wider">
            Built by TREYTEK ©
          </div>
        </div>
      )}
    </aside>
  );
}
