const { isKvConfigured, kvSetJson } = require("./_lib/kv");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  if (!isKvConfigured()) {
    res.status(503).json({ ok: false, error: "kv_not_configured" });
    return;
  }

  const { contactToken, session } = req.body || {};
  if (!contactToken || !session?.id) {
    res.status(400).json({ ok: false, error: "missing_session_payload" });
    return;
  }

  await kvSetJson(`signal:session:${session.id}`, {
    ...session,
    contactToken,
    updatedAt: new Date().toISOString(),
  });

  res.status(200).json({ ok: true });
};
