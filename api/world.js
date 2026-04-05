const { buildSystemPrompt, buildMessages } = require("./_lib/engine");
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

  const systemPrompt = buildSystemPrompt(gameState, theme);
  const messages = buildMessages(input, gameState);

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
