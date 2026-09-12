// api/webhook.js
// Receives Vapi post-call webhooks and stores call summaries in Upstash Redis

import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const CALL_LOG_KEY = 'henri:call-log';
const MAX_CALLS = 50;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const type = body?.message?.type;

    if (type !== 'end-of-call-report') {
      return res.status(200).json({ received: true });
    }

    const call = body.message;
    const callerNumber = call?.call?.customer?.number || 'Unknown';
    const startedAt = call?.call?.startedAt || new Date().toISOString();
    const endedAt = call?.call?.endedAt || new Date().toISOString();
    const summary = call?.summary || null;
    const transcript = call?.transcript || null;
    const durationSeconds = call?.call?.endedAt && call?.call?.startedAt
      ? Math.round((new Date(call.call.endedAt) - new Date(call.call.startedAt)) / 1000)
      : null;

    const isMadame = callerNumber === '+14159302512';

    const record = {
      id: call?.call?.id || Date.now().toString(),
      callerNumber,
      isMadame,
      startedAt,
      endedAt,
      durationSeconds,
      summary,
      transcript,
      createdAt: new Date().toISOString()
    };

    await redis.lpush(CALL_LOG_KEY, JSON.stringify(record));
    await redis.ltrim(CALL_LOG_KEY, 0, MAX_CALLS - 1);

    return res.status(200).json({ success: true, record });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
