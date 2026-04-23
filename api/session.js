const { isKvConfigured, kvSetJson } = require("./_lib/kv");
const { isSupabaseConfigured, sbGet, sbInsert, sbUpdate } = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  if (!isKvConfigured() && !isSupabaseConfigured()) {
    res.status(503).json({ ok: false, error: "no_persistence_configured" });
    return;
  }

  const { contactToken, session } = req.body || {};
  if (!contactToken || !session?.id) {
    res.status(400).json({ ok: false, error: "missing_session_payload" });
    return;
  }

  // ── KV write ────────────────────────────────────────────
  if (isKvConfigured()) {
    await kvSetJson(`signal:session:${session.id}`, {
      ...session,
      contactToken,
      updatedAt: new Date().toISOString(),
    });
  }

  // ── Supabase write ──────────────────────────────────────
  if (isSupabaseConfigured()) {
    try {
      const player = await sbGet("us_players", { contact_token: contactToken });
      const playerId = player?.id || null;

      const existing = await sbGet("us_sessions", { id: session.id });
      const sessionRow = {
        id: session.id,
        player_id: playerId,
        contact_token: contactToken,
        started_at: session.startedAt || new Date().toISOString(),
        ended_at: session.endedAt || null,
        summary: session.summary || null,
        story_arc: session.storyArc || null,
        dominant_tone: session.dominantTone || null,
        exchange_count: session.interactions || session.exchangeCount || 0,
        metadata: {
          threadKey: session.threadKey || null,
          selfLabel: session.selfLabel || null,
          sessionNumber: session.sessionNumber || null,
          sessionLabel: session.sessionLabel || null,
          contactId: session.contactId || null,
          invite: session.invite || null,
        },
      };

      if (existing) {
        const { id: _id, player_id: _pid, contact_token: _ct, started_at: _sa, ...patchable } = sessionRow;
        await sbUpdate("us_sessions", patchable, { id: session.id });
      } else {
        await sbInsert("us_sessions", sessionRow);
      }
    } catch (err) {
      console.error("Supabase session write error:", err.message);
    }
  }

  res.status(200).json({ ok: true });
};
