"use client";

// Ultra-lightweight Web Audio API acoustic micro-feedback
// Zero external assets, purely synthesized micro-envelopes.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playTick(type: "soft" | "click" | "settle" | "chime" = "soft") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case "soft": {
        // High-frequency subtle acoustic tap (12ms)
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.015);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
        osc.start(now);
        osc.stop(now + 0.015);
        break;
      }
      case "click": {
        // Mechanical switch click (18ms)
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.02);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
        osc.start(now);
        osc.stop(now + 0.02);
        break;
      }
      case "settle": {
        // Lower resonant confirmation blip (30ms)
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.04);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
        break;
      }
      case "chime": {
        // Harmonic distinction chime (80ms)
        osc.type = "sine";
        osc.frequency.setValueAtTime(1046.5, now); // C6
        osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.08); // E6
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
    }
  } catch {
    // Gracefully ignore audio autoplay or permission issues
  }
}
