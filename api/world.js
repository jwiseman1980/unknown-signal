const { buildSystemPrompt, buildMessages } = require("./_lib/engine");
const { isKvConfigured, kvGetJson } = require("./_lib/kv");
const theme = require("../themes/unknown-signal/theme");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({ ok: false, error: "ai_not_configured" });
    return;
  }

  const { input, gameState } = req.body || {};
  if (!input || !gameState) {
    res.status(400).json({ ok: false, error: "missing_input_or_state" });
    return;
  }

  // Enrich gameState server-side before building the prompt
  const enriched = { ...gameState };

  if (isKvConfigured()) {
    // Fetch random shadow profiles for this scene — these become the NPC echoes
    const { getRandomShadows } = require("./shadow");
    const scene = gameState.currentScene || null;
    const shadows = await getRandomShadows(2, scene).catch(() => []);
    if (shadows.length) enriched.echoShadows = shadows;

    // Fetch NPC profiles for the current scene if theme provides them
    if (typeof theme.getNpcsForScene === "function" && gameState.currentScene) {
      const npcTokens = theme.getNpcsForScene(gameState.currentScene);
      if (npcTokens.length) {
        const npcProfiles = await Promise.all(
          npcTokens.map((token) => kvGetJson(`signal:character:${token}`).catch(() => null))
        );
        enriched.sceneNpcs = npcProfiles.filter(Boolean);
      }
    }

    // Fetch shared world state for canon events and faction standings
    const { getOrInitWorldState } = require("./world-state");
    const worldState = await getOrInitWorldState().catch(() => null);
    if (worldState) enriched.sharedWorldState = worldState;
  }

  const systemPrompt = buildSystemPrompt(enriched, theme);
  const messages = buildMessages(input, enriched);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Claude API error:", response.status, errorBody);
      res.status(502).json({ ok: false, error: "ai_upstream_error" });
      return;
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text || "";

    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (parseError) {
      parsed = {
        replies: [raw.slice(0, 500)],
        stateChanges: {},
      };
    }

    if (!parsed.replies || !Array.isArray(parsed.replies)) {
      parsed.replies = ["The city shifts but offers no clear answer."];
    }

    res.status(200).json({ ok: true, result: parsed });
  } catch (error) {
    console.error("World API error:", error);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
};
