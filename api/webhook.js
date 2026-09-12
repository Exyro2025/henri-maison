// api/webhook.js
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

    // Log the full raw payload so we can see what Vapi sends
    console.log('VAPI WEBHOOK PAYLOAD:', JSON.stringify(body, null, 2));

    const type = body?.message?.type;

    if (type !== 'end-of-call-report') {
      return res.status(200).json({ received: true });
    }

    const msg = body.message;
    const call = msg?.call || {};
    const callerNumber = call?.customer?.number || 'Unknown';
    const startedAt = call?.startedAt || new Date().toISOString();
    const endedAt = call?.endedAt || new Date().toISOString();
    const durationSeconds = call?.endedAt && call?.startedAt
      ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000)
      : null;

    const summary = msg?.summary || null;
    const transcript = msg?.transcript || null;

    console.log('SUMMARY:', summary);
    console.log('TRANSCRIPT:', transcript);

    let displaySummary = summary;
    if (!displaySummary && transcript) {
      displaySummary = transcript.length > 500
        ? '...' + transcript.slice(-500)
        : transcript;
    }
    if (!displaySummary) displaySummary = 'No summary available.';

    const isMadame = callerNumber === '+14159302512';

    const record = {
      id: call?.id || Date.now().toString(),
      callerNumber,
      isMadame,
      startedAt,
      endedAt,
      durationSeconds,
      summary: displaySummary,
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
