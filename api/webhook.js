// api/webhook.js
// Receives Vapi post-call webhooks and stores call summaries

const MADAME_NUMBER = '+14159302512';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const type = body?.message?.type;

    // Only process end-of-call reports
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

    // Determine if this was Madame calling or an external caller
    const isMadame = callerNumber === MADAME_NUMBER;

    // Build the notification record
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

    // Store in Vercel KV or fall back to a simple log endpoint
    // We use a global in-memory store as a simple solution
    // For persistence, add Vercel KV (free tier available)
    if (!global.callLog) global.callLog = [];
    global.callLog.unshift(record);
    if (global.callLog.length > 50) global.callLog = global.callLog.slice(0, 50);

    return res.status(200).json({ success: true, record });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
