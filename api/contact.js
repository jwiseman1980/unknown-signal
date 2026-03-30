const { isKvConfigured, kvGetJson, kvSetJson, kvIncr } = require("./_lib/kv");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  if (!isKvConfigured()) {
    res.status(503).json({ ok: false, error: "kv_not_configured" });
    return;
  }

  const { contactToken, selfLabel = "" } = req.body || {};
  if (!contactToken) {
    res.status(400).json({ ok: false, error: "missing_contact_token" });
    return;
  }

  const key = `signal:contact:${contactToken}`;
  const existing = await kvGetJson(key);

  if (existing) {
    const updated = {
      ...existing,
      selfLabel: selfLabel || existing.selfLabel || "",
      sessions: Number(existing.sessions || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    await kvSetJson(key, updated);
    res.status(200).json({
      ok: true,
      contactId: updated.contactId,
      sessions: updated.sessions,
      selfLabel: updated.selfLabel,
    });
    return;
  }

  const nextNumber = await kvIncr("signal:next_contact_number");
  const created = {
    contactToken,
    contactId: `#${nextNumber}`,
    sessions: 1,
    selfLabel,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await kvSetJson(key, created);

  res.status(200).json({
    ok: true,
    contactId: created.contactId,
    sessions: created.sessions,
    selfLabel: created.selfLabel,
  });
};
