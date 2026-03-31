module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ ok: false, error: "voice_not_configured" });
    return;
  }

  const { text } = req.body || {};
  if (!text || typeof text !== "string") {
    res.status(400).json({ ok: false, error: "missing_text" });
    return;
  }

  // Cap text length to control cost
  const trimmed = text.slice(0, 1000);

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "onyx",
        input: trimmed,
        speed: 0.9,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("OpenAI TTS error:", response.status, errorBody);
      res.status(502).json({ ok: false, error: "tts_upstream_error" });
      return;
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.byteLength);
    res.status(200).end(Buffer.from(audioBuffer));
  } catch (error) {
    console.error("Voice API error:", error);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
};
