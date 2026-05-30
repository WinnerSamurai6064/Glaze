import type { VercelRequest, VercelResponse } from '@vercel/node';
import firebaseConfig from '../firebase-applet-config.json';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.status(200).json(firebaseConfig);
}
