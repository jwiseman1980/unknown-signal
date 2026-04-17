module.exports = async function handler(req, res) {
  const ablyKey = process.env.ABLY_API_KEY;
  if (!ablyKey) {
    res.status(503).json({ ok: false, error: "multiplayer_not_configured" });
    return;
  }

  const clientId = String(
    req.query?.clientId || req.body?.clientId || "anon"
  ).slice(0, 64).replace(/[^\w\-:.@]/g, "");

  const keyId = ablyKey.split(":")[0];

  try {
    const response = await fetch(
      `https://rest.ably.io/keys/${keyId}/requestToken`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(ablyKey).toString("base64")}`,
        },
        body: JSON.stringify({
          ttl: 3600000, // 1 hour
          capability: JSON.stringify({
            "scene:*": ["subscribe", "publish"],
          }),
          clientId,
        }),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      console.error("Ably token error:", response.status, body);
      res.status(502).json({ ok: false, error: "token_request_failed" });
      return;
    }

    const token = await response.json();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(token);
  } catch (error) {
    console.error("Ably token handler error:", error);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
};
