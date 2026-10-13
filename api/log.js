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
        category: body.category || 'General'
      };

      await fetch(`${kvUrl}/lpush/henri_logs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(JSON.stringify(entry))
      });

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
