const { isKvConfigured, kvGetJson, kvSetJson, kvIncr } = require("./_lib/kv");
const { isSupabaseConfigured, upsertPlayer, incrementSessionCount } = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  if (!isKvConfigured() && !isSupabaseConfigured()) {
    res.status(503).json({ ok: false, error: "no_persistence_configured" });
    return;
  }

  const { contactToken, selfLabel = "" } = req.body || {};
  if (!contactToken) {
    res.status(400).json({ ok: false, error: "missing_contact_token" });
    return;
  }

  // ── KV path (existing behavior, kept for backward compatibility) ─────────
  let contactId = null;
  let sessions = 1;

  if (isKvConfigured()) {
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
      contactId = updated.contactId;
      sessions = updated.sessions;
    } else {
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
      contactId = created.contactId;
      sessions = created.sessions;
    }
  }

  // ── Supabase path (new — upserts us_players, increments session_count) ───
  if (isSupabaseConfigured()) {
    try {
      const player = await upsertPlayer(contactToken, { contactId, selfLabel });
      // For players that exist only in Supabase (no KV), synthesize a contact ID
      if (!contactId && player) {
        contactId = player.contact_id || `#${player.id.slice(0, 6)}`;
        sessions = (player.session_count || 0) + 1;
      }
      // Always increment session count on new contact registration
      await incrementSessionCount(contactToken);
    } catch (err) {
      console.error("Supabase contact upsert error:", err.message);
      // Non-fatal — KV is still the source of truth if configured
    }
  }

  if (!contactId) {
    res.status(503).json({ ok: false, error: "could_not_assign_contact_id" });
    return;
  }

  res.status(200).json({ ok: true, contactId, sessions, selfLabel });
};
