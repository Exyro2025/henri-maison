export default async function handler(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());

    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    if (body.action === 'get_logs') {
      const response = await fetch(`${kvUrl}/lrange/henri_logs/0/-1`, {
        headers: { Authorization: `Bearer ${kvToken}` }
      });
      const data = await response.json();
      const logs = (data.result || []).map(entry => {
        try { return JSON.parse(entry); } catch { return entry; }
      });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ logs }));

    } else if (body.action === 'add_log') {
      const entry = {
        id: Date.now(),
        date: new Date().toLocaleString('en-US', {
          timeZone: 'America/New_York',
          dateStyle: 'full',
          timeStyle: 'short'
        }),
        vendor: body.vendor || 'Unknown',
        task: body.task || '',
        outcome: body.outcome || '',
        amount: body.amount || null,
        category: body.category || 'General',
        confirmation: body.confirmation || null,
        callback_number: body.callback_number || null,
        payment_deadline: body.payment_deadline || null
      };

      await fetch(`${kvUrl}/lpush/henri_logs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(JSON.stringify(entry))
      });

      // Send SMS confirmation to Madame
      try {
        const telnyxKey = process.env.TELNYX_API_KEY;
        const profileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
        const madamePhone = process.env.MADAME_PHONE;

        if (telnyxKey && madamePhone) {
          let smsText = `Henri — ${entry.category}\n${entry.vendor}\n${entry.task}`;
          if (entry.outcome) smsText += `\nOutcome: ${entry.outcome}`;
          if (entry.confirmation) smsText += `\nConf #: ${entry.confirmation}`;
          if (entry.callback_number) smsText += `\nCall back: ${entry.callback_number}`;
          if (entry.payment_deadline) smsText += `\nPayment by: ${entry.payment_deadline}`;
          if (entry.amount) smsText += `\nAmount: $${entry.amount}`;

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
        // Don't fail the log if SMS fails
        console.error('SMS send failed:', smsErr.message);
      }

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, entry }));

    } else {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unknown action' }));
    }
  } catch (e) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message }));
  }
}
