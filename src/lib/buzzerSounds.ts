// Buzzer-Sound-Presets über die Web Audio API.
// Jedes Preset hat einen Start- und einen Stop-Sound.

export type SoundPreset = "klassisch" | "arcade" | "glocke" | "horn" | "eigene";

export const PRESET_LABEL: Record<SoundPreset, string> = {
  klassisch: "🎵 Klassisch (Dreiklang)",
  arcade: "👾 Arcade (Retro-Blips)",
  glocke: "🔔 Glocke",
  horn: "📯 Horn",
  eigene: "📁 Eigene Sounds",
};

type Note = { freq: number; delay: number; dauer: number; typ: OscillatorType; lautstaerke?: number };

function spieleNoten(noten: Note[]) {
  try {
    const ctx = new AudioContext();
    noten.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = n.typ;
      osc.frequency.value = n.freq;
      const t = ctx.currentTime + n.delay;
      const vol = n.lautstaerke ?? 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.dauer);
      osc.start(t);
      osc.stop(t + n.dauer);
    });
  } catch (_) { /* Browser ohne AudioContext */ }
}

const PRESETS: Record<Exclude<SoundPreset, "eigene">, { start: Note[]; stop: Note[] }> = {
  klassisch: {
    start: [
      { freq: 440, delay: 0,    dauer: 0.3, typ: "sine" },
      { freq: 554, delay: 0.12, dauer: 0.3, typ: "sine" },
      { freq: 659, delay: 0.24, dauer: 0.3, typ: "sine" },
    ],
    stop: [
      { freq: 659, delay: 0,   dauer: 0.25, typ: "sine" },
      { freq: 554, delay: 0.1, dauer: 0.25, typ: "sine" },
      { freq: 440, delay: 0.2, dauer: 0.25, typ: "sine" },
    ],
  },
  arcade: {
    start: [
      { freq: 523, delay: 0,    dauer: 0.08, typ: "square", lautstaerke: 0.1 },
      { freq: 659, delay: 0.08, dauer: 0.08, typ: "square", lautstaerke: 0.1 },
      { freq: 784, delay: 0.16, dauer: 0.08, typ: "square", lautstaerke: 0.1 },
      { freq: 1047, delay: 0.24, dauer: 0.15, typ: "square", lautstaerke: 0.1 },
    ],
    stop: [
      { freq: 1047, delay: 0,   dauer: 0.08, typ: "square", lautstaerke: 0.1 },
      { freq: 784, delay: 0.08, dauer: 0.08, typ: "square", lautstaerke: 0.1 },
      { freq: 523, delay: 0.16, dauer: 0.2, typ: "square", lautstaerke: 0.1 },
    ],
  },
  glocke: {
    start: [
      { freq: 880, delay: 0, dauer: 0.8, typ: "sine", lautstaerke: 0.2 },
      { freq: 1760, delay: 0, dauer: 0.5, typ: "sine", lautstaerke: 0.06 },
    ],
    stop: [
      { freq: 660, delay: 0, dauer: 0.9, typ: "sine", lautstaerke: 0.2 },
      { freq: 1320, delay: 0, dauer: 0.5, typ: "sine", lautstaerke: 0.06 },
    ],
  },
  horn: {
    start: [
      { freq: 220, delay: 0, dauer: 0.4, typ: "sawtooth", lautstaerke: 0.12 },
      { freq: 330, delay: 0.15, dauer: 0.4, typ: "sawtooth", lautstaerke: 0.12 },
    ],
    stop: [
      { freq: 330, delay: 0, dauer: 0.35, typ: "sawtooth", lautstaerke: 0.12 },
      { freq: 220, delay: 0.15, dauer: 0.5, typ: "sawtooth", lautstaerke: 0.12 },
    ],
  },
};

function spieleUrl(url: string) {
  try {
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (_) { /* ignore */ }
}

export function spieleBuzzerSound(
  richtung: "start" | "stop",
  preset: SoundPreset,
  eigeneUrls?: { start?: string | null; stop?: string | null }
) {
  if (preset === "eigene") {
    const url = richtung === "start" ? eigeneUrls?.start : eigeneUrls?.stop;
    if (url) { spieleUrl(url); return; }
    // Fallback auf klassisch wenn keine eigene Datei da
    spieleNoten(PRESETS.klassisch[richtung]);
    return;
  }
  spieleNoten(PRESETS[preset][richtung]);
}
