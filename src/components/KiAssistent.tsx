import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Stimmung = "positiv" | "neutral" | "frustriert" | "dringend";

interface StimmungsAnalyse {
  stimmung: Stimmung;
  begruendung: string;
  empfehlung: string;
}

const STIMMUNG_STYLE: Record<Stimmung, { emoji: string; farbe: string; bg: string }> = {
  positiv:    { emoji: "😊", farbe: "text-green-700",  bg: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700" },
  neutral:    { emoji: "😐", farbe: "text-slate-600",  bg: "bg-[var(--bg-muted)] border-[var(--border)]" },
  frustriert: { emoji: "😤", farbe: "text-orange-700", bg: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700" },
  dringend:   { emoji: "🚨", farbe: "text-red-700",    bg: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700" },
};

interface KiAssistentProps {
  ticketId: string;
  onAntwortVorschlag: (text: string) => void;
  onTagsVorgeschlagen: (tags: string[]) => void;
}

async function kiAufruf(aktion: string, ticketId: string) {
  const { data: session } = await supabase.auth.getSession();
  const res = await fetch(
    `${(supabase as unknown as { supabaseUrl: string }).supabaseUrl}/functions/v1/ki-assistent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session?.access_token}`,
      },
      body: JSON.stringify({ aktion, ticketId }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.antwort as string;
}

export default function KiAssistent({ ticketId, onAntwortVorschlag, onTagsVorgeschlagen }: KiAssistentProps) {
  const [zusammenfassung, setZusammenfassung] = useState<string | null>(null);
  const [stimmung, setStimmung] = useState<StimmungsAnalyse | null>(null);
  const [laedt, setLaedt] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState(false);

  async function aktion(typ: string) {
    setLaedt(typ);
    setFehler(null);
    try {
      const antwort = await kiAufruf(typ, ticketId);

      if (typ === "zusammenfassung") {
        setZusammenfassung(antwort);
      } else if (typ === "antwortvorschlag") {
        onAntwortVorschlag(antwort);
      } else if (typ === "stimmung") {
        const parsed = JSON.parse(antwort);
        setStimmung(parsed);
      } else if (typ === "tags") {
        const parsed = JSON.parse(antwort);
        if (Array.isArray(parsed)) onTagsVorgeschlagen(parsed);
      }
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "KI-Aufruf fehlgeschlagen.");
    }
    setLaedt(null);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
      <button
        onClick={() => setOffen(!offen)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <span className="text-xs font-medium text-[var(--text-soft)]">KI-Assistent</span>
          {stimmung && (
            <span className="text-sm">{STIMMUNG_STYLE[stimmung.stimmung].emoji}</span>
          )}
        </div>
        <span className="text-xs text-[var(--text-faint)]">{offen ? "▲" : "▼"}</span>
      </button>

      {offen && (
        <div className="border-t border-[var(--border)] p-4 space-y-3">
          {fehler && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {fehler}
            </p>
          )}

          {/* Stimmungsanalyse */}
          {stimmung && (
            <div className={`rounded-lg border p-3 ${STIMMUNG_STYLE[stimmung.stimmung].bg}`}>
              <p className={`text-xs font-semibold ${STIMMUNG_STYLE[stimmung.stimmung].farbe}`}>
                {STIMMUNG_STYLE[stimmung.stimmung].emoji} Stimmung: {stimmung.stimmung}
              </p>
              <p className="mt-1 text-xs text-[var(--text-soft)]">{stimmung.begruendung}</p>
              <p className="mt-1 text-xs font-medium text-[var(--text-strong)]">→ {stimmung.empfehlung}</p>
            </div>
          )}

          {/* Zusammenfassung */}
          {zusammenfassung && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:bg-blue-900/20 dark:border-blue-700">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">📋 Zusammenfassung</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-soft)]">{zusammenfassung}</p>
            </div>
          )}

          {/* Aktions-Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "stimmung",       label: "Stimmung analysieren", icon: "🎭" },
              { id: "zusammenfassung",label: "Zusammenfassen",        icon: "📋" },
              { id: "antwortvorschlag",label: "Antwort vorschlagen", icon: "💬" },
              { id: "tags",           label: "Tags vorschlagen",      icon: "🏷️" },
            ].map((a) => (
              <button
                key={a.id}
                onClick={() => aktion(a.id)}
                disabled={laedt !== null}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-surface)] disabled:opacity-50 transition-colors"
              >
                {laedt === a.id ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <span>{a.icon}</span>
                )}
                {laedt === a.id ? "Analysiere…" : a.label}
              </button>
            ))}
          </div>

          <p className="text-center text-[0.6rem] text-[var(--text-faint)]">
            Powered by Claude · Vorschläge immer prüfen bevor sie gesendet werden
          </p>
        </div>
      )}
    </div>
  );
}
