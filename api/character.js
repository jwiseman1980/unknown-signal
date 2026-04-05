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

    // Mark idle events as read now that player has seen them
    if (profile && (profile.idleEvents || []).some((e) => !e.read)) {
      profile.idleEvents = (profile.idleEvents || []).map((e) => ({ ...e, read: true }));
      await kvSetJson(characterKey(contactToken), profile);
    }

    // Refresh the idle index timestamp — player is active
    if (profile) {
      const { updateIdleIndex } = require("./idle");
      await updateIdleIndex(contactToken, profile.contactId, profile.isNpc || false);
    }

    res.status(200).json({ ok: true, profile: profile || null });
    return;
  }

  if (req.method === "POST") {
    const { contactToken, contactId, sessionSummary, newDecisions, isNpc } = req.body || {};
    if (!contactToken) {
      res.status(400).json({ ok: false, error: "missing_contact_token" });
      return;
    }

    const existing = (await kvGetJson(characterKey(contactToken))) || {
      contactToken,
      contactId: contactId || "",
      isNpc: isNpc || false,
      sessionSummaries: [],
      cumulativeDecisions: [],
      idleEvents: [],
      lastPlayedAt: null,
      updatedAt: null,
    };

    if (contactId) existing.contactId = contactId;
    if (typeof isNpc === "boolean") existing.isNpc = isNpc;

    if (sessionSummary && sessionSummary.sessionId) {
      const alreadySaved = existing.sessionSummaries.some(
        (s) => s.sessionId === sessionSummary.sessionId
      );
      if (!alreadySaved) {
        existing.sessionSummaries = [sessionSummary, ...existing.sessionSummaries].slice(0, 20);
      } else {
        existing.sessionSummaries = existing.sessionSummaries.map((s) =>
          s.sessionId === sessionSummary.sessionId ? { ...s, ...sessionSummary } : s
        );
      }
    }

    if (Array.isArray(newDecisions) && newDecisions.length) {
      const existingSummaries = new Set(existing.cumulativeDecisions.map((d) => d.summary));
      const deduplicated = newDecisions.filter((d) => d.summary && !existingSummaries.has(d.summary));
      existing.cumulativeDecisions = [...deduplicated, ...existing.cumulativeDecisions].slice(0, 24);
    }

    existing.lastPlayedAt = new Date().toISOString();
    existing.updatedAt = new Date().toISOString();

    await kvSetJson(characterKey(contactToken), existing);

    // Update the idle index so the cron knows this player was active
    const { updateIdleIndex } = require("./idle");
    await updateIdleIndex(contactToken, existing.contactId, existing.isNpc || false);

    // Trigger shadow generation if the player now qualifies — fire and forget
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && !existing.isNpc) {
      const { qualifiesForShadow, generateShadow } = require("./shadow");
      if (qualifiesForShadow(existing)) {
        generateShadow(contactToken, apiKey).catch((err) =>
          console.error("Shadow generation error:", err.message)
        );
      }
    }

    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: "method_not_allowed" });
};
