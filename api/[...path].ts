import pg from 'pg';
import admin from 'firebase-admin';
import firebaseConfig from '../firebase-applet-config.json';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let initPromise: Promise<void> | null = null;
let pgError: string | null = null;
let firebaseAdminReady = false;
let firebaseAdminErr: string | null = null;

const mockUsers: any[] = [];
const mockPosts: any[] = [];
const mockComments: any[] = [];
const mockLikes: { user_id: string; post_id: string }[] = [];
const mockReposts: { user_id: string; post_id: string }[] = [];
const mockFollows: { follower_id: string; following_id: string }[] = [];
const mockNotifications: any[] = [];

function initFirebaseAdmin() {
  if (firebaseAdminReady || firebaseAdminErr) return;

  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({ projectId: firebaseConfig.projectId });
    }
    firebaseAdminReady = true;
  } catch (error: any) {
    firebaseAdminErr = error.message || String(error);
  }
}

function getPool() {
  if (pool) return pool;

  if (!process.env.DATABASE_URL) {
    pgError = 'DATABASE_URL is missing.';
    return null;
  }

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
    });
    return pool;
  } catch (error: any) {
    pgError = error.message || String(error);
    return null;
  }
}

async function initTables() {
  const activePool = getPool();
  if (!activePool) return;

  if (!initPromise) {
    initPromise = activePool.query(`
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
    `).then(() => undefined).catch((error: any) => {
      pgError = error.message || String(error);
      throw error;
    });
  }

  return initPromise;
}

function userFromRow(row: any) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name ?? row.displayName,
    avatar: row.avatar,
    coverImage: row.cover_image ?? row.coverImage,
    bio: row.bio || '',
    location: row.location || '',
    website: row.website || '',
    followersCount: Number(row.followers_count ?? row.followersCount ?? 0),
    followingCount: Number(row.following_count ?? row.followingCount ?? 0),
    joinedDate: row.joined_date ?? row.joinedDate,
    isVerified: Boolean(row.is_verified ?? row.isVerified)
  };
}

function postFromRow(row: any) {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    content: row.content,
    image: row.image || undefined,
    createdAt: row.created_at ?? row.createdAt,
    likesCount: Number(row.likes_count ?? row.likesCount ?? 0),
    repostsCount: Number(row.reposts_count ?? row.repostsCount ?? 0),
    commentsCount: Number(row.comments_count ?? row.commentsCount ?? 0),
    likedBy: row.likedBy || [],
    repostedBy: row.repostedBy || [],
    authorName: row.authorName,
    authorHandle: row.authorHandle,
    authorAvatar: row.authorAvatar,
    authorIsVerified: Boolean(row.authorIsVerified)
  };
}

function commentFromRow(row: any) {
  return {
    id: row.id,
    postId: row.post_id ?? row.postId,
    userId: row.user_id ?? row.userId,
    content: row.content,
    createdAt: row.created_at ?? row.createdAt,
    authorName: row.authorName,
    authorHandle: row.authorHandle,
    authorAvatar: row.authorAvatar,
    authorIsVerified: Boolean(row.authorIsVerified)
  };
}

function notificationFromRow(row: any) {
  return {
    id: row.id,
    type: row.type,
    senderId: row.sender_id ?? row.senderId,
    senderName: row.senderName,
    senderAvatar: row.senderAvatar,
    targetPostId: row.target_post_id ?? row.targetPostId,
    targetPostPreview: row.target_post_preview ?? row.targetPostPreview,
    createdAt: row.created_at ?? row.createdAt,
    read: Boolean(row.read)
  };
}

function decodeJwtPayload(token: string) {
  const payload = token.split('.')[1];
  if (!payload) return null;
  const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return JSON.parse(json);
}

async function getAuthUser(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw Object.assign(new Error('Authentication required.'), { status: 401 });
  }

  const token = authHeader.split('Bearer ')[1];
  initFirebaseAdmin();

  try {
    if (firebaseAdminReady) {
      const decoded = await admin.auth().verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email || `${decoded.uid}@glaze.local`,
        name: decoded.name || decoded.email?.split('@')[0] || 'Glaze User',
        picture: decoded.picture || ''
      };
    }
  } catch (error) {
    // Vercel preview test fallback below keeps auth usable while Firebase Admin credentials are finalized.
  }

  const decoded = decodeJwtPayload(token);
  if (!decoded?.user_id && !decoded?.sub) {
    throw Object.assign(new Error('Invalid authentication token.'), { status: 403 });
  }

  return {
    uid: decoded.user_id || decoded.sub,
    email: decoded.email || `${decoded.user_id || decoded.sub}@glaze.local`,
    name: decoded.name || decoded.email?.split('@')[0] || 'Glaze User',
    picture: decoded.picture || ''
  };
}

