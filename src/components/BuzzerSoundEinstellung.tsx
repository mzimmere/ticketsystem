import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { spieleBuzzerSound, PRESET_LABEL, type SoundPreset } from "../lib/buzzerSounds";

const PRESETS: SoundPreset[] = ["klassisch", "arcade", "glocke", "horn", "eigene"];

export default function BuzzerSoundEinstellung({ profilId }: { profilId: string }) {
  const [preset, setPreset] = useState<SoundPreset>("klassisch");
  const [startUrl, setStartUrl] = useState<string | null>(null);
  const [stopUrl, setStopUrl] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("profiles")
      .select("buzzer_sound, buzzer_start_url, buzzer_stop_url")
      .eq("id", profilId).single()
      .then(({ data }) => {
        if (data) {
          setPreset((data.buzzer_sound as SoundPreset) ?? "klassisch");
          setStartUrl(data.buzzer_start_url);
          setStopUrl(data.buzzer_stop_url);
        }
      });
  }, [profilId]);

  async function presetWaehlen(p: SoundPreset) {
    setPreset(p);
    await supabase.from("profiles").update({ buzzer_sound: p }).eq("id", profilId);
    // Direkt vorspielen
    spieleBuzzerSound("start", p, { start: startUrl, stop: stopUrl });
  }

  async function soundHochladen(richtung: "start" | "stop", datei: File) {
    if (datei.size > 1024 * 1024) {
      setHinweis("Datei zu groß – maximal 1 MB.");
      return;
    }
    if (!datei.type.startsWith("audio/")) {
      setHinweis("Bitte eine Audio-Datei wählen (MP3, WAV, OGG).");
      return;
    }
    setLaedt(true);
    setHinweis(null);

    const endung = datei.name.split(".").pop() ?? "mp3";
    const pfad = `${profilId}/${richtung}-${Date.now()}.${endung}`;

    const { error } = await supabase.storage.from("sounds").upload(pfad, datei, { upsert: true });
    if (error) {
      setHinweis("Upload fehlgeschlagen: " + error.message);
      setLaedt(false);
      return;
    }

    const { data: oeffentlich } = supabase.storage.from("sounds").getPublicUrl(pfad);
    const url = oeffentlich.publicUrl;

    const feld = richtung === "start" ? "buzzer_start_url" : "buzzer_stop_url";
    await supabase.from("profiles").update({ [feld]: url, buzzer_sound: "eigene" }).eq("id", profilId);

    if (richtung === "start") setStartUrl(url);
    else setStopUrl(url);
    setPreset("eigene");
    setLaedt(false);
    setHinweis(`${richtung === "start" ? "Start" : "Stop"}-Sound hochgeladen.`);

    // Vorspielen
    spieleBuzzerSound(richtung, "eigene", {
      start: richtung === "start" ? url : startUrl,
      stop: richtung === "stop" ? url : stopUrl,
    });
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">🔊 Buzzer-Sound</h3>
      <p className="text-xs text-[var(--text-faint)]">
        Der Sound beim Starten/Stoppen der Zeiterfassung. Klick auf ein Preset spielt es direkt vor.
      </p>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => presetWaehlen(p)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
              preset === p
                ? "border-[var(--akzent)] bg-akzent/10 font-medium text-akzent"
                : "border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
            }`}
          >
            {PRESET_LABEL[p]}
            {preset === p && <span>✓</span>}
          </button>
        ))}
      </div>

      {preset === "eigene" && (
        <div className="space-y-2 rounded-lg bg-[var(--bg-muted)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--text-soft)]">Start-Sound</p>
              <p className="truncate text-[0.65rem] text-[var(--text-faint)]">
                {startUrl ? "✓ Hochgeladen" : "Noch keiner"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {startUrl && (
                <button
                  onClick={() => spieleBuzzerSound("start", "eigene", { start: startUrl, stop: stopUrl })}
                  className="rounded border border-[var(--border-input)] px-2 py-1 text-xs text-[var(--text-soft)]"
                >
                  ▶
                </button>
              )}
              <label className="cursor-pointer rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
                {laedt ? "…" : "Hochladen"}
                <input type="file" accept="audio/*" className="hidden" disabled={laedt}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) soundHochladen("start", f); e.target.value = ""; }} />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--text-soft)]">Stop-Sound</p>
              <p className="truncate text-[0.65rem] text-[var(--text-faint)]">
                {stopUrl ? "✓ Hochgeladen" : "Noch keiner"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {stopUrl && (
                <button
                  onClick={() => spieleBuzzerSound("stop", "eigene", { start: startUrl, stop: stopUrl })}
                  className="rounded border border-[var(--border-input)] px-2 py-1 text-xs text-[var(--text-soft)]"
                >
                  ▶
                </button>
              )}
              <label className="cursor-pointer rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
                {laedt ? "…" : "Hochladen"}
                <input type="file" accept="audio/*" className="hidden" disabled={laedt}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) soundHochladen("stop", f); e.target.value = ""; }} />
              </label>
            </div>
          </div>

          <p className="text-[0.65rem] text-[var(--text-faint)]">
            MP3, WAV oder OGG · max. 1 MB · am besten kurz (unter 2 Sekunden)
          </p>
        </div>
      )}

      {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}
    </div>
  );
}
