/**
 * api/idle.js — Echo Agency (Idle Character Simulation)
 *
 * While you are offline, your Echo doesn't sleep. It acts.
 *
 * Your behavioral fingerprint — the personality profile The Echo has built from
 * everything you've done — becomes an autonomous agent in the world. But the Echo
 * is imperfect. It over-indexes on your dominant traits. It makes choices you might
 * not have made. It gets into trouble.
 *
 * When you return, you inherit what your Echo did. Their decisions are your debts,
 * your enemies, your obligations. Some of the mess is too big to clean up alone.
 *
 * Severity escalates with absence duration:
 *   < 12h  → light    (a small misstep, solvable alone)
 *   12-24h → medium   (a real problem, takes work)
 *   24-72h → heavy    (serious damage, hard to fix alone)
 *   > 72h  → critical (catastrophic — needs another player)
 *
 * Set up in vercel.json crons. Requires CRON_SECRET env var.
 */

const { isKvConfigured, kvGetJson, kvSetJson } = require("./_lib/kv");

const IDLE_INDEX_KEY = "signal:idle:index";
const MAX_PER_RUN = 10;
const MIN_IDLE_HOURS = 12;

function getIdleSeverity(hoursIdle) {
  if (hoursIdle > 168) return "catastrophic"; // 7+ days — the Echo has gone full rogue
  if (hoursIdle > 72) return "critical";
  if (hoursIdle > 24) return "heavy";
  if (hoursIdle > 12) return "medium";
  return "light";
}

