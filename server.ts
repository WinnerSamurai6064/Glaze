/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import pg from 'pg';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import firebaseConfig from './firebase-applet-config.json';

// Load environment variables
dotenv.config();

const { Pool } = pg;
const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Firebase Admin dynamically to avoid startup crash
let firebaseAdminReady = false;
let firebaseAdminErr: string | null = null;
try {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
  firebaseAdminReady = true;
  console.log("Firebase Admin successfully initialized.");
} catch (e: any) {
  firebaseAdminErr = e.message || String(e);
  console.error("Firebase Admin initialization error:", e);
}

// Initialize PostgreSQL Pool
let pool: pg.Pool | null = null;
let pgError: string | null = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
    });
    console.log("PostgreSQL Pool created.");
  } catch (err: any) {
    pgError = err.message || String(err);
    console.error("Failed to construct PostgreSQL Pool:", err);
  }
} else {
  pgError = "DATABASE_URL environment variable is missing. Please add it to your secrets.";
  console.warn("DATABASE_URL is missing.");
}

// In-Memory Database Fallbacks (Only used when PostgreSQL is or becomes unavailable)
let mockUsers: any[] = [];
let mockPosts: any[] = [];
let mockComments: any[] = [];
let mockLikes: { user_id: string; post_id: string }[] = [];
let mockReposts: { user_id: string; post_id: string }[] = [];
let mockFollows: { follower_id: string; following_id: string }[] = [];
let mockNotifications: any[] = [];

