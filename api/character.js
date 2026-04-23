const { isKvConfigured, kvGetJson, kvSetJson } = require("./_lib/kv");
const {
  isSupabaseConfigured,
  upsertPlayer,
  getProfile,
  upsertProfile,
  sbGet,
} = require("./_lib/supabase");

const characterKey = (token) => `signal:character:${token}`;

module.exports = async function handler(req, res) {
  if (!isKvConfigured() && !isSupabaseConfigured()) {
    res.status(503).json({ ok: false, error: "no_persistence_configured" });
    return;
  }

  // ────────────────────────────────────────────────────────
  // GET — load cross-session character profile
  // Supabase-first; falls back to KV if Supabase has nothing.
  // ────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { contactToken } = req.query;
    if (!contactToken) {
      res.status(400).json({ ok: false, error: "missing_contact_token" });
      return;
    }

    let profile = null;

    // Try Supabase first
    if (isSupabaseConfigured()) {
      try {
        const sbProfile = await getProfile(contactToken);
        if (sbProfile) {
          // Normalize Supabase profile to match the shape KV returns
          profile = {
            contactToken,
            contactId: (await sbGet("us_players", { contact_token: contactToken }))?.contact_id || "",
            sessionSummaries: sbProfile.session_summaries || [],
            cumulativeDecisions: sbProfile.cumulative_decisions || [],
            idleEvents: sbProfile.idle_events || [],
            echoQuests: sbProfile.echo_quests || [],
            behavioral_model: sbProfile.behavioral_model || null,
            trait_totals: sbProfile.trait_totals || null,
            lastPlayedAt: sbProfile.updated_at || null,
            updatedAt: sbProfile.updated_at || null,
          };

          // Mark idle events read + echo quests seen in Supabase
          let dirty = false;
          const idleEvents = profile.idleEvents;
          if (idleEvents.some((e) => !e.read)) {
            profile.idleEvents = idleEvents.map((e) => ({ ...e, read: true }));
            dirty = true;
          }
          const echoQuests = profile.echoQuests;
          if (echoQuests.some((q) => !q.seen)) {
            profile.echoQuests = echoQuests.map((q) => ({ ...q, seen: true }));
            dirty = true;
          }
          if (dirty) {
            await upsertProfile(contactToken, {
              idle_events: profile.idleEvents,
              echo_quests: profile.echoQuests,
            });
          }
        }
      } catch (err) {
        console.error("Supabase character GET error:", err.message);
      }
    }

    // Fall back to KV if Supabase had nothing
    if (!profile && isKvConfigured()) {
      const kvProfile = await kvGetJson(characterKey(contactToken));
      if (kvProfile) {
        let dirty = false;
        if ((kvProfile.idleEvents || []).some((e) => !e.read)) {
          kvProfile.idleEvents = (kvProfile.idleEvents || []).map((e) => ({ ...e, read: true }));
          dirty = true;
        }
        if ((kvProfile.echoQuests || []).some((q) => !q.seen)) {
          kvProfile.echoQuests = (kvProfile.echoQuests || []).map((q) => ({ ...q, seen: true }));
          dirty = true;
        }
        if (dirty) {
          await kvSetJson(characterKey(contactToken), kvProfile);
        }
        profile = kvProfile;
      }
    }

    if (profile) {
      // Refresh idle index — player is active
      try {
        const { updateIdleIndex } = require("./idle");
        await updateIdleIndex(contactToken, profile.contactId, profile.isNpc || false);
      } catch (_) {}
    }

    res.status(200).json({ ok: true, profile: profile || null });
    return;
  }

  // ────────────────────────────────────────────────────────
  // POST — save session summary + new decisions
  // Writes to both Supabase and KV.
  // ────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const {
      contactToken,
      contactId,
      sessionSummary,
      newDecisions,
      isNpc,
      resolvedQuestIds,
      notifyEmail,
    } = req.body || {};

    if (!contactToken) {
      res.status(400).json({ ok: false, error: "missing_contact_token" });
      return;
    }

    // ── KV write ─────────────────────────────────────────
    if (isKvConfigured()) {
      const existing = (await kvGetJson(characterKey(contactToken))) || {
        contactToken,
        contactId: contactId || "",
        isNpc: isNpc || false,
        sessionSummaries: [],
        cumulativeDecisions: [],
        idleEvents: [],
        echoQuests: [],
        notifyEmail: null,
        lastPlayedAt: null,
        updatedAt: null,
      };

      if (contactId) existing.contactId = contactId;
      if (typeof isNpc === "boolean") existing.isNpc = isNpc;
      if (notifyEmail) existing.notifyEmail = notifyEmail;

      if (Array.isArray(resolvedQuestIds) && resolvedQuestIds.length) {
        existing.echoQuests = (existing.echoQuests || []).map((q) =>
          resolvedQuestIds.includes(q.id)
            ? { ...q, resolved: true, resolvedAt: new Date().toISOString() }
            : q
        );
      }

      if (sessionSummary?.sessionId) {
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
    }

    // ── Supabase write ────────────────────────────────────
    if (isSupabaseConfigured()) {
      try {
        // Ensure player row exists
        await upsertPlayer(contactToken, { contactId, isNpc, notifyEmail });

        const sbProfile = await getProfile(contactToken);
        const existingSummaries = sbProfile?.session_summaries || [];
        const existingDecisions = sbProfile?.cumulative_decisions || [];
        let echoQuests = sbProfile?.echo_quests || [];

        // Merge session summary
        let updatedSummaries = existingSummaries;
        if (sessionSummary?.sessionId) {
          const alreadySaved = existingSummaries.some((s) => s.sessionId === sessionSummary.sessionId);
          if (!alreadySaved) {
            updatedSummaries = [sessionSummary, ...existingSummaries].slice(0, 20);
          } else {
            updatedSummaries = existingSummaries.map((s) =>
              s.sessionId === sessionSummary.sessionId ? { ...s, ...sessionSummary } : s
            );
          }
        }

        // Merge decisions
        let updatedDecisions = existingDecisions;
        if (Array.isArray(newDecisions) && newDecisions.length) {
          const seen = new Set(existingDecisions.map((d) => d.summary));
          const deduped = newDecisions.filter((d) => d.summary && !seen.has(d.summary));
          updatedDecisions = [...deduped, ...existingDecisions].slice(0, 24);
        }

        // Mark quests resolved
        if (Array.isArray(resolvedQuestIds) && resolvedQuestIds.length) {
          echoQuests = echoQuests.map((q) =>
            resolvedQuestIds.includes(q.id)
              ? { ...q, resolved: true, resolvedAt: new Date().toISOString() }
              : q
          );
        }

        await upsertProfile(contactToken, {
          session_summaries: updatedSummaries,
          cumulative_decisions: updatedDecisions,
          echo_quests: echoQuests,
        });
      } catch (err) {
        console.error("Supabase character POST error:", err.message);
      }
    }

    // Refresh idle index
    try {
      const { updateIdleIndex } = require("./idle");
      await updateIdleIndex(contactToken, contactId || "", isNpc || false);
    } catch (_) {}

    // Trigger shadow generation if eligible — fire-and-forget
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && !isNpc && isKvConfigured()) {
      try {
        const kvProfile = await kvGetJson(characterKey(contactToken));
        const { qualifiesForShadow, generateShadow } = require("./shadow");
        if (kvProfile && qualifiesForShadow(kvProfile)) {
          generateShadow(contactToken, apiKey).catch((err) =>
            console.error("Shadow generation error:", err.message)
          );
        }
      } catch (_) {}
    }

    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: "method_not_allowed" });
};
