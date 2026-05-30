/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Post, Comment, Notification } from './types';

const TEST_USER = {
  uid: 'glaze_test_user',
  sub: 'glaze_test_user',
  user_id: 'glaze_test_user',
  email: 'tester@glaze.local',
  name: 'Glaze Tester',
  picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=82'
};

function base64UrlEncode(value: object): string {
  return btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createTestToken(): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode(TEST_USER);
  return `${header}.${payload}.glaze-test-session`;
}

export class GlazeDatabase {
  private localCurrentUser: User | null = null;
  private authReady: boolean = false;
  private authListeners: ((user: User | null) => void)[] = [];
  private testToken: string = createTestToken();

  constructor() {
    this.init();
  }

  private async init() {
    this.authReady = true;
    const storedSession = localStorage.getItem('glaze_test_session');

    if (storedSession === 'active') {
      try {
        await this.enterTestMode();
      } catch (error) {
        console.error('Test session restore failed:', error);
        this.localCurrentUser = null;
        this.notifyListeners();
      }
    } else {
      this.notifyListeners();
    }
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
    return {
      'Authorization': `Bearer ${this.testToken}`,
      'Content-Type': 'application/json'
    };
  }

  public getCurrentUser(): User | null {
    return this.localCurrentUser;
  }

  public async loginWithGoogle(): Promise<User> {
    return this.enterTestMode();
  }

  public async enterTestMode(): Promise<User> {
    const response = await fetch('/api/auth/register-or-login', {
      method: 'POST',
      headers: await this.getHeaders()
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Could not start Glaze test session.');
    }

    const dbUser = await response.json();
    this.localCurrentUser = dbUser;
    localStorage.setItem('glaze_test_session', 'active');
    this.notifyListeners();
    return dbUser;
  }

  public async logout(): Promise<void> {
    localStorage.removeItem('glaze_test_session');
    this.localCurrentUser = null;
    this.notifyListeners();
  }

  public async getDatabaseStatus() {
    const res = await fetch('/api/database-status');
    if (!res.ok) throw new Error("Status inquiry failed");
    return await res.json();
  }

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

  public async createPost(content: string, image?: string): Promise<Post> {
    const headers = await this.getHeaders();
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, image })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Post creation failed");
    }
    return await res.json();
  }

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

  public async toggleLike(postId: string): Promise<string[]> {
    const headers = await this.getHeaders();
    const res = await fetch(`/api/posts/${postId}/like`, {
      method: 'POST',
      headers
    });
    if (!res.ok) throw new Error("Post like update failed");
    const data = await res.json();
    return data.likedBy;
  }

  public async toggleRepost(postId: string): Promise<string[]> {
    const headers = await this.getHeaders();
    const res = await fetch(`/api/posts/${postId}/repost`, {
      method: 'POST',
      headers
    });
    if (!res.ok) throw new Error("Repost update failed");
    const data = await res.json();
    return data.repostedBy;
  }

  public async getComments(postId: string): Promise<Comment[]> {
    const res = await fetch(`/api/posts/${postId}/comments`);
    if (!res.ok) throw new Error("Comments failed to load");
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
      throw new Error(err.error || "Comment submission failed");
    }
    return await res.json();
  }

  public async toggleFollow(targetUserId: string): Promise<boolean> {
    const headers = await this.getHeaders();
    const res = await fetch(`/api/users/${targetUserId}/follow`, {
      method: 'POST',
      headers
    });
    if (!res.ok) throw new Error("Follow action failed");
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
    if (!res.ok) throw new Error("Profile update failed");
    const user = await res.json();
    this.localCurrentUser = user;
    this.notifyListeners();
    return user;
  }

  public async getNotifications(): Promise<Notification[]> {
    const headers = await this.getHeaders();
    const res = await fetch('/api/notifications', { headers });
    if (!res.ok) throw new Error("Notifications failed to load");
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

  public async getUserProfile(userIdOrUsername: string): Promise<User | null> {
    const res = await fetch(`/api/users/${userIdOrUsername}`);
    if (!res.ok) return null;
    return await res.json();
  }

  public async getAllUsers(): Promise<User[]> {
    const res = await fetch('/api/users');
    if (!res.ok) return [];
    return await res.json();
  }

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