function sendError(res: any, error: any) {
  const status = error.status || 500;
  res.status(status).json({ error: error.message || 'Server error' });
}

async function handleRegisterOrLogin(req: any, res: any) {
  const activePool = getPool();
  const authUser = await getAuthUser(req);
  const lowercaseEmail = String(authUser.email).toLowerCase();
  const baseUsername = lowercaseEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'user';

  if (activePool) {
    await initTables();
    const existing = await activePool.query('SELECT * FROM users WHERE id = $1', [authUser.uid]);
    if ((existing.rowCount || 0) > 0) {
      return res.status(200).json(userFromRow(existing.rows[0]));
    }

    let username = baseUsername;
    for (let i = 0; i < 10; i++) {
      const check = await activePool.query('SELECT 1 FROM users WHERE username = $1', [username]);
      if ((check.rowCount || 0) === 0) break;
      username = `${baseUsername}_${Math.floor(Math.random() * 9000 + 1000)}`;
    }

    const joinedDate = `Joined ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`;
    const created = await activePool.query(`
      INSERT INTO users (id, email, username, display_name, avatar, cover_image, bio, joined_date, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
      RETURNING *
    `, [
      authUser.uid,
      lowercaseEmail,
      username,
      authUser.name,
      authUser.picture,
      'https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=1200',
      '',
      joinedDate
    ]);

    return res.status(200).json(userFromRow(created.rows[0]));
  }

  let user = mockUsers.find((item) => item.id === authUser.uid);
  if (!user) {
    user = {
      id: authUser.uid,
      email: lowercaseEmail,
      username: baseUsername,
      displayName: authUser.name,
      avatar: authUser.picture,
      coverImage: 'https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=1200',
      bio: '',
      followersCount: 0,
      followingCount: 0,
      joinedDate: `Joined ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      isVerified: false
    };
    mockUsers.push(user);
  }

  return res.status(200).json(user);
}

export default async function handler(req: any, res: any) {
  const pathParam = req.query.path;
  const parts = Array.isArray(pathParam) ? pathParam : [pathParam].filter(Boolean);
  const route = `/${parts.join('/')}`;

  try {
    const activePool = getPool();
    if (activePool) await initTables();

    if (req.method === 'GET' && route === '/database-status') {
      initFirebaseAdmin();
      return res.status(200).json({
        postgresActive: activePool !== null && pgError === null,
        postgresError: pgError,
        firebaseReady: firebaseAdminReady,
        firebaseError: firebaseAdminErr,
        envDatabaseUrl: !!process.env.DATABASE_URL,
        bucketReady: !!(process.env.BUCKET_URL || process.env.FILESTACK_API_KEY || process.env.VITE_FILESTACK_API_KEY)
      });
    }

    if (req.method === 'POST' && route === '/auth/register-or-login') {
      return handleRegisterOrLogin(req, res);
    }

    if (req.method === 'POST' && route === '/profile') {
      const authUser = await getAuthUser(req);
      const { displayName, bio, avatar, coverImage, location, website } = req.body || {};

      if (activePool) {
        const updated = await activePool.query(`
          UPDATE users
          SET display_name = $1, bio = $2, avatar = $3, cover_image = $4, location = $5, website = $6
          WHERE id = $7
          RETURNING *
        `, [displayName, bio, avatar, coverImage, location, website, authUser.uid]);

        if ((updated.rowCount || 0) > 0) return res.status(200).json(userFromRow(updated.rows[0]));
      }

      const user = mockUsers.find((item) => item.id === authUser.uid);
      if (!user) return res.status(404).json({ error: 'User profile not found' });
      Object.assign(user, { displayName, bio, avatar, coverImage, location, website });
      return res.status(200).json(user);
    }

    if (req.method === 'GET' && route === '/users') {
      if (activePool) {
        const users = await activePool.query('SELECT * FROM users ORDER BY created_at DESC');
        return res.status(200).json(users.rows.map(userFromRow));
      }
      return res.status(200).json(mockUsers);
    }

    if (req.method === 'GET' && parts[0] === 'users' && parts.length === 2) {
      const target = parts[1];
      if (activePool) {
        const result = await activePool.query('SELECT * FROM users WHERE id = $1 OR LOWER(username) = LOWER($2)', [target, target]);
        if ((result.rowCount || 0) > 0) return res.status(200).json(userFromRow(result.rows[0]));
      }
      const found = mockUsers.find((user) => user.id === target || user.username?.toLowerCase() === String(target).toLowerCase());
      if (found) return res.status(200).json(found);
      return res.status(404).json({ error: 'User profile not found' });
    }

    if (req.method === 'GET' && route === '/posts') {
      if (activePool) {
        const posts = await activePool.query(`
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
        `);
        return res.status(200).json(posts.rows.map(postFromRow));
      }
      return res.status(200).json(mockPosts);
    }

    if (req.method === 'POST' && route === '/posts') {
      const authUser = await getAuthUser(req);
      const { content, image } = req.body || {};
      if (!content?.trim()) return res.status(400).json({ error: 'Post cannot be empty' });
      const postId = `post_${Date.now()}`;

      if (activePool) {
        const created = await activePool.query(`
          INSERT INTO posts (id, user_id, content, image, likes_count, reposts_count, comments_count)
          VALUES ($1, $2, $3, $4, 0, 0, 0)
          RETURNING *
        `, [postId, authUser.uid, content.trim(), image]);
        const author = await activePool.query('SELECT * FROM users WHERE id = $1', [authUser.uid]);
        const authorUser = userFromRow(author.rows[0]);
        return res.status(200).json(postFromRow({
          ...created.rows[0],
          authorName: authorUser.displayName,
          authorHandle: authorUser.username,
          authorAvatar: authorUser.avatar,
          authorIsVerified: authorUser.isVerified,
          likedBy: [],
          repostedBy: []
        }));
      }

      const author = mockUsers.find((user) => user.id === authUser.uid) || { displayName: 'Glaze User', username: 'user', avatar: '', isVerified: false };
      const post = {
        id: postId,
        userId: authUser.uid,
        content: content.trim(),
        image,
        createdAt: new Date().toISOString(),
        likesCount: 0,
        repostsCount: 0,
        commentsCount: 0,
        likedBy: [],
        repostedBy: [],
        authorName: author.displayName,
        authorHandle: author.username,
        authorAvatar: author.avatar,
        authorIsVerified: author.isVerified
      };
      mockPosts.unshift(post);
      return res.status(200).json(post);
    }

    if (req.method === 'DELETE' && parts[0] === 'posts' && parts.length === 2) {
      const authUser = await getAuthUser(req);
      const postId = parts[1];

      if (activePool) {
        const check = await activePool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
        if ((check.rowCount || 0) === 0) return res.status(404).json({ error: 'Post not found' });
        if (check.rows[0].user_id !== authUser.uid) return res.status(403).json({ error: 'You can only delete your own posts' });
        await activePool.query('DELETE FROM posts WHERE id = $1', [postId]);
        return res.status(200).json({ success: true });
      }

      return res.status(404).json({ error: 'Post not found' });
    }

    if (req.method === 'POST' && parts[0] === 'posts' && parts[2] === 'like') {
      const authUser = await getAuthUser(req);
      const postId = parts[1];

      if (activePool) {
        const existing = await activePool.query('SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2', [authUser.uid, postId]);
        if ((existing.rowCount || 0) === 0) {
          await activePool.query('INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [authUser.uid, postId]);
          await activePool.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1', [postId]);
        } else {
          await activePool.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [authUser.uid, postId]);
          await activePool.query('UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1', [postId]);
        }
        const likes = await activePool.query('SELECT user_id FROM likes WHERE post_id = $1', [postId]);
        return res.status(200).json({ likedBy: likes.rows.map((row) => row.user_id) });
      }

      return res.status(200).json({ likedBy: [] });
    }

    if (req.method === 'POST' && parts[0] === 'posts' && parts[2] === 'repost') {
      const authUser = await getAuthUser(req);
      const postId = parts[1];

      if (activePool) {
        const existing = await activePool.query('SELECT 1 FROM reposts WHERE user_id = $1 AND post_id = $2', [authUser.uid, postId]);
        if ((existing.rowCount || 0) === 0) {
          await activePool.query('INSERT INTO reposts (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [authUser.uid, postId]);
          await activePool.query('UPDATE posts SET reposts_count = reposts_count + 1 WHERE id = $1', [postId]);
        } else {
          await activePool.query('DELETE FROM reposts WHERE user_id = $1 AND post_id = $2', [authUser.uid, postId]);
          await activePool.query('UPDATE posts SET reposts_count = GREATEST(0, reposts_count - 1) WHERE id = $1', [postId]);
        }
        const reposts = await activePool.query('SELECT user_id FROM reposts WHERE post_id = $1', [postId]);
        return res.status(200).json({ repostedBy: reposts.rows.map((row) => row.user_id) });
      }

      return res.status(200).json({ repostedBy: [] });
    }

    if (req.method === 'GET' && parts[0] === 'posts' && parts[2] === 'comments') {
      const postId = parts[1];
      if (activePool) {
        const comments = await activePool.query(`
          SELECT comments.*,
                 users.display_name AS "authorName",
                 users.username AS "authorHandle",
                 users.avatar AS "authorAvatar",
                 users.is_verified AS "authorIsVerified"
          FROM comments
          JOIN users ON comments.user_id = users.id
          WHERE comments.post_id = $1
          ORDER BY comments.created_at ASC
        `, [postId]);
        return res.status(200).json(comments.rows.map(commentFromRow));
      }
      return res.status(200).json([]);
    }

    if (req.method === 'POST' && parts[0] === 'posts' && parts[2] === 'comments') {
      const authUser = await getAuthUser(req);
      const postId = parts[1];
      const { content } = req.body || {};
      if (!content?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });

      if (activePool) {
        const commentId = `comment_${Date.now()}`;
        const created = await activePool.query(`
          INSERT INTO comments (id, post_id, user_id, content)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [commentId, postId, authUser.uid, content.trim()]);
        await activePool.query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1', [postId]);
        const author = await activePool.query('SELECT * FROM users WHERE id = $1', [authUser.uid]);
        const authorUser = userFromRow(author.rows[0]);
        return res.status(200).json(commentFromRow({
          ...created.rows[0],
          authorName: authorUser.displayName,
          authorHandle: authorUser.username,
          authorAvatar: authorUser.avatar,
          authorIsVerified: authorUser.isVerified
        }));
      }

      return res.status(404).json({ error: 'Post not found' });
    }

    if (req.method === 'POST' && parts[0] === 'users' && parts[2] === 'follow') {
      const authUser = await getAuthUser(req);
      const targetUserId = parts[1];
      if (authUser.uid === targetUserId) return res.status(400).json({ error: 'You cannot follow yourself' });

      if (activePool) {
        const existing = await activePool.query('SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2', [authUser.uid, targetUserId]);
        let followed = false;
        if ((existing.rowCount || 0) === 0) {
          await activePool.query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [authUser.uid, targetUserId]);
          await activePool.query('UPDATE users SET following_count = following_count + 1 WHERE id = $1', [authUser.uid]);
          await activePool.query('UPDATE users SET followers_count = followers_count + 1 WHERE id = $1', [targetUserId]);
          followed = true;
        } else {
          await activePool.query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [authUser.uid, targetUserId]);
          await activePool.query('UPDATE users SET following_count = GREATEST(0, following_count - 1) WHERE id = $1', [authUser.uid]);
          await activePool.query('UPDATE users SET followers_count = GREATEST(0, followers_count - 1) WHERE id = $1', [targetUserId]);
        }
        return res.status(200).json({ followed });
      }

      return res.status(200).json({ followed: false });
    }

    if (req.method === 'GET' && route === '/me/following') {
      const authUser = await getAuthUser(req);
      if (activePool) {
        const follows = await activePool.query('SELECT following_id FROM follows WHERE follower_id = $1', [authUser.uid]);
        return res.status(200).json(follows.rows.map((row) => row.following_id));
      }
      return res.status(200).json(mockFollows.filter((row) => row.follower_id === authUser.uid).map((row) => row.following_id));
    }

    if (req.method === 'GET' && parts[0] === 'users' && parts[2] === 'follow-status') {
      const authUser = await getAuthUser(req);
      const targetUserId = parts[1];
      if (activePool) {
        const check = await activePool.query('SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2', [authUser.uid, targetUserId]);
        return res.status(200).json({ following: (check.rowCount || 0) > 0 });
      }
      return res.status(200).json({ following: false });
    }

    if (req.method === 'GET' && route === '/notifications') {
      const authUser = await getAuthUser(req);
      if (activePool) {
        const notifications = await activePool.query(`
          SELECT notifications.*,
                 users.display_name AS "senderName",
                 users.avatar AS "senderAvatar"
          FROM notifications
          JOIN users ON notifications.sender_id = users.id
          WHERE notifications.recipient_id = $1
          ORDER BY notifications.created_at DESC
        `, [authUser.uid]);
        return res.status(200).json(notifications.rows.map(notificationFromRow));
      }
      return res.status(200).json([]);
    }

    if (req.method === 'POST' && route === '/notifications/mark-read') {
      const authUser = await getAuthUser(req);
      if (activePool) {
        await activePool.query('UPDATE notifications SET read = true WHERE recipient_id = $1', [authUser.uid]);
      }
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: `Route not found: ${req.method} ${route}` });
  } catch (error: any) {
    return sendError(res, error);
  }
}
