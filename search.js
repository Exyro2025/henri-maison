export default async function handler(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const { query } = JSON.parse(Buffer.concat(chunks).toString());

    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${process.env.SERPAPI_KEY}&num=3`;
    const response = await fetch(url);
    const data = await response.json();

    const results = (data.organic_results || []).slice(0, 3).map(r => ({
      title: r.title,
      snippet: r.snippet,
      link: r.link
    }));

    res.status(200).json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
