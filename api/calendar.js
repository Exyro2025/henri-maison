export default async function handler(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const { action, title, startTime, endTime, notes } = JSON.parse(Buffer.concat(chunks).toString());
    const apiKey = process.env.CAL_API_KEY;

    if (action === 'get_bookings') {
      const response = await fetch('https://api.cal.com/v2/bookings?status=upcoming', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'cal-api-version': '2024-08-13'
        }
      });
      const data = await response.json();
      res.status(200).json(data);

    } else if (action === 'create_booking') {
      const response = await fetch('https://api.cal.com/v2/bookings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'cal-api-version': '2024-08-13'
        },
        body: JSON.stringify({
          eventTypeId: 1,
          start: startTime,
          attendee: {
            name: 'Madame Australia',
            email: 'lelaabrams@gmail.com',
            timeZone: 'America/New_York'
          },
          title: title,
          description: notes || ''
        })
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
