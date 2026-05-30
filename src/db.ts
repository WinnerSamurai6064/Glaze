/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { auth, googleProvider, signInWithPopup } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { User, Post, Comment, Notification } from './types';

export class GlazeDatabase {
  private localCurrentUser: User | null = null;
  private authReady: boolean = false;
  private authListeners: ((user: User | null) => void)[] = [];

  constructor() {
    this.init();
  }

  private init() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      this.authReady = true;
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const response = await fetch('/api/auth/register-or-login', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${idToken}`,
              'Content-Type': 'application/json'
            }
          });
          if (response.ok) {
            this.localCurrentUser = await response.json();
          } else {
            console.error("Server authentication returned bad status");
            this.localCurrentUser = null;
          }
        } catch (e) {
          console.error("Auth state synchronization failed:", e);
          this.localCurrentUser = null;
        }
      } else {
        this.localCurrentUser = null;
      }
      this.notifyListeners();
    });
  }

  public registerAuthListener(callback: (user: User | null) => void) {
    this.authListeners.push(callback);
    if (this.authReady) {
      callback(this.localCurrentUser);
    }
  }

  public unregisterAuthListener(callback: (user: User | null) => void) {
    this.authListeners = this.authListeners.filter(l => l !== callback);
  }

  private notifyListeners() {
    this.authListeners.forEach(listener => {
      try {
        listener(this.localCurrentUser);
      } catch (err) {
        console.error("Listener invocation error:", err);
      }
    });
  }

  public isAuthReady(): boolean {
    return this.authReady;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const user = auth.currentUser;
    if (!user) return { 'Content-Type': 'application/json' };
    try {
      const token = await user.getIdToken();
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  }

  // Retrieve current user
  public getCurrentUser(): User | null {
    return this.localCurrentUser;
  }

  // Google Login flow
  public async loginWithGoogle(): Promise<User> {
    const credential = await signInWithPopup(auth, googleProvider);
    const idToken = await credential.user.getIdToken();
    const response = await fetch('/api/auth/register-or-login', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
      throw new Error("Failed to register/authenticate user on PostgreSQL database storage.");
    }
    const dbUser = await response.json();
    this.localCurrentUser = dbUser;
    this.notifyListeners();
    return dbUser;
  }

  // Logout session
  public async logout(): Promise<void> {
    await signOut(auth);
    this.localCurrentUser = null;
    this.notifyListeners();
  }

  // Get database diagnostic stats
  public async getDatabaseStatus() {
    const res = await fetch('/api/database-status');
    if (!res.ok) throw new Error("Status inquiry failed");
    return await res.json();
  }

  // Retrieve list of posts
  public async getPosts(): Promise<Post[]> {
    const headers = await this.getHeaders();
    const res = await fetch('/api/posts', { headers });
    if (!res.ok) throw new Error("Could not acquire post stream");
    return await res.json();
  }

  public async getPostsByUser(userId: string): Promise<Post[]> {
    const all = await this.getPosts();
    return all.filter(p => p.userId === userId || (p.repostedBy && p.repostedBy.includes(userId)));
  }

  // Create single post
  public async createPost(content: string, image?: string): Promise<Post> {
    const headers = await this.getHeaders();
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, image })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Broadcast creation failed");
    }
    return await res.json();
  }

  // Delete post
  public async deletePost(postId: string): Promise<void> {
    const headers = await this.getHeaders();
    const res = await fetch(`/api/posts/${postId}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Post deletion failed");
    }
  }

  // Likes
  public async toggleLike(postId: string): Promise<string[]> {
    const headers = await this.getHeaders();
    const res = await fetch(`/api/posts/${postId}/like`, {
      method: 'POST',
      headers
    });
    if (!res.ok) throw new Error("Post likeness modification failed");
    const data = await res.json();
    return data.likedBy;
  }

  // Reposts
  public async toggleRepost(postId: string): Promise<string[]> {
    const headers = await this.getHeaders();
    const res = await fetch(`/api/posts/${postId}/repost`, {
      method: 'POST',
      headers
    });
    if (!res.ok) throw new Error("Post repost modification failed");
    const data = await res.json();
    return data.repostedBy;
  }

  // Comments
  public async getComments(postId: string): Promise<Comment[]> {
    const res = await fetch(`/api/posts/${postId}/comments`);
    if (!res.ok) throw new Error("Comments stream failed to load");
    return await res.json();
  }

  public async addComment(postId: string, content: string): Promise<Comment> {
    const headers = await this.getHeaders();
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Comments submission failed");
    }
    return await res.json();
  }

  // Follow Actions
  public async toggleFollow(targetUserId: string): Promise<boolean> {
    const headers = await this.getHeaders();
    const res = await fetch(`/api/users/${targetUserId}/follow`, {
      method: 'POST',
      headers
    });
    if (!res.ok) throw new Error("Follow action toggle failed");
    const data = await res.json();
    return data.followed;
  }

  public async isFollowing(targetUserId: string): Promise<boolean> {
    const headers = await this.getHeaders();
    const res = await fetch(`/api/users/${targetUserId}/follow-status`, { headers });
    if (!res.ok) return false;
    const data = await res.json();
    return data.following;
  }

  public async getFollowingIds(): Promise<string[]> {
    const headers = await this.getHeaders();
    const res = await fetch('/api/me/following', { headers });
    if (!res.ok) return [];
    return await res.json();
  }

  // Edit Profiles
  public async updateProfile(
    displayName: string,
    bio: string,
    avatar: string,
    coverImage: string,
    location?: string,
    website?: string
  ): Promise<User> {
    const headers = await this.getHeaders();
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers,
      body: JSON.stringify({ displayName, bio, avatar, coverImage, location, website })
    });
    if (!res.ok) throw new Error("Profile updates failed to finalize");
    const user = await res.json();
    this.localCurrentUser = user;
    this.notifyListeners();
    return user;
  }

  // Notifications
  public async getNotifications(): Promise<Notification[]> {
    const headers = await this.getHeaders();
    const res = await fetch('/api/notifications', { headers });
    if (!res.ok) throw new Error("Could not download notifications signal");
    return await res.json();
  }

  public async markAllNotificationsAsRead(): Promise<void> {
    const headers = await this.getHeaders();
    const res = await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers
    });
    if (!res.ok) throw new Error("Mark read operation failed");
  }

  // Find User Profile details
  public async getUserProfile(userIdOrUsername: string): Promise<User | null> {
    const res = await fetch(`/api/users/${userIdOrUsername}`);
    if (!res.ok) return null;
    return await res.json();
  }

  // Get all users
  public async getAllUsers(): Promise<User[]> {
    const res = await fetch('/api/users');
    if (!res.ok) return [];
    return await res.json();
  }

  // Universal search index
  public async searchUsersAndPosts(query: string): Promise<{ posts: Post[]; users: User[] }> {
    const posts = await this.getPosts();
    const users = await this.getAllUsers();

    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return { posts: [], users: [] };

    const matchingUsers = users.filter(
      u => u.username.toLowerCase().includes(cleanQuery) || u.displayName.toLowerCase().includes(cleanQuery)
    );

    const matchingPosts = posts.filter(
      p => p.content.toLowerCase().includes(cleanQuery) ||
           p.authorName.toLowerCase().includes(cleanQuery) ||
           p.authorHandle.toLowerCase().includes(cleanQuery)
    );

    return { posts: matchingPosts, users: matchingUsers };
  }
}

export const dbInstance = new GlazeDatabase();
