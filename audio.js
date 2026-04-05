/**
 * audio.js — Ambient soundscape engine for Unknown Signal
 *
 * Pure Web Audio API synthesis — no external files.
 *
 * Four layers:
 *   1. Base Drone     — sub-bass oscillators, always on, location-tuned
 *   2. Tension Layer  — filtered noise + mid-range drone, scales with danger
 *   3. Digital Glitch — artifact bursts when The Echo communicates
 *   4. Combat Pulse   — rhythmic low-end thump during combat
 *
 * Mobile: drone only, opt-in via button (performance/battery).
 * All state changes ramp smoothly; no pops or clicks.
 *
 * Public API (all no-ops if audio not started):
 *   audioEngine.start()              — call on first user gesture
 *   audioEngine.update(gameState)    — call on scene/combat state change
 *   audioEngine.onEchoSpeaking()     — call when Echo starts printing
 *   audioEngine.setVolume(0–1)       — set master volume
 *   audioEngine.toggleMute()         — returns new muted boolean
 *   audioEngine.isMobile             — true on touch-primary devices
 *   audioEngine.started              — true once AudioContext is running
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.started = false;
    this.muted = false;
    this.volume = 0.35;
    this.isMobile =
      window.matchMedia("(pointer: coarse)").matches ||
      navigator.maxTouchPoints > 1;

    this._drone = null;
    this._tension = null;
    this._combat = null;
    this._combatTimer = null;
    this._inCombat = false;
    this._lastScene = null;
  }

  // ────────────────────────────────────────────────────────────────
  // Initialization — must be triggered from a user gesture
  // ────────────────────────────────────────────────────────────────

  start() {
    if (this.started) return;
    if (!window.AudioContext && !window.webkitAudioContext) return;

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {
      return;
    }

    // Resume if suspended (some browsers start suspended)
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.volume;
    this.masterGain.connect(this.ctx.destination);

    this._buildDroneLayer();

    if (!this.isMobile) {
      this._buildTensionLayer();
      this._buildCombatLayer();
    }

    this.started = true;
  }

  // ────────────────────────────────────────────────────────────────
  // Layer — Base Drone
  // Two detuned sine waves at sub-bass + an octave-up harmonic.
  // A slow LFO breathes the pitch slightly so it never feels static.
  // ────────────────────────────────────────────────────────────────

  _buildDroneLayer() {
    const ctx = this.ctx;

    const osc1 = ctx.createOscillator(); // primary sub-bass
    const osc2 = ctx.createOscillator(); // detuned for beating artifact
    const oscH = ctx.createOscillator(); // soft octave harmonic

    osc1.type = "sine";
    osc1.frequency.value = 40;
    osc2.type = "sine";
    osc2.frequency.value = 42.3; // ~2.3 Hz beating
    oscH.type = "sine";
    oscH.frequency.value = 80;

    // Slow LFO — 25-second period, ±1.5 Hz drift
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.04;
    lfoGain.gain.value = 1.5;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);
    lfoGain.connect(oscH.frequency);

    const g1 = ctx.createGain(); g1.gain.value = 0.38;
    const g2 = ctx.createGain(); g2.gain.value = 0.38;
    const gH = ctx.createGain(); gH.gain.value = 0.09;
    const out = ctx.createGain(); out.gain.value = 1.0;

    osc1.connect(g1); g1.connect(out);
    osc2.connect(g2); g2.connect(out);
    oscH.connect(gH); gH.connect(out);
    out.connect(this.masterGain);

    lfo.start(); osc1.start(); osc2.start(); oscH.start();

    this._drone = { osc1, osc2, oscH, lfo, out };
  }

  // ────────────────────────────────────────────────────────────────
  // Layer — Tension
  // Bandpass-filtered white noise + slow sawtooth oscillator.
  // Both route into a shared gain node that scales 0→1 with danger.
  // ────────────────────────────────────────────────────────────────

  _buildTensionLayer() {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;

    // 3-second looping white noise buffer
    const buf = ctx.createBuffer(1, sr * 3, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 800;
    bandpass.Q.value = 0.8;

    // Mid-range tension drone with soft clipping
    const tensionOsc = ctx.createOscillator();
    tensionOsc.type = "sawtooth";
    tensionOsc.frequency.value = 110;

    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 255 - 1;
      curve[i] = (Math.PI * x) / (Math.PI + 18 * Math.abs(x));
    }
    shaper.curve = curve;

    // Slow tension LFO — modulates frequency for eerie drift
    const tLfo = ctx.createOscillator();
    const tLfoGain = ctx.createGain();
    tLfo.frequency.value = 0.08;
    tLfoGain.gain.value = 25;
    tLfo.connect(tLfoGain);
    tLfoGain.connect(tensionOsc.frequency);

    const out = ctx.createGain();
    out.gain.value = 0; // starts silent

    noise.connect(bandpass);
    bandpass.connect(out);
    tensionOsc.connect(shaper);
    shaper.connect(out);
    out.connect(this.masterGain);

    noise.start(); tensionOsc.start(); tLfo.start();

    this._tension = { noise, bandpass, tensionOsc, tLfo, out };
  }

  // ────────────────────────────────────────────────────────────────
  // Layer — Combat Pulse
  // A square wave through a heavy lowpass, fired in rhythmic bursts
  // using scheduled gain automation (heartbeat pattern, ~88 BPM).
  // ────────────────────────────────────────────────────────────────

  _buildCombatLayer() {
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 55; // A1

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 100;
    filter.Q.value = 2.5;

    const out = ctx.createGain();
    out.gain.value = 0;

    osc.connect(filter);
    filter.connect(out);
    out.connect(this.masterGain);

    osc.start();

    this._combat = { osc, filter, out };
  }

  // ────────────────────────────────────────────────────────────────
  // Combat pulse timing
  // ────────────────────────────────────────────────────────────────

  _startCombatPulse() {
    if (!this._combat || this._combatTimer) return;

    const ctx = this.ctx;
    const gain = this._combat.out.gain;
    const intervalMs = (60 / 88) * 1000; // 88 BPM

    const tick = () => {
      if (!this._inCombat) return;
      const now = ctx.currentTime;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(0.32, now);
      gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    };

    tick();
    this._combatTimer = setInterval(tick, intervalMs);
  }

  _stopCombatPulse() {
    if (this._combatTimer) {
      clearInterval(this._combatTimer);
      this._combatTimer = null;
    }
    if (this._combat) {
      const now = this.ctx.currentTime;
      this._combat.out.gain.cancelScheduledValues(now);
      this._combat.out.gain.linearRampToValueAtTime(0, now + 2.0);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Digital glitch bursts — fired when The Echo outputs text
  // Short-lived oscillators + noise fragments scheduled in the future
  // ────────────────────────────────────────────────────────────────

  _fireDigitalBurst(count) {
    const ctx = this.ctx;
    const master = this.masterGain;
    const n = count || 5;

    for (let i = 0; i < n; i++) {
      const when = ctx.currentTime + 0.04 + Math.random() * 1.4;
      const dur = 0.006 + Math.random() * 0.055;

      const osc = ctx.createOscillator();
      const g = ctx.createGain();

      osc.type =
        Math.random() > 0.55
          ? "square"
          : Math.random() > 0.5
            ? "sawtooth"
            : "sine";
      osc.frequency.value = 280 + Math.random() * 5200;

      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.055, when + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

      osc.connect(g);
      g.connect(master);
      osc.start(when);
      osc.stop(when + dur + 0.01);
    }

    // Occasional short noise static burst (data decay feeling)
    if (Math.random() > 0.38) {
      const sr = ctx.sampleRate;
      const when = ctx.currentTime + Math.random() * 0.7;
      const len = Math.floor(sr * (0.04 + Math.random() * 0.06));

      const nbuf = ctx.createBuffer(1, len, sr);
      const nd = nbuf.getChannelData(0);
      for (let j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;

      const nsrc = ctx.createBufferSource();
      nsrc.buffer = nbuf;

      const filt = ctx.createBiquadFilter();
      filt.type = "bandpass";
      filt.frequency.value = 1800 + Math.random() * 3500;
      filt.Q.value = 1.8;

      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0, when);
      ng.gain.linearRampToValueAtTime(0.07, when + 0.004);
      ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);

      nsrc.connect(filt);
      filt.connect(ng);
      ng.connect(master);
      nsrc.start(when);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────

  /** Fire when The Echo starts printing a reply */
  onEchoSpeaking() {
    if (!this.started || this.isMobile) return;
    this._fireDigitalBurst(4 + Math.floor(Math.random() * 5));
  }

  /**
   * Call at every meaningful state change:
   * scene transitions, combat start/end, HP drops.
   */
  update(gameState) {
    if (!this.started) return;

    const { currentScene, combat } = gameState;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const slow = now + 3.0;

    // ── Base drone: frequency shifts by location ─────────────────
    const sceneFreq = {
      null: 40,
      undertow: 37,   // low decay, medical dread
      relay: 44,      // slightly brighter — "safe" but fragile
      junction: 49,   // tension node
      platform: 33,   // very low, watery resonance
      quarantine: 53, // highest — sealed, machine dread
    };

    const baseFreq = sceneFreq[currentScene] ?? 40;

    if (this._drone) {
      this._drone.osc1.frequency.linearRampToValueAtTime(baseFreq, slow);
      this._drone.osc2.frequency.linearRampToValueAtTime(baseFreq + 2.3, slow);
      this._drone.oscH.frequency.linearRampToValueAtTime(baseFreq * 2, slow);
    }

    // ── Tension layer: builds with danger ────────────────────────
    let tension = 0;
    if (currentScene === "undertow") tension = 0.12;
    else if (currentScene === "relay") tension = 0.08;
    else if (currentScene === "junction") tension = 0.38;
    else if (currentScene === "platform") tension = 0.32;
    else if (currentScene === "quarantine") tension = 0.62;

    if (combat?.inCombat) tension = Math.min(1, tension + 0.42);
    if (combat?.maxHp > 0 && combat.hp < combat.maxHp * 0.3) {
      tension = Math.min(1, tension + 0.18);
    }

    if (this._tension) {
      this._tension.out.gain.linearRampToValueAtTime(tension * 0.28, slow);
      // Higher tension → brighter, more abrasive hiss
      this._tension.bandpass.frequency.linearRampToValueAtTime(
        380 + tension * 1300,
        slow
      );
    }

    // ── Combat pulse: start or stop ──────────────────────────────
    const nowInCombat = combat?.inCombat ?? false;
    if (nowInCombat && !this._inCombat) this._startCombatPulse();
    else if (!nowInCombat && this._inCombat) this._stopCombatPulse();
    this._inCombat = nowInCombat;

    this._lastScene = currentScene;
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.setTargetAtTime(
        this.volume,
        this.ctx.currentTime,
        0.05
      );
    }
  }

  /** Returns the new muted state */
  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.05
      );
    }
    return this.muted;
  }
}

window.audioEngine = new AudioEngine();
