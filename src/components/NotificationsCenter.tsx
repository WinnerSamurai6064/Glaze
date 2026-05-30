/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Heart, Reply, MessageSquare, UserPlus, CheckCircle } from 'lucide-react';
import { Notification } from '../types';

interface NotificationsCenterProps {
  notifications: Notification[];
  onMarkAllAsRead: () => void;
  onSelectUser: (username: string) => void;
  onSelectPost: (postId: string) => void;
}

export function NotificationsCenter({
  notifications,
  onMarkAllAsRead,
  onSelectUser,
  onSelectPost
}: NotificationsCenterProps) {
  
  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like':
        return <Heart size={14} className="text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageSquare size={14} className="text-blue-500 fill-blue-500" />;
      case 'repost':
        return <Reply size={14} className="text-brand-orange transform rotate-180" />;
      case 'follow':
        return <UserPlus size={14} className="text-[#00ffcc]" />;
    }
  };

  const getMessage = (notif: Notification) => {
    switch (notif.type) {
      case 'like':
        return (
          <span>
            liked your broadcast{' '}
            <span className="text-gray-400 italic">"{notif.targetPostPreview}"</span>
          </span>
        );
      case 'comment':
        return (
          <span>
            commented on your timeline signals{' '}
            <span className="text-gray-400 italic">"{notif.targetPostPreview}"</span>
          </span>
        );
      case 'repost':
        return (
          <span>
            rebroadcasted your terminal signals{' '}
            <span className="text-gray-400 italic">"{notif.targetPostPreview}"</span>
          </span>
        );
      case 'follow':
        return <span>started following your broadcast terminal</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <h2 className="font-bold text-lg text-white">Notifications Registry</h2>
        {notifications.some(n => !n.read) && (
          <button
            id="notifications-mark-read-btn"
            onClick={onMarkAllAsRead}
            className="text-xs font-mono text-brand-orange hover:text-brand-orange-hover hover:underline flex items-center space-x-1"
          >
            <CheckCircle size={12} />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 rounded-xl border transition-all duration-300 relative ${
                notif.read
                  ? 'bg-white/[0.01] border-white/5 text-gray-300'
                  : 'bg-brand-orange/[0.02] border-brand-orange/15 shadow-inner text-white'
              }`}
            >
              {/* Active unread notification orange pill flag */}
              {!notif.read && (
                <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-brand-orange animate-pulse orange-glow-border" />
              )}

              <div className="flex items-start space-x-3">
                {/* Event Category Badge absolute overlay */}
                <div className="p-1.5 rounded-lg bg-black/60 border border-white/5 absolute -top-2 -left-2 shadow-md">
                  {getIcon(notif.type)}
                </div>

                <img
                  src={notif.senderAvatar}
                  alt={notif.senderName}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0 mt-1"
                />

                <div className="flex-1 min-w-0 pr-4 text-sm font-sans pt-1">
                  <span
                    onClick={() => onSelectUser(notif.senderName)}
                    className="font-bold hover:text-brand-orange cursor-pointer transition-colors"
                  >
                    {notif.senderName}
                  </span>{' '}
                  <span className="text-gray-300">{getMessage(notif)}</span>
                  <div className="mt-1 flex items-center space-x-2">
                    <span className="text-[9px] text-gray-500 font-mono">
                      {new Date(notif.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    
                    {notif.targetPostId && (
                      <button
                        onClick={() => onSelectPost(notif.targetPostId!)}
                        className="text-[9px] font-mono text-brand-orange hover:underline uppercase"
                      >
                        [Open Feed]
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 glass-panel rounded-2xl border border-white/5">
          <p className="text-sm font-mono text-gray-500 italic">No signals recorded recently.</p>
        </div>
      )}
    </div>
  );
}
