import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

type Prioritaet = "niedrig" | "mittel" | "hoch" | "kritisch";

interface Vorlage {
  id: string;
  titel: string;
  beschreibung: string;
  prioritaet: Prioritaet;
}

const PRIORITAET_LABEL: Record<Prioritaet, string> = {
  niedrig: "Niedrig", mittel: "Mittel", hoch: "Hoch", kritisch: "Kritisch",
};
const PRIORITAET_FARBE: Record<Prioritaet, string> = {
  niedrig: "text-slate-500", mittel: "text-yellow-600", hoch: "text-orange-600", kritisch: "text-red-600",
};

export default function VorlagenVerwaltung({ organisationId }: { organisationId: string }) {
  const [vorlagen, setVorlagen] = useState<Vorlage[]>([]);
  const [offen, setOffen] = useState<string | null>(null);
  const [zeigeNeu, setZeigeNeu] = useState(false);
  const [neuerTitel, setNeuerTitel] = useState("");
  const [neueBeschreibung, setNeueBeschreibung] = useState("");
  const [neuePrioritaet, setNeuePrioritaet] = useState<Prioritaet>("mittel");
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => { laden(); }, [organisationId]);

  async function laden() {
    const { data } = await supabase
      .from("vorlagen").select("id, titel, beschreibung, prioritaet")
      .eq("organisation_id", organisationId).order("titel");
    setVorlagen((data as Vorlage[]) ?? []);
  }

  async function speichern() {
    if (!neuerTitel.trim() || !neueBeschreibung.trim()) {
      setHinweis("Titel und Beschreibung sind erforderlich."); return;
    }
    setLaedt(true);
    const { error } = await supabase.from("vorlagen").insert({
      organisation_id: organisationId,
      titel: neuerTitel.trim(),
      beschreibung: neueBeschreibung.trim(),
      prioritaet: neuePrioritaet,
    });
    setLaedt(false);
    if (error) { setHinweis("Fehler beim Speichern."); return; }
    setNeuerTitel(""); setNeueBeschreibung(""); setNeuePrioritaet("mittel");
    setZeigeNeu(false); setHinweis(null); laden();
  }

  async function aktualisieren(id: string, titel: string, beschreibung: string, prioritaet: Prioritaet) {
    await supabase.from("vorlagen").update({ titel, beschreibung, prioritaet }).eq("id", id);
    setOffen(null); laden();
  }

  async function loeschen(id: string) {
    if (!confirm("Vorlage wirklich löschen?")) return;
    await supabase.from("vorlagen").delete().eq("id", id);
    laden();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-strong)]">Ticket-Vorlagen</h3>
        <button onClick={() => setZeigeNeu(!zeigeNeu)} className="rounded bg-akzent px-3 py-1.5 text-xs font-medium text-white">
          + Neue Vorlage
        </button>
      </div>
      <p className="text-xs text-[var(--text-faint)]">
        Vorlagen füllen beim Anlegen eines neuen Tickets Titel, Beschreibung und Priorität automatisch aus.
      </p>

      {zeigeNeu && (
        <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
          <input type="text" value={neuerTitel} onChange={(e) => setNeuerTitel(e.target.value)}
            placeholder="Titel (z.B. VPN funktioniert nicht)"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
          <textarea value={neueBeschreibung} onChange={(e) => setNeueBeschreibung(e.target.value)}
            rows={4} placeholder="Beschreibung, die das Ticket vorausfüllt…"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
          <select value={neuePrioritaet} onChange={(e) => setNeuePrioritaet(e.target.value as Prioritaet)}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm">
            {(["niedrig", "mittel", "hoch", "kritisch"] as Prioritaet[]).map((p) => (
              <option key={p} value={p}>{PRIORITAET_LABEL[p]}</option>
            ))}
          </select>
          {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}
          <div className="flex gap-2">
            <button onClick={speichern} disabled={laedt} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Speichern</button>
            <button onClick={() => { setZeigeNeu(false); setHinweis(null); }} className="rounded border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-soft)]">Abbrechen</button>
          </div>
        </div>
      )}

      {vorlagen.length === 0 && !zeigeNeu && (
        <p className="text-xs text-[var(--text-faint)]">Noch keine Vorlagen angelegt.</p>
      )}

      {vorlagen.map((v) => (
        <div key={v.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
          <button onClick={() => setOffen(offen === v.id ? null : v.id)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${PRIORITAET_FARBE[v.prioritaet]}`}>
                {PRIORITAET_LABEL[v.prioritaet]}
              </span>
              <span className="text-sm text-[var(--text-strong)]">{v.titel}</span>
            </div>
            <span className="text-xs text-[var(--text-faint)]">{offen === v.id ? "▲" : "▼"}</span>
          </button>
          {offen === v.id && (
            <VorlageBearbeiten vorlage={v} onSpeichern={aktualisieren} onLoeschen={loeschen} />
          )}
        </div>
      ))}
    </div>
  );
}

function VorlageBearbeiten({ vorlage, onSpeichern, onLoeschen }: {
  vorlage: Vorlage;
  onSpeichern: (id: string, titel: string, beschreibung: string, prioritaet: Prioritaet) => void;
  onLoeschen: (id: string) => void;
}) {
  const [titel, setTitel] = useState(vorlage.titel);
  const [beschreibung, setBeschreibung] = useState(vorlage.beschreibung);
  const [prioritaet, setPrioritaet] = useState<Prioritaet>(vorlage.prioritaet);

  return (
    <div className="border-t border-[var(--border)] p-3 space-y-2">
      <input type="text" value={titel} onChange={(e) => setTitel(e.target.value)}
        className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
      <textarea value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)}
        rows={4} className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
      <select value={prioritaet} onChange={(e) => setPrioritaet(e.target.value as Prioritaet)}
        className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm">
        {(["niedrig", "mittel", "hoch", "kritisch"] as Prioritaet[]).map((p) => (
          <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button onClick={() => onSpeichern(vorlage.id, titel, beschreibung, prioritaet)}
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">Speichern</button>
        <button onClick={() => onLoeschen(vorlage.id)}
          className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-600">Löschen</button>
      </div>
    </div>
  );
}