// Initialize PostgreSQL Tables
async function initTables() {
  if (!pool) return;
  try {
    const client = await pool.connect();
    console.log("Creating database tables if not existing...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        avatar TEXT,
        cover_image TEXT,
        bio TEXT,
        location VARCHAR(255),
        website VARCHAR(255),
        followers_count INTEGER DEFAULT 0,
        following_count INTEGER DEFAULT 0,
        joined_date VARCHAR(255) NOT NULL,
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS posts (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        image TEXT,
        likes_count INTEGER DEFAULT 0,
        reposts_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS comments (
        id VARCHAR(255) PRIMARY KEY,
        post_id VARCHAR(255) REFERENCES posts(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS likes (
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        post_id VARCHAR(255) REFERENCES posts(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, post_id)
      );

      CREATE TABLE IF NOT EXISTS reposts (
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        post_id VARCHAR(255) REFERENCES posts(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, post_id)
      );

      CREATE TABLE IF NOT EXISTS follows (
        follower_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        following_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (follower_id, following_id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(255) PRIMARY KEY,
        recipient_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        sender_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        target_post_id VARCHAR(255) REFERENCES posts(id) ON DELETE CASCADE,
        target_post_preview TEXT,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    client.release();
    console.log("Database tables verified/created successfully.");
  } catch (err: any) {
    pgError = `DB Setup Failed: ${err.message || err}`;
    console.error("Error setting up database tables:", err);
  }
}

initTables();

// Security token extraction and verification middleware
async function authenticateMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header space is empty or flawed' });
  }

  const token = authHeader.split('Bearer ')[1];
  if (!firebaseAdminReady) {
    // If Admin is not initialized, mock verification for testing (falls back gracefully)
    console.warn("Using mock auth verification (Firebase Admin unready).");
    req.uid = 'mock_user_id';
    req.email = 'nigerian@treytek.com';
    req.name = 'The Nigerian';
    return next();
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.uid = decodedToken.uid;
    req.email = decodedToken.email;
    req.name = decodedToken.name || decodedToken.email?.split('@')[0] || 'Explorer';
    req.picture = decodedToken.picture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop';
    next();
  } catch (error: any) {
    console.error("Token verification failed:", error);
    res.status(403).json({ error: `Verification failed: ${error.message}` });
  }
}

// ---------------- API ENDPOINTS ----------------

// Get Database connection status (for frontend diagnostic display)
app.get('/api/database-status', (req, res) => {
  res.json({
    postgresActive: pool !== null && pgError === null,
    postgresError: pgError,
    firebaseReady: firebaseAdminReady,
    firebaseError: firebaseAdminErr,
    envDatabaseUrl: !!process.env.DATABASE_URL
  });
});

// Create/Update matching user record from verified ID Token details
app.post('/api/auth/register-or-login', authenticateMiddleware, async (req: any, res) => {
  const { uid, email, name, picture } = req;
  const lowercaseEmail = email.toLowerCase();
  let baseUsername = lowercaseEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  if (!baseUsername) baseUsername = 'explorer';

  if (pool) {
    try {
      // Find or generate unique username
      let username = baseUsername;
      let conflict = true;
      let retryCount = 0;
      
      const existingUserQuery = await pool.query('SELECT * FROM users WHERE id = $1', [uid]);
      if (existingUserQuery.rowCount && existingUserQuery.rowCount > 0) {
        return res.json(existingUserQuery.rows[0]);
      }

      while (conflict && retryCount < 10) {
        const checkUsername = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
        if (checkUsername.rowCount === 0) {
          conflict = false;
        } else {
          username = `${baseUsername}_${Math.floor(Math.random() * 9000 + 1000)}`;
          retryCount++;
        }
      }

      const joinedDate = `Joined ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`;
      const isVerified = username === 'nigerian'; // Special verify for "The Nigerian" as requested

      const insertQuery = `
        INSERT INTO users (id, email, username, display_name, avatar, cover_image, bio, joined_date, is_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, avatar = EXCLUDED.avatar
        RETURNING *
      `;
      const result = await pool.query(insertQuery, [
        uid,
        lowercaseEmail,
        username,
        name,
        picture,
        'https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=1200',
        'New Glaze pilot ready to explore and project voices.',
        joinedDate,
        isVerified
      ]);
      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error("SQL Login registering error:", err);
      // Fallback
    }
  }

  // In-Memory Fallback
  let user = mockUsers.find(u => u.id === uid);
  if (!user) {
    const isVerified = baseUsername === 'nigerian';
    user = {
      id: uid,
      email: lowercaseEmail,
      username: baseUsername,
      displayName: name,
      avatar: picture,
      coverImage: 'https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=1200',
      bio: 'New Glaze pilot ready to explore and project voices (In-Memory Session)',
      followersCount: 0,
      followingCount: 0,
      joinedDate: `Joined ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      isVerified: isVerified
    };
    mockUsers.push(user);
  }
  return res.json(user);
});

// Update Profile details
app.post('/api/profile', authenticateMiddleware, async (req: any, res) => {
  const uid = req.uid;
  const { displayName, bio, avatar, coverImage, location, website } = req.body;

  if (pool) {
    try {
      const updateQuery = `
        UPDATE users
        SET display_name = $1, bio = $2, avatar = $3, cover_image = $4, location = $5, website = $6
        WHERE id = $7
        RETURNING *
      `;
      const result = await pool.query(updateQuery, [displayName, bio, avatar, coverImage, location, website, uid]);
      if (result.rowCount && result.rowCount > 0) {
        return res.json(result.rows[0]);
      }
    } catch (err: any) {
      console.error("SQL Profile Update Error:", err);
    }
  }

  // Fallback
  const user = mockUsers.find(u => u.id === uid);
  if (user) {
    user.displayName = displayName;
    user.bio = bio;
    user.avatar = avatar;
    user.coverImage = coverImage;
    user.location = location;
    user.website = website;
    return res.json(user);
  }
  return res.status(404).json({ error: 'User profiles could not be updated' });
});

// Get user list (for search or suggestions)
app.get('/api/users', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
      return res.json(result.rows);
    } catch (err) {
      console.error("SQL getUsers Error:", err);
    }
  }
  return res.json(mockUsers);
});

// Find single user profile
app.get('/api/users/:target', async (req, res) => {
  const { target } = req.params;
  if (pool) {
    try {
      const result = await pool.query('SELECT * FROM users WHERE id = $1 OR LOWER(username) = LOWER($2)', [target, target]);
      if (result.rowCount && result.rowCount > 0) {
        return res.json(result.rows[0]);
      }
    } catch (err) {
      console.error("SQL getUser Error:", err);
    }
  }
  const found = mockUsers.find(u => u.id === target || u.username.toLowerCase() === target.toLowerCase());
  if (found) {
    return res.json(found);
  }
  return res.status(404).json({ error: 'User profile not found' });
});

// Retrieve posts sorted by date
app.get('/api/posts', async (req, res) => {
  const authHeader = req.headers.authorization;
  let callerUserId: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ') && firebaseAdminReady) {
    try {
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      callerUserId = decodedToken.uid;
    } catch {}
  }

  if (pool) {
    try {
      // Joining author records
      const queryStr = `
        SELECT posts.*, 
               users.display_name AS "authorName", 
               users.username AS "authorHandle", 
               users.avatar AS "authorAvatar",
               users.is_verified AS "authorIsVerified",
               COALESCE((SELECT ARRAY_AGG(user_id) FROM likes WHERE post_id = posts.id), '{}') AS "likedBy",
               COALESCE((SELECT ARRAY_AGG(user_id) FROM reposts WHERE post_id = posts.id), '{}') AS "repostedBy"
        FROM posts
        JOIN users ON posts.user_id = users.id
        ORDER BY posts.created_at DESC
      `;
      const result = await pool.query(queryStr);
      return res.json(result.rows);
    } catch (err) {
      console.error("SQL getPosts Error:", err);
    }
  }

  // Fallback
  const returnPosts = mockPosts.map(p => {
    const authorVal = mockUsers.find(u => u.id === p.userId) || { displayName: 'Deleted', username: 'deleted', avatar: '', isVerified: false };
    const likesList = mockLikes.filter(l => l.post_id === p.id).map(l => l.user_id);
    const repostsList = mockReposts.filter(r => r.post_id === p.id).map(r => r.user_id);

    return {
      ...p,
      authorName: authorVal.displayName || authorVal.display_name,
      authorHandle: authorVal.username,
      authorAvatar: authorVal.avatar,
      authorIsVerified: authorVal.isVerified,
      likedBy: likesList,
      repostedBy: repostsList
    };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json(returnPosts);
});

// Create Post
app.post('/api/posts', authenticateMiddleware, async (req: any, res) => {
  const uid = req.uid;
  const { content, image } = req.body;
  if (!content) return res.status(400).json({ error: 'Cannot broadcast empty terminal posts' });

  const customId = `post_${Date.now()}`;
  if (pool) {
    try {
      const insertQuery = `
        INSERT INTO posts (id, user_id, content, image, likes_count, reposts_count, comments_count)
        VALUES ($1, $2, $3, $4, 0, 0, 0)
        RETURNING *
      `;
      const result = await pool.query(insertQuery, [customId, uid, content, image]);
      // Return post decorated with author info
      const authorQuery = await pool.query('SELECT * FROM users WHERE id = $1', [uid]);
      const author = authorQuery.rows[0];

      return res.json({
        ...result.rows[0],
        authorName: author.display_name,
        authorHandle: author.username,
        authorAvatar: author.avatar,
        authorIsVerified: author.is_verified,
        likedBy: [],
        repostedBy: []
      });
    } catch (err: any) {
      console.error("SQL createPost Error:", err);
    }
  }

  // Fallback
  const authorVal = mockUsers.find(u => u.id === uid) || { displayName: 'Explorer', username: 'explorer', avatar: '', isVerified: false };
  const newPost = {
    id: customId,
    userId: uid,
    content,
    image,
    likesCount: 0,
    repostsCount: 0,
    commentsCount: 0,
    createdAt: new Date().toISOString(),
    authorName: authorVal.displayName || authorVal.display_name,
    authorHandle: authorVal.username,
    authorAvatar: authorVal.avatar,
    authorIsVerified: authorVal.isVerified,
    likedBy: [],
    repostedBy: []
  };
  mockPosts.unshift(newPost);
  return res.json(newPost);
});

// Delete Post
app.delete('/api/posts/:postId', authenticateMiddleware, async (req: any, res) => {
  const uid = req.uid;
  const { postId } = req.params;

  if (pool) {
    try {
      // Ownership check
      const postCheck = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
      if (postCheck.rowCount === 0) {
        return res.status(404).json({ error: 'Post signals not found' });
      }
      if (postCheck.rows[0].user_id !== uid) {
        return res.status(403).json({ error: 'Post deletion access violation' });
      }

      await pool.query('DELETE FROM posts WHERE id = $1', [postId]);
      return res.json({ success: true });
    } catch (err) {
      console.error("SQL deletePost Error:", err);
    }
  }

  // Fallback
  const idx = mockPosts.findIndex(p => p.id === postId);
  if (idx !== -1) {
    if (mockPosts[idx].userId !== uid) {
      return res.status(403).json({ error: 'Access violation' });
    }
    mockPosts.splice(idx, 1);
    mockComments = mockComments.filter(c => c.post_id !== postId);
    mockLikes = mockLikes.filter(l => l.post_id !== postId);
    mockReposts = mockReposts.filter(r => r.post_id !== postId);
    return res.json({ success: true });
  }
  return res.status(404).json({ error: 'Post not found' });
});

// Post Likes
app.post('/api/posts/:postId/like', authenticateMiddleware, async (req: any, res) => {
  const uid = req.uid;
  const { postId } = req.params;

  if (pool) {
    try {
      const activeClient = await pool.connect();
      // Check existing like
      const checkLike = await activeClient.query('SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2', [uid, postId]);
      let likedNow = false;

      // Fetch target post user to notify
      const postUserQuery = await activeClient.query('SELECT user_id, content FROM posts WHERE id = $1', [postId]);
      if (postUserQuery.rowCount === 0) {
        activeClient.release();
        return res.status(404).json({ error: 'Post not found' });
      }
      const postAuthorId = postUserQuery.rows[0].user_id;
      const postContent = postUserQuery.rows[0].content;

      if (checkLike.rowCount === 0) {
        await activeClient.query('INSERT INTO likes (user_id, post_id) VALUES ($1, $2)', [uid, postId]);
        await activeClient.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1', [postId]);
        likedNow = true;

        // Deliver notification if not self
        if (postAuthorId !== uid) {
          const authorQuery = await activeClient.query('SELECT display_name, avatar FROM users WHERE id = $1', [uid]);
          const caller = authorQuery.rows[0];
          await activeClient.query(`
            INSERT INTO notifications (id, recipient_id, type, sender_id, target_post_id, target_post_preview)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            `notif_${Date.now()}`,
            postAuthorId,
            'like',
            uid,
            postId,
            postContent.substring(0, 40) + '...'
          ]);
        }
      } else {
        await activeClient.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [uid, postId]);
        await activeClient.query('UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1', [postId]);
      }

      // Query final likes
      const likesResult = await activeClient.query('SELECT user_id FROM likes WHERE post_id = $1', [postId]);
      activeClient.release();
      return res.json({ likedBy: likesResult.rows.map(r => r.user_id) });
    } catch (err) {
      console.error("SQL toggleLike Error:", err);
    }
  }

  // Fallback
  const post = mockPosts.find(p => p.id === postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const index = mockLikes.findIndex(l => l.user_id === uid && l.post_id === postId);
  if (index === -1) {
    mockLikes.push({ user_id: uid, post_id: postId });
    post.likesCount++;
    // Notify
    if (post.userId !== uid) {
      const sender = mockUsers.find(u => u.id === uid) || { displayName: 'Explorer', avatar: '' };
      mockNotifications.unshift({
        id: `notif_${Date.now()}`,
        recipient_id: post.userId,
        type: 'like',
        sender_id: uid,
        senderName: sender.displayName || sender.display_name,
        senderAvatar: sender.avatar,
        target_post_id: postId,
        target_post_preview: post.content.substring(0, 40) + '...',
        read: false,
        createdAt: new Date().toISOString()
      });
    }
  } else {
    mockLikes.splice(index, 1);
    post.likesCount = Math.max(0, post.likesCount - 1);
  }
  const updatedLikes = mockLikes.filter(l => l.post_id === postId).map(l => l.user_id);
  return res.json({ likedBy: updatedLikes });
});

