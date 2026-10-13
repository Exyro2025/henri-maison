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

      // Build message content
      let smsText = `Henri — ${entry.category}\n${entry.vendor}\n${entry.task}`;
      if (entry.outcome) smsText += `\nOutcome: ${entry.outcome}`;
      if (entry.confirmation) smsText += `\nConf #: ${entry.confirmation}`;
      if (entry.callback_number) smsText += `\nCall back: ${entry.callback_number}`;
      if (entry.payment_deadline) smsText += `\nPayment by: ${entry.payment_deadline}`;
      if (entry.amount) smsText += `\nAmount: $${entry.amount}`;

      // Send SMS confirmation to Madame
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
        console.error('SMS send failed:', smsErr.message);
      }

      // Send Email confirmation to Madame
      try {
        const resendKey = process.env.RESEND_API_KEY;
        const madameEmail = process.env.MADAME_EMAIL;

        if (resendKey && madameEmail) {
          const emailHtml = `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #0a0a0a; color: #e8e0d0;">
              <div style="text-align: center; border-bottom: 1px solid #7a6230; padding-bottom: 20px; margin-bottom: 24px;">
                <div style="font-size: 36px; color: #c9a84c; letter-spacing: 0.3em; margin-bottom: 4px;">H</div>
                <div style="font-size: 11px; color: #7a6230; letter-spacing: 0.4em; text-transform: uppercase;">Henri — Booking Confirmation</div>
              </div>
              <p style="font-style: italic; color: #9a9080; margin-bottom: 24px;">Madame,</p>
              <p style="line-height: 1.6; margin-bottom: 24px;">The following has been attended to on your behalf:</p>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr><td style="padding: 8px 0; color: #9a9080; width: 140px;">Category</td><td style="padding: 8px 0; color: #c9a84c;">${entry.category}</td></tr>
                <tr><td style="padding: 8px 0; color: #9a9080;">Vendor</td><td style="padding: 8px 0;">${entry.vendor}</td></tr>
                <tr><td style="padding: 8px 0; color: #9a9080;">Task</td><td style="padding: 8px 0;">${entry.task}</td></tr>
                ${entry.outcome ? `<tr><td style="padding: 8px 0; color: #9a9080;">Outcome</td><td style="padding: 8px 0;">${entry.outcome}</td></tr>` : ''}
                ${entry.confirmation ? `<tr><td style="padding: 8px 0; color: #9a9080;">Confirmation #</td><td style="padding: 8px 0; color: #c9a84c; font-weight: bold;">${entry.confirmation}</td></tr>` : ''}
                ${entry.callback_number ? `<tr><td style="padding: 8px 0; color: #9a9080;">Call back</td><td style="padding: 8px 0;">${entry.callback_number}</td></tr>` : ''}
                ${entry.payment_deadline ? `<tr><td style="padding: 8px 0; color: #9a9080;">Payment deadline</td><td style="padding: 8px 0; color: #d4a574;">${entry.payment_deadline}</td></tr>` : ''}
                ${entry.amount ? `<tr><td style="padding: 8px 0; color: #9a9080;">Amount</td><td style="padding: 8px 0; color: #c9a84c;">$${entry.amount}</td></tr>` : ''}
                <tr><td style="padding: 8px 0; color: #9a9080;">Logged</td><td style="padding: 8px 0; font-size: 12px;">${entry.date}</td></tr>
              </table>
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
              subject: `Henri — ${entry.category}: ${entry.vendor}`,
              html: emailHtml
            })
          });
        }
      } catch (emailErr) {
        console.error('Email send failed:', emailErr.message);
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
