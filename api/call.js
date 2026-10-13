export default async function handler(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { phoneNumber, task, businessName, location } = body;

    let finalNumber = phoneNumber;

    // If no phone number provided, search for it first
    if (!finalNumber && businessName) {
      const query = location
        ? `${businessName} ${location} phone number`
        : `${businessName} Ohio phone number`;
      const searchUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${process.env.SERPAPI_KEY}&num=3`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      // Try to extract phone from knowledge graph or organic results
      const phone =
        searchData.knowledge_graph?.phone ||
        searchData.organic_results?.[0]?.snippet?.match(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)?.[0] ||
        null;

      if (phone) {
        finalNumber = phone.replace(/\D/g, '');
        if (finalNumber.length === 10) finalNumber = '1' + finalNumber;
        finalNumber = '+' + finalNumber;
      } else {
        return res.status(200).json({
          error: 'no_number_found',
          message: `I was unable to find a phone number for ${businessName}. Could you provide the number, Madame?`
        });
      }
    }

    if (!finalNumber) {
      return res.status(200).json({
        error: 'no_number',
        message: 'No phone number provided. Could you provide the number, Madame?'
      });
    }

    const response = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`
      },
      body: JSON.stringify({
        phoneNumberId: '73799c0b-0c43-4a6a-ab52-bc91ccdd6dad',
        assistantId: '31f81cc8-4b81-44f8-b038-550bcfad1a00',
        customer: { number: finalNumber },
        assistantOverrides: { firstMessage: task }
      })
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
