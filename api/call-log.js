// api/call-log.js
// Returns persistent call log from Upstash Redis for the Henri app

import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const CALL_LOG_KEY = 'henri:call-log';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const raw = await redis.lrange(CALL_LOG_KEY, 0, 49);
    const calls = raw.map(item => typeof item === 'string' ? JSON.parse(item) : item);
    return res.status(200).json({ calls });
  } catch (err) {
    console.error('Call log error:', err);
    return res.status(500).json({ calls: [] });
  }
}
