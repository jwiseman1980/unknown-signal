const crypto = require("crypto");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const ABLY_API_KEY = process.env.ABLY_API_KEY;
  if (!ABLY_API_KEY || !ABLY_API_KEY.includes(":")) {
    return res.status(503).json({ ok: false, error: "ably_not_configured" });
  }

  const { clientId } = req.body || {};
  if (!clientId) {
    return res.status(400).json({ ok: false, error: "missing_client_id" });
  }

  const [keyName, keySecret] = ABLY_API_KEY.split(":");
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString("hex");
  const capability = JSON.stringify({ "signal:group:*": ["publish", "subscribe", "presence"] });
  const ttl = 3600000;

  // Ably token request signing: fields joined by newline, trailing newline required
  const textToSign = [keyName, ttl, capability, clientId, timestamp, nonce, ""].join("\n");
  const mac = crypto.createHmac("sha256", keySecret).update(textToSign).digest("base64");

  return res.status(200).json({
    ok: true,
    tokenRequest: { keyName, ttl, capability, clientId, timestamp, nonce, mac },
  });
};
