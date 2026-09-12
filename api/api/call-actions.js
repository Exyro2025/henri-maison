// api/call-actions.js
// Handles delete and save actions for call log entries

import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const CALL_LOG_KEY = 'henri:call-log';
const SAVED_LOG_KEY = 'henri:saved-calls';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, id } = req.body;

  if (!action || !id) {
    return res.status(400).json({ error: 'Missing action or id' });
  }

  try {
    if (action === 'delete') {
      // Get all calls, filter out the one to delete, rewrite
      const raw = await redis.lrange(CALL_LOG_KEY, 0, -1);
      const calls = raw.map(item => typeof item === 'string' ? JSON.parse(item) : item);
      const filtered = calls.filter(c => c.id !== id);
      await redis.del(CALL_LOG_KEY);
      if (filtered.length > 0) {
        await redis.rpush(CALL_LOG_KEY, ...filtered.map(c => JSON.stringify(c)));
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'save') {
      // Find the call and move it to saved list
      const raw = await redis.lrange(CALL_LOG_KEY, 0, -1);
      const calls = raw.map(item => typeof item === 'string' ? JSON.parse(item) : item);
      const call = calls.find(c => c.id === id);
      if (call) {
        call.saved = true;
        await redis.lpush(SAVED_LOG_KEY, JSON.stringify(call));
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'get-saved') {
      const raw = await redis.lrange(SAVED_LOG_KEY, 0, 49);
      const calls = raw.map(item => typeof item === 'string' ? JSON.parse(item) : item);
      return res.status(200).json({ calls });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Call actions error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
