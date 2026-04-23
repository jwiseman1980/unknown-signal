/**
 * supabase.js — Zero-dependency Supabase REST client for Unknown Signal.
 *
 * Uses fetch directly (no npm package) to match the project's dependency-free architecture.
 * All calls go to the HonorBase Project A instance (esoogmdwzcarvlodwbue).
 *
 * Required env vars:
 *   SUPABASE_URL             https://esoogmdwzcarvlodwbue.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  (server-side only, bypasses RLS)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

async function sbFetch(path, options = {}) {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");

  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Get the first row matching the given column→value equality conditions.
 * @param {string} table
 * @param {Record<string, string>} where  e.g. { contact_token: "abc" }
 * @returns {object|null}
 */
async function sbGet(table, where) {
  const qs = Object.entries(where)
    .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
    .join("&");
  const rows = await sbFetch(`/${table}?${qs}&limit=1`);
  return rows?.[0] ?? null;
}

/**
 * Upsert a single row. Conflicts resolved on the given column (defaults to id).
 * Returns the upserted row.
 */
async function sbUpsert(table, data, onConflict = "id") {
  const rows = await sbFetch(`/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(data),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

/**
 * Insert a single row. Returns the inserted row.
 */
async function sbInsert(table, data) {
  const rows = await sbFetch(`/${table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

/**
 * Update rows matching where. Returns the updated rows.
 */
async function sbUpdate(table, data, where) {
  const qs = Object.entries(where)
    .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
    .join("&");
  return sbFetch(`/${table}?${qs}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
}

/**
 * Ensure a player row exists for this contact_token. Returns the player row.
 * Creates it if missing. Updates last_played_at and session_count on each call.
 */
async function upsertPlayer(contactToken, { contactId, selfLabel, isNpc, notifyEmail } = {}) {
  const existing = await sbGet("us_players", { contact_token: contactToken });

  if (existing) {
    const updates = {
      last_played_at: new Date().toISOString(),
    };
    if (contactId && !existing.contact_id) updates.contact_id = contactId;
    if (selfLabel !== undefined) updates.self_label = selfLabel;
    if (notifyEmail) updates.notify_email = notifyEmail;
    await sbUpdate("us_players", updates, { contact_token: contactToken });
    return { ...existing, ...updates };
  }

  return sbInsert("us_players", {
    contact_token: contactToken,
    contact_id: contactId || null,
    self_label: selfLabel || "",
    is_npc: isNpc || false,
    notify_email: notifyEmail || null,
    session_count: 0,
    last_played_at: new Date().toISOString(),
  });
}

/**
 * Increment session_count for a player.
 */
async function incrementSessionCount(contactToken) {
  const player = await sbGet("us_players", { contact_token: contactToken });
  if (!player) return;
  await sbUpdate(
    "us_players",
    { session_count: (player.session_count || 0) + 1, last_played_at: new Date().toISOString() },
    { contact_token: contactToken }
  );
}

/**
 * Get the player profile (cross-session history + behavioral model).
 * Returns null if not found.
 */
async function getProfile(contactToken) {
  return sbGet("us_player_profiles", { contact_token: contactToken });
}

/**
 * Upsert a player profile. Merges arrays with existing data.
 */
async function upsertProfile(contactToken, updates) {
  const player = await sbGet("us_players", { contact_token: contactToken });
  if (!player) return null;

  const existing = await sbGet("us_player_profiles", { contact_token: contactToken });

  if (!existing) {
    return sbInsert("us_player_profiles", {
      player_id: player.id,
      contact_token: contactToken,
      cumulative_decisions: updates.cumulative_decisions || [],
      session_summaries: updates.session_summaries || [],
      idle_events: updates.idle_events || [],
      echo_quests: updates.echo_quests || [],
      behavioral_model: updates.behavioral_model || {},
      trait_totals: updates.trait_totals || {},
      updated_at: new Date().toISOString(),
    });
  }

  const patch = { updated_at: new Date().toISOString() };

  if (updates.cumulative_decisions !== undefined) patch.cumulative_decisions = updates.cumulative_decisions;
  if (updates.session_summaries !== undefined) patch.session_summaries = updates.session_summaries;
  if (updates.idle_events !== undefined) patch.idle_events = updates.idle_events;
  if (updates.echo_quests !== undefined) patch.echo_quests = updates.echo_quests;
  if (updates.behavioral_model !== undefined) patch.behavioral_model = updates.behavioral_model;
  if (updates.trait_totals !== undefined) patch.trait_totals = updates.trait_totals;

  await sbUpdate("us_player_profiles", patch, { contact_token: contactToken });
  return { ...existing, ...patch };
}

/**
 * Append a behavioral observation to the player's model.
 * Also updates trait totals and derived archetype.
 * This is called fire-and-forget after each world exchange.
 */
async function updateBehavioralModel(contactToken, { traitChanges, dominantTone, observation, turnNumber, sessionCount, currentTraits }) {
  const profile = await sbGet("us_player_profiles", { contact_token: contactToken });
  if (!profile) return;

  const model = profile.behavioral_model || {};
  const traitTotals = { ...((profile.trait_totals) || {}) };

  // Accumulate trait changes
  for (const [trait, delta] of Object.entries(traitChanges || {})) {
    traitTotals[trait] = (traitTotals[trait] || 0) + Number(delta);
  }

  // Seed trait totals from current session state if first time seeing them
  for (const [trait, val] of Object.entries(currentTraits || {})) {
    if (traitTotals[trait] === undefined) traitTotals[trait] = Number(val) || 0;
  }

  // Derive dominant trait from totals
  const dominantTrait = Object.entries(traitTotals)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || model.dominant_trait || "";

  // Derive archetype from dominant trait
  const archetypeMap = {
    guarded: "The Isolationist",
    confessional: "The Confessor",
    controlling: "The Operator",
    curious: "The Seeker",
    performative: "The Performer",
    vulnerable: "The Exposed",
  };
  const archetype = archetypeMap[dominantTrait] || model.archetype || "";

  // Append observation
  const observationLog = [...(model.observation_log || [])];
  if (observation) {
    observationLog.push({
      at: new Date().toISOString(),
      session: sessionCount || 1,
      turn: turnNumber || 0,
      note: observation,
    });
    // Keep the last 60 observations
    if (observationLog.length > 60) observationLog.splice(0, observationLog.length - 60);
  }

  // Track tone history
  const toneHistory = [...(model.session_tone_history || [])];
  if (dominantTone && toneHistory[toneHistory.length - 1] !== dominantTone) {
    toneHistory.push(dominantTone);
    if (toneHistory.length > 12) toneHistory.shift();
  }

  const updatedModel = {
    ...model,
    archetype,
    dominant_trait: dominantTrait,
    observation_log: observationLog,
    session_tone_history: toneHistory,
    total_turns: (model.total_turns || 0) + 1,
    last_updated_at: new Date().toISOString(),
  };

  await sbUpdate(
    "us_player_profiles",
    { behavioral_model: updatedModel, trait_totals: traitTotals, updated_at: new Date().toISOString() },
    { contact_token: contactToken }
  );
}

/**
 * Save a single conversation turn to us_conversation_turns.
 */
async function saveTurn(contactToken, { playerId, sessionId, turnNumber, playerInput, echoReplies, stateChanges, narrativeUpdates, traitSnapshot, scene, behavioralObservation }) {
  try {
    await sbInsert("us_conversation_turns", {
      player_id: playerId || null,
      session_id: sessionId || null,
      contact_token: contactToken,
      turn_number: turnNumber || 0,
      player_input: playerInput,
      echo_replies: echoReplies || [],
      state_changes: stateChanges || {},
      narrative_updates: narrativeUpdates || null,
      trait_snapshot: traitSnapshot || null,
      scene: scene || null,
      behavioral_observation: behavioralObservation || null,
    });
  } catch (err) {
    // Fire-and-forget — log but don't throw
    console.error("saveTurn error:", err.message);
  }
}

module.exports = {
  isSupabaseConfigured,
  sbGet,
  sbUpsert,
  sbInsert,
  sbUpdate,
  upsertPlayer,
  incrementSessionCount,
  getProfile,
  upsertProfile,
  updateBehavioralModel,
  saveTurn,
};