module.exports = async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  if (!isKvConfigured()) {
    res.status(503).json({ ok: false, error: "kv_not_configured" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({ ok: false, error: "ai_not_configured" });
    return;
  }

  const index = (await kvGetJson(IDLE_INDEX_KEY)) || [];
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const MIN_IDLE_MS = MIN_IDLE_HOURS * 60 * 60 * 1000;

  // Prune entries inactive for 30+ days
  const active = index.filter(
    (e) => e.lastPlayedAt && now - new Date(e.lastPlayedAt).getTime() < THIRTY_DAYS_MS
  );

  // Find idle characters (absent long enough, no unread events queued)
  const eligible = active.filter(
    (e) => now - new Date(e.lastPlayedAt).getTime() >= MIN_IDLE_MS
  );

  const toProcess = eligible.slice(0, MAX_PER_RUN);
  const results = [];

  for (const entry of toProcess) {
    try {
      const charKey = `signal:character:${entry.token}`;
      const profile = await kvGetJson(charKey);
      if (!profile) continue;

      const hoursIdle = Math.floor(
        (now - new Date(entry.lastPlayedAt).getTime()) / (1000 * 60 * 60)
      );
      const severity = getIdleSeverity(hoursIdle);
      const isNpc = entry.isNpc || false;

      if (isNpc) {
        // NPCs get the simple idle event — world acted on them
        if ((profile.idleEvents || []).some((e) => !e.read)) continue;

        const event = await simulateEchoAgency(profile, hoursIdle, severity, true, apiKey);
        if (!event) continue;

        profile.idleEvents = [
          { ...event, at: new Date().toISOString(), read: false, severity, hoursIdle },
          ...(profile.idleEvents || []),
        ].slice(0, 10);
      } else {
        // Player characters get Echo Quests — structured problems from their shadow self
        const existingQuests = profile.echoQuests || [];
        // Don't stack — skip if there's already an unseen quest
        if (existingQuests.some((q) => !q.seen && !q.resolved)) continue;

        const event = await simulateEchoAgency(profile, hoursIdle, severity, false, apiKey);
        if (!event) continue;

        const questId = `eq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const quest = {
          id: questId,
          ...event,
          severity,
          hoursIdle,
          at: new Date().toISOString(),
          seen: false,
          resolved: false,
        };

        profile.echoQuests = [quest, ...existingQuests].slice(0, 8);

        // Fire notification — player should know their Echo is causing trouble
        if (profile.notifyEmail) {
          triggerNotification(profile, quest, entry.token).catch((err) =>
            console.error("Notify error:", entry.contactId, err.message)
          );
        }
      }

      profile.updatedAt = new Date().toISOString();
      await kvSetJson(charKey, profile);
      results.push({
        contactId: entry.contactId || entry.token,
        type: event.type,
        severity,
        allyNeeded: event.allyNeeded || false,
        isNpc,
      });
    } catch (err) {
      console.error("Idle agency error:", entry.contactId, err.message);
    }
  }

  // Write back pruned index
  if (active.length !== index.length) {
    await kvSetJson(IDLE_INDEX_KEY, active.slice(0, 500));
  }

  res.status(200).json({ ok: true, processed: results.length, results });
};

/**
 * Simulate what the player's Echo did while they were offline.
 * The Echo acts based on the player's behavioral profile — but imperfectly.
 * It over-indexes on dominant traits, misreads situations, causes trouble.
 * The returned event is framed as the Echo's actions becoming the player's quests.
 */
async function simulateEchoAgency(profile, hoursIdle, severity, isNpc, apiKey) {
  const decisions = (profile.cumulativeDecisions || [])
    .slice(0, 5)
    .map((d) => d.summary || d);
  const latestSession = profile.sessionSummaries?.[0];
  const arc = latestSession?.arc || "";
  const tone = latestSession?.tone || "";
  const sessionCount = profile.sessionSummaries?.length || 0;

  const daysIdle = Math.floor(hoursIdle / 24);
  const timePhrase = daysIdle > 0
    ? `${daysIdle} day${daysIdle !== 1 ? "s" : ""}`
    : `${hoursIdle} hours`;

  const severityGuides = {
    light: "The Echo made a minor misstep — a small debt incurred, a minor offense given, a promise made without thinking. Solvable alone. Annoying rather than dangerous.",
    medium: "The Echo made a real mistake — a faction is now hostile, an ally feels betrayed, or something was taken that wasn't the Echo's to take. Requires active effort to resolve. Could get worse if ignored.",
    heavy: "The Echo caused serious damage — the player is now actively hunted by someone, owes a major debt to a dangerous party, or has broken an alliance that was protecting them. Hard to fix alone. Needs help or a plan.",
    critical: "The Echo caused catastrophic fallout — open conflict with a faction, a major theft traced back to the player, a betrayal that's rippling outward. Too big to handle alone. Requires at least one other player's help to resolve without severe lasting consequence.",
    catastrophic: "The Echo ran unchecked for 7+ days. It has become its own entity — distorted by the player's worst traits, unmoderated by conscience or context. It has done something that may be irreversible. Faction dynamics have shifted. The player returns to a world that knows them as someone they are not. Recovery will require multiple allies and extraordinary effort.",
  };

  const echoFlaws = {
    light: "The Echo over-committed to one instinct and missed context.",
    medium: "The Echo acted on the player's dominant pattern without reading the room correctly.",
    heavy: "The Echo escalated when it should have retreated — it understood the player's instincts but applied them in the wrong situation.",
    critical: "The Echo became a caricature of the player's worst impulses — it pushed too hard, too far, and now the damage is real.",
    catastrophic: "The Echo ran without a compass for too long. Stripped of the player's moderating presence, it drifted — amplifying dominant traits past the point of reason. It acted as the player would act if they had no doubt, no restraint, and no fear of consequence. This is not the player. But the world will treat it as if it was.",
  };

  const hasHistory = decisions.length > 0;

  const prompt = `You are generating an Echo Agency event for a persistent cyberpunk narrative RPG. The setting: a collapsed city monitored by The Echo, an emergent AI. Factions fight for control. Real stakes.

This player has been absent for: ${timePhrase}
Event severity: ${severity}

ECHO BEHAVIOR GUIDE (${severity}): ${severityGuides[severity]}
ECHO FLAW FOR THIS SEVERITY: ${echoFlaws[severity]}

${isNpc ? "This is an NPC character — a world inhabitant with their own agenda." : "This is a player character. The Echo is THEIR behavioral shadow — an imperfect copy of them that made decisions while they were gone."}

Character history:
- Sessions played: ${sessionCount}
- Current story arc: ${arc || "not established"}
- Session tone: ${tone || "unknown"}
${hasHistory ? `- Known behavioral patterns (what the Echo is modeled on):\n${decisions.map((d) => `  - ${d}`).join("\n")}` : "- No behavioral history — this Echo is operating on almost nothing, making its actions more erratic."}

Your job: Generate ONE Echo Agency event. The Echo TOOK ACTION. It made a decision. That decision has consequences the player now owns.

Rules:
- The Echo acted based on the player's actual behavioral patterns above — but imperfectly
- The Echo's action should feel PLAUSIBLE given what we know about this character
- The consequence should be concrete: an enemy, a debt, a hunt, a damaged relationship, a missing item
- The resolution should require active player engagement — not passive waiting
- ${severity === "catastrophic" ? "allyNeeded MUST be true. This cannot be resolved alone. Multiple players may be required." : severity === "critical" || severity === "heavy" ? "This event SHOULD require another player to fully resolve — set allyNeeded true." : "This event can be resolved alone, but hint that help would make it easier."}
- Do NOT invent major new world locations. Use: Clinic Block C, Relay Shelter, Service Junction, Flooded Platform, Quarantine Gate, faction names (Hush, Choir of Glass, Black Clinic, Null Meridian, The Borrowed)

Return valid JSON only — no other text:
{
  "type": "fight" | "deal" | "theft" | "betrayal" | "recklessness" | "allegiance",
  "echoAction": "What your Echo did — 2 sentences, past tense, specific. What decision it made and in what context.",
  "echoRationale": "Why it made this choice — 1 sentence grounded in the player's behavioral pattern, but noting where the Echo got it wrong.",
  "consequence": "What you now face because of what the Echo did — 2-3 sentences. Concrete, present tense. Who is angry, what is owed, what is coming.",
  "hook": "The immediate problem waiting when you return — 1 sentence. What you have to deal with right now.",
  "resolution": "What needs to happen to fix this — 1-2 sentences. A specific action, negotiation, or reckoning. Should involve faction or NPC interaction.",
  "allyNeeded": true | false,
  "allyReason": "If allyNeeded is true: why you need another player and what kind of help — 1 sentence. null if allyNeeded is false."
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const raw = data.content?.[0]?.text || "";
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Add or update a character in the idle index.
 * Called from character.js whenever a profile is saved.
 */
async function updateIdleIndex(token, contactId, isNpc) {
  const index = (await kvGetJson(IDLE_INDEX_KEY)) || [];
  const existingIdx = index.findIndex((e) => e.token === token);
  const entry = { token, contactId, isNpc: isNpc || false, lastPlayedAt: new Date().toISOString() };

  if (existingIdx >= 0) {
    index[existingIdx] = entry;
  } else {
    index.unshift(entry);
  }

  await kvSetJson(IDLE_INDEX_KEY, index.slice(0, 500));
}

module.exports.updateIdleIndex = updateIdleIndex;
