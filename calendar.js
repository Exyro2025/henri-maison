export default async function handler(req, res) {
  try {
    const { action, eventData } = req.body || {};
    const apiKey = process.env.CAL_API_KEY;
    const baseUrl = 'https://api.cal.com/v1';

    if (action === 'get_bookings') {
      const response = await fetch(`${baseUrl}/bookings?apiKey=${apiKey}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      res.status(200).json(data);
    } else {
      res.status(400).json({ error: 'Unknown action' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
