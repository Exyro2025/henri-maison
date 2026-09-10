export default async function handler(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const action = body.action;
    const apiKey = process.env.CAL_API_KEY;

    const response = await fetch(`https://api.cal.com/v1/bookings?apiKey=${apiKey}`, {
      headers: { 'Content-Type': 'application/json' }
    });

    const text = await response.text();
    res.setHeader('Content-Type', 'application/json');
    res.end(text);

  } catch (e) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message }));
  }
}
