export default async function handler(req, res) {
  try {
    const { phoneNumber, task } = req.body;
    
    const response = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`
      },
      body: JSON.stringify({
        phoneNumberId: '73799c0b-0c43-4a6a-ab52-bc91ccdd6dad',
        assistantId: '31f81cc8-4b81-44f8-b038-550bcfad1a00',
        customer: { number: phoneNumber },
        assistantOverrides: {
          firstMessage: task
        }
      })
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