// Post Reposts
app.post('/api/posts/:postId/repost', authenticateMiddleware, async (req: any, res) => {
  const uid = req.uid;
  const { postId } = req.params;

  if (pool) {
    try {
      const activeClient = await pool.connect();
      const checkRepost = await activeClient.query('SELECT 1 FROM reposts WHERE user_id = $1 AND post_id = $2', [uid, postId]);
      
      const postUserQuery = await activeClient.query('SELECT user_id, content FROM posts WHERE id = $1', [postId]);
      if (postUserQuery.rowCount === 0) {
        activeClient.release();
        return res.status(404).json({ error: 'Post not found' });
      }
      const postAuthorId = postUserQuery.rows[0].user_id;
      const postContent = postUserQuery.rows[0].content;

      if (checkRepost.rowCount === 0) {
        await activeClient.query('INSERT INTO reposts (user_id, post_id) VALUES ($1, $2)', [uid, postId]);
        await activeClient.query('UPDATE posts SET reposts_count = reposts_count + 1 WHERE id = $1', [postId]);

        // Deliver notification
        if (postAuthorId !== uid) {
          await activeClient.query(`
            INSERT INTO notifications (id, recipient_id, type, sender_id, target_post_id, target_post_preview)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            `notif_${Date.now()}`,
            postAuthorId,
            'repost',
            uid,
            postId,
            postContent.substring(0, 40) + '...'
          ]);
        }
      } else {
        await activeClient.query('DELETE FROM reposts WHERE user_id = $1 AND post_id = $2', [uid, postId]);
        await activeClient.query('UPDATE posts SET reposts_count = GREATEST(0, reposts_count - 1) WHERE id = $1', [postId]);
      }

      const repostsResult = await activeClient.query('SELECT user_id FROM reposts WHERE post_id = $1', [postId]);
      activeClient.release();
      return res.json({ repostedBy: repostsResult.rows.map(r => r.user_id) });
    } catch (err) {
      console.error("SQL repost Toggle Error:", err);
    }
  }

  // Fallback
  const post = mockPosts.find(p => p.id === postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const index = mockReposts.findIndex(r => r.user_id === uid && r.post_id === postId);
  if (index === -1) {
    mockReposts.push({ user_id: uid, post_id: postId });
    post.repostsCount++;
    // Notify
    if (post.userId !== uid) {
      const sender = mockUsers.find(u => u.id === uid) || { displayName: 'Explorer', avatar: '' };
      mockNotifications.unshift({
        id: `notif_${Date.now()}`,
        recipient_id: post.userId,
        type: 'repost',
        sender_id: uid,
        senderName: sender.displayName || sender.display_name,
        senderAvatar: sender.avatar,
        target_post_id: postId,
        target_post_preview: post.content.substring(0, 40) + '...',
        read: false,
        createdAt: new Date().toISOString()
      });
    }
  } else {
    mockReposts.splice(index, 1);
    post.repostsCount = Math.max(0, post.repostsCount - 1);
  }
  const updatedReposts = mockReposts.filter(r => r.post_id === postId).map(r => r.user_id);
  return res.json({ repostedBy: updatedReposts });
});

// Comments fetching & dispatching
app.get('/api/posts/:postId/comments', async (req, res) => {
  const { postId } = req.params;
  if (pool) {
    try {
      const queryStr = `
        SELECT comments.*, 
               users.display_name AS "authorName", 
               users.username AS "authorHandle", 
               users.avatar AS "authorAvatar",
               users.is_verified AS "authorIsVerified"
        FROM comments
        JOIN users ON comments.user_id = users.id
        WHERE comments.post_id = $1
        ORDER BY comments.created_at ASC
      `;
      const result = await pool.query(queryStr, [postId]);
      return res.json(result.rows);
    } catch (err) {
      console.error("SQL getComments Error:", err);
    }
  }

  // Fallback
  const matches = mockComments.filter(c => c.post_id === postId).map(c => {
    const authorVal = mockUsers.find(u => u.id === c.userId) || { displayName: 'Deleted User', username: 'deleted', avatar: '', isVerified: false };
    return {
      ...c,
      authorName: authorVal.displayName || authorVal.display_name,
      authorHandle: authorVal.username,
      authorAvatar: authorVal.avatar,
      authorIsVerified: authorVal.isVerified
    };
  }).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return res.json(matches);
});

app.post('/api/posts/:postId/comments', authenticateMiddleware, async (req: any, res) => {
  const uid = req.uid;
  const { postId } = req.params;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Cannot append blank comments' });

  const customId = `comment_${Date.now()}`;
  if (pool) {
    try {
      const activeClient = await pool.connect();
      const insertQuery = `
        INSERT INTO comments (id, post_id, user_id, content)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const result = await activeClient.query(insertQuery, [customId, postId, uid, content]);
      await activeClient.query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1', [postId]);

      // Notify post author
      const postUserQuery = await activeClient.query('SELECT user_id, content FROM posts WHERE id = $1', [postId]);
      if (postUserQuery.rowCount && postUserQuery.rowCount > 0) {
        const postAuthorId = postUserQuery.rows[0].user_id;
        const postContent = postUserQuery.rows[0].content;
        if (postAuthorId !== uid) {
          await activeClient.query(`
            INSERT INTO notifications (id, recipient_id, type, sender_id, target_post_id, target_post_preview)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            `notif_${Date.now()}`,
            postAuthorId,
            'comment',
            uid,
            postId,
            content.substring(0, 40) + '...'
          ]);
        }
      }

      const authorQuery = await activeClient.query('SELECT * FROM users WHERE id = $1', [uid]);
      const author = authorQuery.rows[0];
      activeClient.release();

      return res.json({
        ...result.rows[0],
        authorName: author.display_name,
        authorHandle: author.username,
        authorAvatar: author.avatar,
        authorIsVerified: author.is_verified
      });
    } catch (err) {
      console.error("SQL comment creation Error:", err);
    }
  }

  // Fallback
  const post = mockPosts.find(p => p.id === postId);
  if (!post) return res.status(404).json({ error: 'Post not found for commenting' });
  const authorVal = mockUsers.find(u => u.id === uid) || { displayName: 'Explorer', username: 'explorer', avatar: '', isVerified: false };
  const mockComment = {
    id: customId,
    postId,
    userId: uid,
    content,
    createdAt: new Date().toISOString(),
    authorName: authorVal.displayName || authorVal.display_name,
    authorHandle: authorVal.username,
    authorAvatar: authorVal.avatar,
    authorIsVerified: authorVal.isVerified
  };
  mockComments.push(mockComment);
  post.commentsCount++;

  // Notify
  if (post.userId !== uid) {
    mockNotifications.unshift({
      id: `notif_${Date.now()}`,
      recipient_id: post.userId,
      type: 'comment',
      sender_id: uid,
      senderName: authorVal.displayName || authorVal.display_name,
      senderAvatar: authorVal.avatar,
      target_post_id: postId,
      target_post_preview: content.substring(0, 40) + '...',
      read: false,
      createdAt: new Date().toISOString()
    });
  }

  return res.json(mockComment);
});

// Follow / Unfollow user
app.post('/api/users/:userId/follow', authenticateMiddleware, async (req: any, res) => {
  const uid = req.uid;
  const targetUserId = req.params.userId;
  if (uid === targetUserId) return res.status(400).json({ error: 'You cannot follow yourself' });

  if (pool) {
    try {
      const activeClient = await pool.connect();
      const checkFollow = await activeClient.query(
        'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
        [uid, targetUserId]
      );
      let followed = false;

      if (checkFollow.rowCount === 0) {
        await activeClient.query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)', [uid, targetUserId]);
        await activeClient.query('UPDATE users SET following_count = following_count + 1 WHERE id = $1', [uid]);
        await activeClient.query('UPDATE users SET followers_count = followers_count + 1 WHERE id = $2', [targetUserId]);
        followed = true;

        // Deliver Notification
        await activeClient.query(`
          INSERT INTO notifications (id, recipient_id, type, sender_id)
          VALUES ($1, $2, $3, $4)
        `, [`notif_${Date.now()}`, targetUserId, 'follow', uid]);
      } else {
        await activeClient.query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [uid, targetUserId]);
        await activeClient.query('UPDATE users SET following_count = GREATEST(0, following_count - 1) WHERE id = $1', [uid]);
        await activeClient.query('UPDATE users SET followers_count = GREATEST(0, followers_count - 1) WHERE id = $2', [targetUserId]);
      }

      activeClient.release();
      return res.json({ followed });
    } catch (err: any) {
      console.error("SQL Follow Toggle Error:", err);
    }
  }

  // Fallback
  const fIdx = mockFollows.findIndex(f => f.follower_id === uid && f.following_id === targetUserId);
  let followed = false;
  if (fIdx === -1) {
    mockFollows.push({ follower_id: uid, following_id: targetUserId });
    const me = mockUsers.find(u => u.id === uid);
    const him = mockUsers.find(u => u.id === targetUserId);
    if (me) me.followingCount++;
    if (him) {
      him.followersCount++;
      // Notify him
      mockNotifications.unshift({
        id: `notif_${Date.now()}`,
        recipient_id: targetUserId,
        type: 'follow',
        sender_id: uid,
        senderName: me?.displayName || me?.display_name || 'Explorer',
        senderAvatar: me?.avatar || '',
        read: false,
        createdAt: new Date().toISOString()
      });
    }
    followed = true;
  } else {
    mockFollows.splice(fIdx, 1);
    const me = mockUsers.find(u => u.id === uid);
    const him = mockUsers.find(u => u.id === targetUserId);
    if (me) me.followingCount = Math.max(0, me.followingCount - 1);
    if (him) him.followersCount = Math.max(0, him.followersCount - 1);
  }
  return res.json({ followed });
});

// Retrieve all user IDs the authenticated user is following
app.get('/api/me/following', authenticateMiddleware, async (req: any, res) => {
  const uid = req.uid;
  if (pool) {
    try {
      const result = await pool.query('SELECT following_id FROM follows WHERE follower_id = $1', [uid]);
      return res.json(result.rows.map(r => r.following_id));
    } catch (err) {
      console.error(err);
    }
  }
  return res.json(mockFollows.filter(f => f.follower_id === uid).map(f => f.following_id));
});

// Follow checklist status
app.get('/api/users/:userId/follow-status', authenticateMiddleware, async (req: any, res) => {
  const uid = req.uid;
  const targetUserId = req.params.userId;
  if (pool) {
    try {
      const result = await pool.query('SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2', [uid, targetUserId]);
      return res.json({ following: result.rowCount && result.rowCount > 0 });
    } catch (err) {
      console.error("SQL follow status err:", err);
    }
  }
  const exist = mockFollows.some(f => f.follower_id === uid && f.following_id === targetUserId);
  return res.json({ following: exist });
});

// User Notifications center
app.get('/api/notifications', authenticateMiddleware, async (req: any, res) => {
  const uid = req.uid;
  if (pool) {
    try {
      // Joint query to return sender info along with notification
      const queryStr = `
        SELECT notifications.*, 
               users.display_name AS "senderName", 
               users.avatar AS "senderAvatar"
        FROM notifications
        JOIN users ON notifications.sender_id = users.id
        WHERE notifications.recipient_id = $1
        ORDER BY notifications.created_at DESC
      `;
      const result = await pool.query(queryStr, [uid]);
      return res.json(result.rows);
    } catch (err) {
      console.error("SQL get Notifications Error:", err);
    }
  }

  // Fallback
  const matches = mockNotifications.filter(n => n.recipient_id === uid).map(n => {
    const sender = mockUsers.find(u => u.id === n.sender_id) || { displayName: 'Explorer', avatar: '' };
    return {
      ...n,
      senderName: sender.displayName || sender.display_name,
      senderAvatar: sender.avatar
    };
  });
  return res.json(matches);
});

// Mark all read
app.post('/api/notifications/mark-read', authenticateMiddleware, async (req: any, res) => {
  const uid = req.uid;
  if (pool) {
    try {
      await pool.query('UPDATE notifications SET read = true WHERE recipient_id = $1', [uid]);
      return res.json({ success: true });
    } catch (err) {
      console.error("SQL mark notifications error:", err);
    }
  }
  mockNotifications.forEach(n => {
    if (n.recipient_id === uid) n.read = true;
  });
  return res.json({ success: true });
});

// ---------------- VITE / APP ASSET LOADING ----------------

async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server listening at http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Bootstrap exception:", err);
});
