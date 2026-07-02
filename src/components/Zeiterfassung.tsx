import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { spieleBuzzerSound, type SoundPreset } from "../lib/buzzerSounds";

type AktiverTimer = { id: string; start_zeit: string };

interface ZeiterfassungProps {
  ticketId: string;
  kundeId: string;
  technikerId: string;
  organisationId: string;
  onZeitErfasst?: () => void;
}

// ─── Ziffernrolle (mechanische Anzeigetafel-Animation) ─────────────────────
function Ziffer({ wert, cls }: { wert: number; cls?: string }) {
  return (
    <span
      className={`inline-block tabular-nums transition-all duration-100 ${cls ?? ""}`}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {String(wert).padStart(2, "0")}
    </span>
  );
}

export default function Zeiterfassung({
  ticketId, kundeId, technikerId, organisationId, onZeitErfasst,
}: ZeiterfassungProps) {
  const [aktiverTimer, setAktiverTimer] = useState<AktiverTimer | null>(null);
  const [sek, setSek] = useState(0);
  const [beschreibung, setBeschreibung] = useState("");
  const [manuelleMin, setManuelleMin] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [pulsiert, setPulsiert] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [zeigeManuell, setZeigeManuell] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const soundRef = useRef<{ preset: SoundPreset; startUrl: string | null; stopUrl: string | null }>({
    preset: "klassisch", startUrl: null, stopUrl: null,
  });
  const buzzerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    supabase.from("zeiteintraege").select("id, start_zeit")
      .eq("techniker_id", technikerId).eq("erfassungsart", "timer")
      .is("end_zeit", null).maybeSingle()
      .then(({ data }) => { if (data) setAktiverTimer(data); });

    supabase.from("profiles")
      .select("buzzer_sound, buzzer_start_url, buzzer_stop_url")
      .eq("id", technikerId).single()
      .then(({ data }) => {
        if (data) {
          soundRef.current = {
            preset: (data.buzzer_sound as SoundPreset) ?? "klassisch",
            startUrl: data.buzzer_start_url,
            stopUrl: data.buzzer_stop_url,
          };
        }
      });
  }, [technikerId]);

  useEffect(() => {
    if (!aktiverTimer) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const start = new Date(aktiverTimer.start_zeit).getTime();
    const tick = () => setSek(Math.floor((Date.now() - start) / 1000));
    tick();
    intervalRef.current = window.setInterval(tick, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [aktiverTimer]);

  const addRipple = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = buzzerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const id = Date.now();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipples((r) => [...r, { id, x, y }]);
    setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 700);
  }, []);

  async function timerStarten(e: React.MouseEvent<HTMLButtonElement>) {
    addRipple(e);
    setPulsiert(true);
    spieleBuzzerSound("start", soundRef.current.preset, { start: soundRef.current.startUrl, stop: soundRef.current.stopUrl });
    setTimeout(() => setPulsiert(false), 600);
    setLaedt(true);
    const { data, error } = await supabase.from("zeiteintraege").insert({
      organisation_id: organisationId, ticket_id: ticketId, kunde_id: kundeId,
      techniker_id: technikerId, erfassungsart: "timer",
      start_zeit: new Date().toISOString(),
    }).select("id, start_zeit").single();
    setLaedt(false);
    if (!error && data) setAktiverTimer(data);
  }

  async function timerStoppen(e: React.MouseEvent<HTMLButtonElement>) {
    if (!aktiverTimer) return;
    addRipple(e);
    spieleBuzzerSound("stop", soundRef.current.preset, { start: soundRef.current.startUrl, stop: soundRef.current.stopUrl });
    setLaedt(true);
    const minuten = Math.max(1, Math.round(sek / 60));
    const { error } = await supabase.from("zeiteintraege").update({
      end_zeit: new Date().toISOString(), minuten,
      beschreibung: beschreibung || null,
    }).eq("id", aktiverTimer.id);
    setLaedt(false);
    if (!error) { setAktiverTimer(null); setSek(0); setBeschreibung(""); onZeitErfasst?.(); }
  }

  async function manuellSpeichern() {
    const min = parseInt(manuelleMin, 10);
    if (!min || min <= 0) return;
    setLaedt(true);
    const { error } = await supabase.from("zeiteintraege").insert({
      organisation_id: organisationId, ticket_id: ticketId, kunde_id: kundeId,
      techniker_id: technikerId, erfassungsart: "manuell",
      minuten: min, beschreibung: beschreibung || null,
    });
    setLaedt(false);
    if (!error) { setManuelleMin(""); setBeschreibung(""); setZeigeManuell(false); onZeitErfasst?.(); }
  }

  const std = Math.floor(sek / 3600);
  const min = Math.floor((sek % 3600) / 60);
  const sec = sek % 60;
  const läuft = !!aktiverTimer;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-soft)]">
          Zeiterfassung
        </span>
        {läuft && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-500">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            läuft seit {Math.floor(sek / 60)} Min.
          </span>
        )}
      </div>

      {/* Display */}
      <div className={`rounded-xl border-2 py-4 text-center transition-all duration-300 ${
        läuft
          ? "border-amber-400/60 bg-amber-50/50 dark:bg-amber-900/10"
          : "border-[var(--border)] bg-[var(--bg-muted)]"
      }`}>
        <div className="font-mono text-4xl font-bold tracking-widest text-[var(--text-strong)]">
          {std > 0 && <><Ziffer wert={std} />:</>}
          <Ziffer wert={min} cls={läuft && sec === 0 ? "opacity-70" : ""} />
          <span className={`text-2xl transition-opacity duration-500 ${sec % 2 === 0 && läuft ? "opacity-30" : "opacity-100"}`}>:</span>
          <Ziffer wert={sec} />
        </div>
        {läuft && (
          <div className="mt-1 text-[0.65rem] text-[var(--text-faint)]">
            gestartet {new Date(aktiverTimer!.start_zeit).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
          </div>
        )}
      </div>

      {/* Buzzer */}
      <div className="flex justify-center">
        <button
          ref={buzzerRef}
          onClick={läuft ? timerStoppen : timerStarten}
          disabled={laedt}
          className={`
            relative h-24 w-24 overflow-hidden rounded-full border-4 text-white font-bold text-sm
            shadow-lg transition-all duration-150 select-none
            active:scale-95 disabled:opacity-50
            ${läuft
              ? "border-red-400 bg-gradient-to-b from-red-400 to-red-600 shadow-red-500/40 hover:from-red-300 hover:to-red-500"
              : "border-green-400 bg-gradient-to-b from-green-400 to-green-600 shadow-green-500/40 hover:from-green-300 hover:to-green-500"
            }
            ${pulsiert ? "scale-110" : "scale-100"}
          `}
          style={{
            boxShadow: läuft
              ? "0 6px 0 #b91c1c, 0 8px 16px rgba(239,68,68,0.4)"
              : "0 6px 0 #15803d, 0 8px 16px rgba(34,197,94,0.4)",
          }}
        >
          {/* Ripple-Effekte */}
          {ripples.map((r) => (
            <span
              key={r.id}
              className="pointer-events-none absolute rounded-full bg-white/30"
              style={{
                left: r.x - 50, top: r.y - 50,
                width: 100, height: 100,
                animation: "ripple 0.7s ease-out forwards",
              }}
            />
          ))}

          {/* Glanz-Effekt */}
          <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/30 to-transparent" />

          {/* Icon */}
          <span className="relative z-10 flex flex-col items-center gap-0.5">
            <span className="text-2xl">{läuft ? "⏹" : "▶"}</span>
            <span className="text-[0.6rem] font-medium tracking-widest uppercase">
              {läuft ? "Stop" : "Start"}
            </span>
          </span>
        </button>
      </div>

      {/* Beschreibung (nur wenn Timer läuft) */}
      {läuft && (
        <input
          type="text"
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          placeholder="Was wird gerade gemacht? (optional)"
          className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
        />
      )}

      {/* Manuelle Eingabe */}
      {!läuft && (
        <div>
          <button
            onClick={() => setZeigeManuell(!zeigeManuell)}
            className="w-full text-center text-xs text-[var(--text-faint)] hover:text-[var(--text-soft)]"
          >
            {zeigeManuell ? "▲ Manuelle Eingabe ausblenden" : "▼ Zeit manuell eintragen"}
          </button>
          {zeigeManuell && (
            <div className="mt-2 flex gap-2">
              <input
                type="number" min={1} value={manuelleMin}
                onChange={(e) => setManuelleMin(e.target.value)}
                placeholder="Min."
                className="w-20 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-2 text-sm"
              />
              <input
                type="text" value={beschreibung}
                onChange={(e) => setBeschreibung(e.target.value)}
                placeholder="Beschreibung"
                className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
              <button
                onClick={manuellSpeichern} disabled={laedt}
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                +
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
