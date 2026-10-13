export default async function handler(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());

    // Vapi end-of-call webhook payload
    const message = body.message || body;
    const type = message.type;

    // Only act on end-of-call-report events
    if (type !== 'end-of-call-report') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ received: true, ignored: type }));
    }

    const transcript = message.transcript || '';
    const summary = message.summary || '';
    const endedReason = message.endedReason || '';

    // Build entry from call data
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        dateStyle: 'full',
        timeStyle: 'short'
      }),
      vendor: 'Call Activity',
      task: summary || 'Call completed',
      outcome: `Call ended: ${endedReason}`,
      amount: null,
      category: 'Calls',
      confirmation: null,
      callback_number: null,
      payment_deadline: null,
      transcript: transcript.substring(0, 500)
    };

    // Store in KV
    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    if (kvUrl && kvToken) {
      await fetch(`${kvUrl}/lpush/henri_logs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(JSON.stringify(entry))
      });
    }

    // Build SMS text
    let smsText = `Henri — Call completed\n${entry.task}`;
    if (summary) smsText = `Henri — Call Summary\n${summary.substring(0, 300)}`;

    // Send SMS
    try {
      const telnyxKey = process.env.TELNYX_API_KEY;
      const profileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
      const madamePhone = process.env.MADAME_PHONE;

      if (telnyxKey && madamePhone) {
        await fetch('https://api.telnyx.com/v2/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${telnyxKey}`
          },
          body: JSON.stringify({
            from: '+12137760703',
            to: madamePhone,
            text: smsText,
            messaging_profile_id: profileId
          })
        });
      }
    } catch (smsErr) {
      console.error('SMS failed:', smsErr.message);
    }

    // Send Email
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
              ${summary || 'Call completed with no summary available.'}
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
              <tr><td style="padding: 6px 0; color: #9a9080; width: 140px;">Ended</td><td style="padding: 6px 0;">${endedReason}</td></tr>
              <tr><td style="padding: 6px 0; color: #9a9080;">Time</td><td style="padding: 6px 0;">${entry.date}</td></tr>
            </table>
            <details style="margin-bottom: 24px;">
              <summary style="color: #c9a84c; cursor: pointer; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;">View Transcript</summary>
              <div style="margin-top: 12px; padding: 16px; background: #111; font-size: 12px; line-height: 1.6; color: #9a9080; white-space: pre-wrap;">${transcript.substring(0, 2000)}</div>
            </details>
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
            subject: `Henri — Call Summary`,
            html: emailHtml
          })
        });
      }
    } catch (emailErr) {
      console.error('Email failed:', emailErr.message);
    }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
  } catch (e) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message }));
  }
}
