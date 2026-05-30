/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  coverImage: string;
  email: string;
  followersCount: number;
  followingCount: number;
  joinedDate: string;
  isVerified?: boolean;
  location?: string;
  website?: string;
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  image?: string;
  createdAt: string;
  likesCount: number;
  repostsCount: number;
  commentsCount: number;
  likedBy: string[]; // List of user IDs who liked
  repostedBy: string[]; // List of user IDs who reposted
  originalPostId?: string; // If it's a repost
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  authorIsVerified?: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  authorIsVerified?: boolean;
}

export interface Notification {
  id: string;
  type: 'like' | 'repost' | 'comment' | 'follow';
  senderId: string;
  senderName: string;
  senderAvatar: string;
  targetPostId?: string;
  targetPostPreview?: string;
  createdAt: string;
  read: boolean;
}

export interface FollowData {
  followerId: string;
  followingId: string;
}
