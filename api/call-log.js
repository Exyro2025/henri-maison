// api/call-log.js
// Returns stored call log for the Henri app to display notifications

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const log = global.callLog || [];
  return res.status(200).json({ calls: log });
}
