export default async function handler(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { message, type } = body;

    if (!message) {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'No message provided' }));
    }

    const telnyxKey = process.env.TELNYX_API_KEY;
    const profileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
    const madamePhone = process.env.MADAME_PHONE;
    const henriPhone = '+12137760703';

    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${telnyxKey}`
      },
      body: JSON.stringify({
        from: henriPhone,
        to: madamePhone,
        text: message,
        messaging_profile_id: profileId
      })
    });

    const data = await response.json();

    res.setHeader('Content-Type', 'application/json');
    if (response.ok) {
      res.end(JSON.stringify({ success: true, id: data.data?.id }));
    } else {
      res.end(JSON.stringify({ error: data.errors || 'Send failed', details: data }));
    }
  } catch (e) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message }));
  }
}
