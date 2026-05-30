/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { RightSidebar } from './components/RightSidebar';
import { CreatePost } from './components/CreatePost';
import { PostCard } from './components/PostCard';
import { ProfileView } from './components/ProfileView';
import { NotificationsCenter } from './components/NotificationsCenter';
import { SettingsView } from './components/SettingsView';
import { SearchModule } from './components/SearchModule';
import { ProfileEditModal } from './components/ProfileEditModal';
import { dbInstance } from './db';
import { User, Post, Notification } from './types';
import { ShieldCheck, LogIn, Mail, ArrowRight, Compass } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('feed');
  const [currentUser, setCurrentUser] = useState<User | null>(dbInstance.getCurrentUser());
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [authReady, setAuthReady] = useState<boolean>(dbInstance.isAuthReady());
  
  // Database status diagnostics
  const [dbStatus, setDbStatus] = useState<any>(null);
  
  // Searching and selection
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [focusedUser, setFocusedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  
  // Custom toast notification structure
  const [toast, setToast] = useState<string | null>(null);

  // Auth and sync listener
  useEffect(() => {
    const handleAuthChange = (user: User | null) => {
      setCurrentUser(user);
      setAuthReady(dbInstance.isAuthReady());
      if (user) {
        refreshData();
      }
    };
    dbInstance.registerAuthListener(handleAuthChange);
    
    // Check db status on boot
    dbInstance.getDatabaseStatus().then(status => {
      setDbStatus(status);
    }).catch(() => {});

    return () => {
      dbInstance.unregisterAuthListener(handleAuthChange);
    };
  }, []);

  const refreshData = async () => {
    try {
      const active = dbInstance.getCurrentUser();
      setCurrentUser(active);
      if (active) {
        const [usersList, postsList, notifsList, followsList] = await Promise.all([
          dbInstance.getAllUsers(),
          dbInstance.getPosts(),
          dbInstance.getNotifications(),
          dbInstance.getFollowingIds()
        ]);
        setAllUsers(usersList);
        setPosts(postsList);
        setNotifications(notifsList);
        setFollowingIds(followsList);
      } else {
        setAllUsers([]);
        setPosts([]);
        setNotifications([]);
        setFollowingIds([]);
      }
    } catch (e) {
      console.error("Error refreshing data:", e);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const handlePostCreated = async (content: string, image?: string) => {
    try {
      await dbInstance.createPost(content, image);
      showToast('Transmission broadcasted successfully!');
      refreshData();
    } catch (e: any) {
      showToast(e.message || 'Transmission failed.');
    }
  };

  // Google Authentication handler
  const handleGoogleLogin = async () => {
    try {
      showToast('Connecting with Google authentication...');
      const user = await dbInstance.loginWithGoogle();
      setCurrentUser(user);
      showToast(`Welcome count, ${user.displayName || 'Explorer'}!`);
      refreshData();
    } catch (e: any) {
      showToast(e.message || 'Authentication failed.');
    }
  };

  const handleLogout = async () => {
    try {
      await dbInstance.logout();
      setCurrentUser(null);
      setFocusedUser(null);
      setActiveTab('feed');
      showToast('Logged out of session.');
    } catch (e: any) {
      showToast('Error during logout.');
    }
  };

  // Follow states
  const handleFollowToggle = async (userId: string) => {
    try {
      await dbInstance.toggleFollow(userId);
      refreshData();
    } catch (e: any) {
      showToast(e.message || 'Follow toggling failed.');
    }
  };

  const isFollowing = (userId: string) => {
    return followingIds.includes(userId);
  };

  // Navigation handlers
  const handleSelectUser = async (username: string) => {
    const foundUser = await dbInstance.getUserProfile(username);
    if (foundUser) {
      setFocusedUser(foundUser);
      setActiveTab('user_profile');
    } else {
      showToast('Pilot profile not found');
    }
  };

  const handleSearchTrigger = (query: string) => {
    setSearchQuery(query);
    setActiveTab('explore');
  };

  const handleSelectPostFromAlert = (postId: string) => {
    const foundPost = posts.find(p => p.id === postId);
    if (foundPost) {
      setSearchQuery(foundPost.authorName);
      setActiveTab('explore');
      showToast(`Scanning signals related to matching post...`);
    }
  };

  const handleSaveProfile = async (
    displayName: string,
    bio: string,
    avatar: string,
    coverImage: string,
    location?: string,
    website?: string
  ) => {
    if (!currentUser) return;
    try {
      const updated = await dbInstance.updateProfile(displayName, bio, avatar, coverImage, location, website);
      setCurrentUser(updated);
      refreshData();
      showToast('Profile updated successfully.');
    } catch (e: any) {
      showToast(e.message || 'Profile modification failed.');
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await dbInstance.markAllNotificationsAsRead();
      refreshData();
      showToast('All notifications marked read.');
    } catch (e: any) {
      showToast('Failed to mark notifications as read.');
    }
  };

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col md:flex-row max-w-7xl mx-auto overflow-hidden font-sans relative" id="glaze-root">
      
      {/* Toast Overlay Banner */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass-panel rounded-full py-3 px-6 border-brand-orange/40 text-xs font-mono text-white flex items-center space-x-2 animate-bounce uppercase tracking-wide shadow-2xl shadow-brand-orange/20" id="glaze-toast">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-ping" />
          <span>{toast}</span>
        </div>
      )}

      {/* Unauthenticated Splash Screen Overlay */}
      {!currentUser ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen bg-[#020202] text-white animate-fadeIn" id="welcome-container">
          
          <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 shadow-2xl relative space-y-6 text-center" id="welcome-card">
            
            {/* Top decorative orange filament glow */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-orange to-transparent" />

            <div className="space-y-2">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-orange to-red-500 flex items-center justify-center shadow-lg shadow-brand-orange/25">
                <span className="font-extrabold text-white text-3xl tracking-tight">G</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white mt-3">GLAZE</h1>
              <p className="text-xs sm:text-sm text-gray-400 font-sans px-3">
                Welcome to Glaze, connect, explore and discover your voice
              </p>
            </div>

            {/* Premium Google Auth Continue block */}
            <div className="space-y-4 pt-3">
              <button
                id="login-google-button"
                onClick={handleGoogleLogin}
                className="w-full py-3.5 bg-white text-black hover:bg-gray-100 text-xs font-bold font-sans rounded-xl tracking-wider uppercase transition-all flex items-center justify-center space-x-2 shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <img
                  src="https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=40&auto=format&fit=crop"
                  alt="Google logo"
                  className="w-4 h-4 object-contain"
                />
                <span>Continue with Google</span>
              </button>
            </div>

            {/* Diagnostic Database Status Info Banner */}
            {dbStatus && !dbStatus.postgresActive && (
              <div className="text-[10px] text-gray-500 font-mono tracking-wide pt-4 border-t border-white/5 space-y-1 text-left" id="database-status-diagnostic">
                <div className="flex items-center space-x-1.5 text-brand-orange font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
                  <span>PostgreSQL Database Offline</span>
                </div>
                <p className="text-[9px] leading-relaxed text-gray-600 font-sans">
                  The application is running in dynamic local memory fallback mode. Configure DATABASE_URL in secrets to activate durable cloud SQL reads/writes.
                </p>
              </div>
            )}

            {/* Branded Footer */}
            <div className="text-[10px] text-gray-600 font-mono tracking-wider pt-2 border-t border-white/5">
              Built by TREYTEK ©
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Main Layout containing sidebars */}
          {/* Left Sidebar */}
          <Sidebar
            activeTab={activeTab === 'user_profile' ? 'profile' : activeTab}
            setActiveTab={(tab) => {
              if (tab === 'profile') {
                if (currentUser) {
                  setFocusedUser(currentUser);
                  setActiveTab('user_profile');
                }
              } else {
                setActiveTab(tab);
              }
            }}
            currentUser={currentUser}
            unreadNotificationsCount={unreadNotificationsCount}
            onLogout={handleLogout}
          />

          {/* Center Main Curation Feed (Scrollable) */}
          <main className="flex-1 md:border-r border-white/10 overflow-y-auto px-4 sm:px-6 py-6 pb-24 md:pb-6 space-y-6 max-h-screen">
            
            {/* Header branding overlay ONLY shown on mobile */}
            <div className="flex md:hidden items-center justify-between border-b border-white/10 pb-3">
              <div 
                className="flex items-center space-x-2 cursor-pointer"
                onClick={() => setActiveTab('feed')}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-orange to-red-500 flex items-center justify-center">
                  <span className="font-bold text-white text-sm">G</span>
                </div>
                <h1 className="text-base font-extrabold text-white font-sans tracking-wide">
                  GLAZE
                </h1>
              </div>

              {currentUser && (
                <div className="flex items-center space-x-2.5">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.displayName}
                    referrerPolicy="no-referrer"
                    onClick={() => {
                      setFocusedUser(currentUser);
                      setActiveTab('user_profile');
                    }}
                    className="w-7 h-7 rounded-full object-cover border border-brand-orange/40"
                  />
                  <span className="text-[9px] font-mono text-gray-400">@{currentUser.username}</span>
                </div>
              )}
            </div>

            {/* Navigation Routes Router */}
            {activeTab === 'feed' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="pb-2 border-b border-white/5 flex items-center justify-between">
                  <h2 className="font-bold text-lg text-white font-sans flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-brand-orange orange-glow-border animate-ping" />
                    <span>Timeline Broadcasts</span>
                  </h2>
                </div>

                <CreatePost
                  currentUser={currentUser}
                  onPostCreated={handlePostCreated}
                />

                <div className="space-y-4 pt-1">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={currentUser}
                      onPostSelect={handleSelectUser}
                      onToast={showToast}
                      onPostDeleted={refreshData}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'explore' && (
              <SearchModule
                initialQuery={searchQuery}
                currentUser={currentUser}
                onSelectUser={handleSelectUser}
                onToast={showToast}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationsCenter
                notifications={notifications}
                onMarkAllAsRead={handleMarkNotificationsRead}
                onSelectUser={handleSelectUser}
                onSelectPost={handleSelectPostFromAlert}
              />
            )}

            {activeTab === 'user_profile' && focusedUser && (
              <ProfileView
                user={focusedUser}
                currentUser={currentUser}
                onEditTrigger={() => setShowEditModal(true)}
                onFollowToggle={handleFollowToggle}
                isFollowing={isFollowing(focusedUser.id)}
                onSelectUser={handleSelectUser}
                onToast={showToast}
                onBack={focusedUser.id !== currentUser.id ? () => {
                  setActiveTab('feed');
                  setFocusedUser(currentUser);
                } : undefined}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                currentUser={currentUser}
                onToast={showToast}
              />
            )}
          </main>

          {/* Right Sidebar - Desktop ONLY */}
          <RightSidebar
            currentUser={currentUser}
            allUsers={allUsers}
            isFollowing={isFollowing}
            onFollowToggle={handleFollowToggle}
            onSelectUser={handleSelectUser}
            onSearch={handleSearchTrigger}
          />

          {/* Edit Profile Configuration Overlay Modal */}
          {showEditModal && currentUser && (
            <ProfileEditModal
              currentUser={currentUser}
              onClose={() => setShowEditModal(false)}
              onSave={handleSaveProfile}
              onToast={showToast}
            />
          )}
        </>
      )}
    </div>
  );
}
