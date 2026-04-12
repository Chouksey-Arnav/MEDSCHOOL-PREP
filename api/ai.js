// api/ai.js — Vercel Serverless Function (ESM)
// Proxies requests to the Anthropic API.
// Required env var in Vercel dashboard: ANTHROPIC_API_KEY
//
// This file uses ES Module syntax (import/export default) because
// package.json has "type": "module".

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { system, message, messages } = req.body || {};

  if (!message && (!messages || !messages.length)) {
    return res.status(400).json({ error: 'Missing required field: message or messages' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Missing ANTHROPIC_API_KEY environment variable');
    return res.status(500).json({ error: 'AI service not configured. Set ANTHROPIC_API_KEY in Vercel dashboard.' });
  }

  const builtMessages = messages ? messages : [{ role: 'user', content: message }];

  const payload = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: system || 'You are MetaBrain, an elite MCAT coach. Be concise, high-yield, and use mnemonics where helpful.',
    messages: builtMessages,
  };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(response.status).json({ error: 'Anthropic API error', details: errText });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || 'No response generated.';
    return res.status(200).json({ content });

  } catch (err) {
    console.error('AI proxy error:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
