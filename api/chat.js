export default async function handler(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());

    // Convert Gemini format to OpenAI format for OpenRouter
    const systemText = body.systemInstruction?.parts?.[0]?.text || '';
    const messages = [
      ...(systemText ? [{ role: 'system', content: systemText }] : []),
      ...(body.contents || []).map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.parts?.[0]?.text || ''
      }))
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://henri-maison.vercel.app',
        'X-Title': 'Henri Personal Butler'
      },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages })
    });

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || '';
text = text.replace(/\[.*?\]/gs, '').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    // Return in Gemini format so index.html can parse it
    res.status(200).json({
      candidates: [{ content: { parts: [{ text }] } }]
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
