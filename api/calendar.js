export default async function handler(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const { action, eventData } = JSON.parse(Buffer.concat(chunks).toString());
    const apiKey = process.env.CAL_API_KEY;
    const baseUrl = 'https://api.cal.com/v1';

    if (action === 'get_bookings') {
      const response = await fetch(`${baseUrl}/bookings?apiKey=${apiKey}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      res.status(200).json(data);

    } else if (action === 'create_booking' && eventData) {
      const response = await fetch(`${baseUrl}/bookings?apiKey=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      const data = await response.json();
      res.status(200).json(data);

    } else {
      res.status(400).json({ error: 'Unknown action or missing data' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
