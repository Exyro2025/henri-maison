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
    const endedReason = msg?.endedReason || call?.endedReason || 'unknown';

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

    // Save to henri_logs for the Activity Ledger
    try {
      const kvUrl = process.env.KV_REST_API_URL;
      const kvToken = process.env.KV_REST_API_TOKEN;

      if (kvUrl && kvToken) {
        const ledgerEntry = {
          id: Date.now(),
          date: new Date().toLocaleString('en-US', {
            timeZone: 'America/New_York',
            dateStyle: 'full',
            timeStyle: 'short'
          }),
          vendor: isMadame ? 'Madame' : callerNumber,
          task: displaySummary.substring(0, 200),
          outcome: `Call ${durationSeconds ? durationSeconds + 's' : 'completed'}`,
          amount: null,
          category: 'Calls',
          confirmation: null,
          callback_number: null,
          payment_deadline: null
        };

        await fetch(`${kvUrl}/lpush/henri_logs`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${kvToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(JSON.stringify(ledgerEntry))
        });
      }
    } catch (ledgerErr) {
      console.error('Ledger save failed:', ledgerErr.message);
    }

    // Send Pushover notification to Madame's phone
    try {
      const pushoverToken = process.env.PUSHOVER_API_TOKEN;
      const pushoverUser = process.env.PUSHOVER_USER_KEY;

      if (pushoverToken && pushoverUser) {
        const pushMessage = displaySummary.substring(0, 1000);

        await fetch('https://api.pushover.net/1/messages.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: pushoverToken,
            user: pushoverUser,
            title: `Henri — ${isMadame ? 'Call from Madame' : 'Call Summary'}`,
            message: pushMessage,
            priority: 0,
            sound: 'intermission'
          })
        });
      }
    } catch (pushErr) {
      console.error('Pushover send failed:', pushErr.message);
    }

    // Send Email to Madame
    try {
      const resendKey = process.env.RESEND_API_KEY;
      const madameEmail = process.env.MADAME_EMAIL;

      if (resendKey && madameEmail) {
        const emailHtml = `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #0a0a0a; color: #e8e0d0;">
            <div style="text-align: center; border-bottom: 1px solid #7a6230; padding-bottom: 20px; margin-bottom: 24px;">
              <div style="font-size: 36px; color: #c9a84c; letter-spacing: 0.3em; margin-bottom: 4px;">H</div>
              <div style="font-size: 11px; color: #7a6230; letter-spacing: 0.4em; text-transform: uppercase;">Henri — Call Summary</div>
            </div>
            <p style="font-style: italic; color: #9a9080; margin-bottom: 24px;">Madame,</p>
            <p style="line-height: 1.6; margin-bottom: 24px;">A call has concluded. The summary is below:</p>
            <div style="background: #1a1a1a; padding: 20px; border-left: 2px solid #c9a84c; margin-bottom: 24px; line-height: 1.7;">
              ${displaySummary}
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
              <tr><td style="padding: 6px 0; color: #9a9080; width: 140px;">From</td><td style="padding: 6px 0;">${isMadame ? 'Madame' : callerNumber}</td></tr>
              <tr><td style="padding: 6px 0; color: #9a9080;">Duration</td><td style="padding: 6px 0;">${durationSeconds ? durationSeconds + ' seconds' : 'N/A'}</td></tr>
              <tr><td style="padding: 6px 0; color: #9a9080;">Ended</td><td style="padding: 6px 0;">${endedReason}</td></tr>
            </table>
            ${transcript ? `
            <details style="margin-bottom: 24px;">
              <summary style="color: #c9a84c; cursor: pointer; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;">View Transcript</summary>
              <div style="margin-top: 12px; padding: 16px; background: #111; font-size: 12px; line-height: 1.6; color: #9a9080; white-space: pre-wrap;">${transcript.substring(0, 2000)}</div>
            </details>` : ''}
            <p style="font-style: italic; color: #9a9080; line-height: 1.6; border-top: 1px solid #222; padding-top: 20px;">
              I remain, as always, entirely at your service.<br>
              <span style="color: #c9a84c;">— Henri</span>
            </p>
          </div>
        `;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendKey}`
          },
          body: JSON.stringify({
            from: 'Henri <henri@resend.dev>',
            to: madameEmail,
            subject: 'Henri — Call Summary',
            html: emailHtml
          })
        });
      }
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
    }

    return res.status(200).json({ success: true, record });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
