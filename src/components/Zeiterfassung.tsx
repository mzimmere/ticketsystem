import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

type AktiverTimer = {
  id: string;
  start_zeit: string;
};

interface ZeiterfassungProps {
  ticketId: string;
  kundeId: string;
  technikerId: string;
  organisationId: string;
}

export default function Zeiterfassung({
  ticketId,
  kundeId,
  technikerId,
  organisationId,
}: ZeiterfassungProps) {
  const [aktiverTimer, setAktiverTimer] = useState<AktiverTimer | null>(null);
  const [vergangeneSekunden, setVergangeneSekunden] = useState(0);
  const [beschreibung, setBeschreibung] = useState("");
  const [manuelleMinuten, setManuelleMinuten] = useState("");
  const [laedt, setLaedt] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    async function ladeAktivenTimer() {
      const { data } = await supabase
        .from("zeiteintraege")
        .select("id, start_zeit")
        .eq("techniker_id", technikerId)
        .eq("erfassungsart", "timer")
        .is("end_zeit", null)
        .maybeSingle();
      if (data) setAktiverTimer(data);
    }
    ladeAktivenTimer();
  }, [technikerId]);

  useEffect(() => {
    if (!aktiverTimer) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      return;
    }
    const start = new Date(aktiverTimer.start_zeit).getTime();
    const tick = () => setVergangeneSekunden(Math.floor((Date.now() - start) / 1000));
    tick();
    intervalRef.current = window.setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [aktiverTimer]);

  async function timerStarten() {
    setLaedt(true);
    const { data, error } = await supabase
      .from("zeiteintraege")
      .insert({
        organisation_id: organisationId,
        ticket_id: ticketId,
        kunde_id: kundeId,
        techniker_id: technikerId,
        erfassungsart: "timer",
        start_zeit: new Date().toISOString(),
      })
      .select("id, start_zeit")
      .single();
    setLaedt(false);
    if (!error && data) setAktiverTimer(data);
  }

  async function timerStoppen() {
    if (!aktiverTimer) return;
    setLaedt(true);
    const minuten = Math.max(1, Math.round(vergangeneSekunden / 60));
    const { error } = await supabase
      .from("zeiteintraege")
      .update({
        end_zeit: new Date().toISOString(),
        minuten,
        beschreibung: beschreibung || null,
      })
      .eq("id", aktiverTimer.id);
    setLaedt(false);
    if (!error) {
      setAktiverTimer(null);
      setVergangeneSekunden(0);
      setBeschreibung("");
    }
  }

  async function manuellSpeichern() {
    const minuten = parseInt(manuelleMinuten, 10);
    if (!minuten || minuten <= 0) return;
    setLaedt(true);
    const { error } = await supabase.from("zeiteintraege").insert({
      organisation_id: organisationId,
      ticket_id: ticketId,
      kunde_id: kundeId,
      techniker_id: technikerId,
      erfassungsart: "manuell",
      minuten,
      beschreibung: beschreibung || null,
    });
    setLaedt(false);
    if (!error) {
      setManuelleMinuten("");
      setBeschreibung("");
    }
  }

  function formatZeit(sekunden: number) {
    const m = Math.floor(sekunden / 60).toString().padStart(2, "0");
    const s = (sekunden % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-soft)]">
          Zeiterfassung
        </span>
        {aktiverTimer && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-akzent animate-pulse" />
            läuft
          </span>
        )}
      </div>

      {aktiverTimer ? (
        <div className="space-y-3">
          <div className="font-mono text-3xl tabular-nums text-[var(--text-strong)]">
            {formatZeit(vergangeneSekunden)}
          </div>
          <input
            type="text"
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            placeholder="Was wurde gemacht? (optional)"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-strong)] px-3 py-2 text-sm"
          />
          <button
            onClick={timerStoppen}
            disabled={laedt}
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Timer stoppen &amp; speichern
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={timerStarten}
            disabled={laedt}
            className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Timer starten
          </button>

          <div className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
            <span className="h-px flex-1 bg-[var(--border)]" />
            oder manuell
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={manuelleMinuten}
              onChange={(e) => setManuelleMinuten(e.target.value)}
              placeholder="Min."
              className="w-20 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-strong)] px-2 py-2 text-sm"
            />
            <input
              type="text"
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              placeholder="Beschreibung"
              className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-strong)] px-3 py-2 text-sm"
            />
            <button
              onClick={manuellSpeichern}
              disabled={laedt}
              className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Speichern
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
