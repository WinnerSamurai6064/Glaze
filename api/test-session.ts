import pg from 'pg';

const { Pool } = pg;
let pool: pg.Pool | null = null;
let pgError: string | null = null;

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

function userFromRow(row: any) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    avatar: row.avatar,
    coverImage: row.cover_image,
    bio: row.bio || '',
    location: row.location || '',
    website: row.website || '',
    followersCount: Number(row.followers_count || 0),
    followingCount: Number(row.following_count || 0),
    joinedDate: row.joined_date,
    isVerified: Boolean(row.is_verified)
  };
}

async function ensureUsersTable(activePool: pg.Pool) {
  await activePool.query(`
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
  `);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const fallbackUser = {
    id: 'glaze_test_user',
    email: 'tester@glaze.local',
    username: 'tester',
    displayName: 'Glaze Tester',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=82',
    coverImage: 'https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=1200',
    bio: '',
    followersCount: 0,
    followingCount: 0,
    joinedDate: `Joined ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
    isVerified: false
  };

  const activePool = getPool();
  if (!activePool) {
    return res.status(200).json({ ...fallbackUser, databaseMode: 'memory', databaseError: pgError });
  }

  try {
    await ensureUsersTable(activePool);

    const existingById = await activePool.query('SELECT * FROM users WHERE id = $1', [fallbackUser.id]);
    if ((existingById.rowCount || 0) > 0) {
      return res.status(200).json(userFromRow(existingById.rows[0]));
    }

    const existingByEmail = await activePool.query('SELECT * FROM users WHERE email = $1', [fallbackUser.email]);
    if ((existingByEmail.rowCount || 0) > 0) {
      return res.status(200).json(userFromRow(existingByEmail.rows[0]));
    }

    const created = await activePool.query(`
      INSERT INTO users (id, email, username, display_name, avatar, cover_image, bio, joined_date, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
      RETURNING *
    `, [
      fallbackUser.id,
      fallbackUser.email,
      fallbackUser.username,
      fallbackUser.displayName,
      fallbackUser.avatar,
      fallbackUser.coverImage,
      fallbackUser.bio,
      fallbackUser.joinedDate
    ]);

    return res.status(200).json(userFromRow(created.rows[0]));
  } catch (error: any) {
    return res.status(200).json({
      ...fallbackUser,
      databaseMode: 'memory',
      databaseError: error.message || String(error)
    });
  }
}
