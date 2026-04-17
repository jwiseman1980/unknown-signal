// multiplayer.js — Ably-backed co-op sessions for Unknown Signal
// Exposes window.multiplayer = { connected, connect, disconnect, broadcastPlayer, broadcastEcho }
// app.js calls broadcastPlayer/broadcastEcho after rendering locally.
// Incoming messages from other players are rendered via window._mpAddMessage (set by app.js).

(function () {
  "use strict";

  const mp = {
    client: null,
    channel: null,
    clientId: null,
    playerLabel: null,
    _connected: false,
  };

  async function connect(groupCode, playerLabel) {
    if (mp._connected) return;
    if (typeof Ably === "undefined") throw new Error("Ably SDK not loaded");

    mp.clientId = "p-" + Math.random().toString(36).slice(2, 10);
    mp.playerLabel = playerLabel || "Player";

    mp.client = new Ably.Realtime({
      authCallback(tokenParams, callback) {
        fetch("/api/ably-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: mp.clientId }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (!data.ok) throw new Error(data.error || "token_error");
            callback(null, data.tokenRequest);
          })
          .catch((err) => callback(err, null));
      },
      clientId: mp.clientId,
    });

    await new Promise((resolve, reject) => {
      mp.client.connection.once("connected", resolve);
      mp.client.connection.once("failed", (err) =>
        reject(err || new Error("ably_connection_failed"))
      );
    });

    mp.channel = mp.client.channels.get("signal:group:" + groupCode);

    mp.channel.subscribe("player", (msg) => {
      if (msg.clientId === mp.clientId) return;
      const { text = "", label = "Player" } = msg.data || {};
      _render("party", "[" + label + "]: " + text);
    });

    mp.channel.subscribe("echo", (msg) => {
      if (msg.clientId === mp.clientId) return;
      const text = (msg.data || {}).text || "";
      if (text) _render("echo", text);
    });

    mp._connected = true;
  }

  function broadcastPlayer(text) {
    if (!mp._connected || !mp.channel) return;
    mp.channel.publish("player", { text, label: mp.playerLabel });
  }

  function broadcastEcho(text) {
    if (!mp._connected || !mp.channel) return;
    mp.channel.publish("echo", { text });
  }

  function disconnect() {
    if (mp.client) {
      mp.client.close();
      mp.client = null;
      mp.channel = null;
      mp._connected = false;
    }
  }

  function _render(role, text) {
    if (typeof window._mpAddMessage === "function") {
      window._mpAddMessage(role, text);
    }
  }

  window.multiplayer = {
    get connected() { return mp._connected; },
    connect,
    disconnect,
    broadcastPlayer,
    broadcastEcho,
  };
})();
