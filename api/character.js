const { isKvConfigured, kvGetJson, kvSetJson } = require("./_lib/kv");

const characterKey = (token) => `signal:character:${token}`;

module.exports = async function handler(req, res) {
  if (!isKvConfigured()) {
    res.status(503).json({ ok: false, error: "kv_not_configured" });
    return;
  }

  if (req.method === "GET") {
    const { contactToken } = req.query;
    if (!contactToken) {
      res.status(400).json({ ok: false, error: "missing_contact_token" });
      return;
    }

    const profile = await kvGetJson(characterKey(contactToken));
    res.status(200).json({ ok: true, profile: profile || null });
    return;
  }

  if (req.method === "POST") {
    const { contactToken, contactId, sessionSummary, newDecisions } = req.body || {};
    if (!contactToken) {
      res.status(400).json({ ok: false, error: "missing_contact_token" });
      return;
    }

    const existing = (await kvGetJson(characterKey(contactToken))) || {
      contactToken,
      contactId: contactId || "",
      sessionSummaries: [],
      cumulativeDecisions: [],
      updatedAt: null,
    };

    if (contactId) existing.contactId = contactId;

    if (sessionSummary && sessionSummary.sessionId) {
      const alreadySaved = existing.sessionSummaries.some(
        (s) => s.sessionId === sessionSummary.sessionId
      );
      if (!alreadySaved) {
        existing.sessionSummaries = [sessionSummary, ...existing.sessionSummaries].slice(0, 20);
      } else {
        // Update the existing entry in case arc/tone changed
        existing.sessionSummaries = existing.sessionSummaries.map((s) =>
          s.sessionId === sessionSummary.sessionId ? { ...s, ...sessionSummary } : s
        );
      }
    }

    if (Array.isArray(newDecisions) && newDecisions.length) {
      // Prepend new decisions, deduplicate by summary, keep most recent 24
      const existingSummaries = new Set(existing.cumulativeDecisions.map((d) => d.summary));
      const deduplicated = newDecisions.filter((d) => d.summary && !existingSummaries.has(d.summary));
      existing.cumulativeDecisions = [...deduplicated, ...existing.cumulativeDecisions].slice(0, 24);
    }

    existing.updatedAt = new Date().toISOString();

    await kvSetJson(characterKey(contactToken), existing);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: "method_not_allowed" });
};
