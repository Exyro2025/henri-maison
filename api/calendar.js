export default async function handler(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const { action } = JSON.parse(Buffer.concat(chunks).toString());
    const apiKey = process.env.CAL_API_KEY;

    // Try v2 first
    let response = await fetch('https://api.cal.com/v2/bookings?status=upcoming', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'cal-api-version': '2024-08-13',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    let data = await response.json();

    // If v2 fails or returns error, fall back to v1
    if (!response.ok || data.error || data.status === 'error') {
      response = await fetch(`https://api.cal.com/v1/bookings?apiKey=${apiKey}&upcoming=true`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      data = await response.json();
    }

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
