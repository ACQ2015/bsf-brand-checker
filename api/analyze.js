// Vercel Serverless Function: /api/analyze
// The browser calls THIS endpoint. This code runs on Vercel's servers, where the
// API key lives as a secret environment variable (ANTHROPIC_API_KEY). The key is
// never sent to the browser.

// Allow large image payloads (base64 images can be several MB).
export const config = {
  api: {
    bodyParser: { sizeLimit: "25mb" },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { type: "method_not_allowed", message: "Use POST." } });
    return;
  }

  // Optional shared password gate (set ACCESS_PASSWORD in Vercel to enable).
  if (process.env.ACCESS_PASSWORD) {
    const provided = req.headers["x-access-password"] || "";
    if (provided !== process.env.ACCESS_PASSWORD) {
      res.status(401).json({ error: { type: "unauthorized", message: "Wrong or missing access password." } });
      return;
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: { type: "config", message: "Server is missing ANTHROPIC_API_KEY. Set it in Vercel project settings." } });
    return;
  }

  // req.body is already parsed by Vercel when content-type is JSON.
  const body = req.body;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: { type: "bad_request", message: "Request body was not valid JSON." } });
    return;
  }

  let upstream, text;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    text = await upstream.text();
  } catch (e) {
    res.status(502).json({ error: { type: "upstream_unreachable", message: "Could not reach Anthropic: " + e.message } });
    return;
  }

  // Pass status through so the page's 429/529 retry logic still works.
  res.status(upstream.status);
  res.setHeader("content-type", "application/json");
  res.send(text);
}
