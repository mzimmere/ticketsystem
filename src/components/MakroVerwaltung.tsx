import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface Makro {
  id: string;
  titel: string;
  inhalt: string;
}

interface MakroVerwaltungProps {
  organisationId: string;
}

export default function MakroVerwaltung({ organisationId }: MakroVerwaltungProps) {
  const [makros, setMakros] = useState<Makro[]>([]);
  const [offen, setOffen] = useState<string | null>(null);
  const [neuerTitel, setNeuerTitel] = useState("");
  const [neuerInhalt, setNeuerInhalt] = useState("");
  const [zeigeNeu, setZeigeNeu] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => { ladeMakros(); }, [organisationId]);

  async function ladeMakros() {
    const { data } = await supabase
      .from("makros").select("id, titel, inhalt")
      .eq("organisation_id", organisationId).order("titel");
    setMakros(data ?? []);
  }

  async function speichern() {
    if (!neuerTitel.trim() || !neuerInhalt.trim()) { setHinweis("Titel und Inhalt sind erforderlich."); return; }
    setLaedt(true);
    const { error } = await supabase.from("makros").insert({
      organisation_id: organisationId, titel: neuerTitel.trim(), inhalt: neuerInhalt.trim()
    });
    setLaedt(false);
    if (error) { setHinweis("Fehler beim Speichern."); return; }
    setNeuerTitel(""); setNeuerInhalt(""); setZeigeNeu(false); setHinweis(null);
    ladeMakros();
  }

  async function aktualisieren(id: string, titel: string, inhalt: string) {
    setLaedt(true);
    await supabase.from("makros").update({ titel, inhalt }).eq("id", id);
    setLaedt(false); setOffen(null); ladeMakros();
  }

  async function loeschen(id: string) {
    if (!confirm("Makro wirklich löschen?")) return;
    await supabase.from("makros").delete().eq("id", id);
    ladeMakros();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-strong)]">Makros (Textbausteine)</h3>
        <button onClick={() => setZeigeNeu(!zeigeNeu)} className="rounded bg-akzent px-3 py-1.5 text-xs font-medium text-white">
          + Neues Makro
        </button>
      </div>
      {zeigeNeu && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 space-y-2">
          <input type="text" value={neuerTitel} onChange={(e) => setNeuerTitel(e.target.value)} placeholder="Titel (z.B. Passwort zurücksetzen)" className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
          <textarea value={neuerInhalt} onChange={(e) => setNeuerInhalt(e.target.value)} rows={4} placeholder="Inhalt der Antwort…" className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
          {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}
          <div className="flex gap-2">
            <button onClick={speichern} disabled={laedt} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Speichern</button>
            <button onClick={() => { setZeigeNeu(false); setHinweis(null); }} className="rounded border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-soft)]">Abbrechen</button>
          </div>
        </div>
      )}
      {makros.length === 0 && !zeigeNeu && <p className="text-xs text-[var(--text-faint)]">Noch keine Makros angelegt.</p>}
      {makros.map((m) => (
        <div key={m.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
          <button onClick={() => setOffen(offen === m.id ? null : m.id)} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-[var(--text-strong)]">
            <span>{m.titel}</span>
            <span className="text-[var(--text-faint)]">{offen === m.id ? "▲" : "▼"}</span>
          </button>
          {offen === m.id && (
            <EditMakro makro={m} onSpeichern={aktualisieren} onLoeschen={loeschen} laedt={laedt} />
          )}
        </div>
      ))}
    </div>
  );
}

function EditMakro({ makro, onSpeichern, onLoeschen, laedt }: { makro: Makro; onSpeichern: (id: string, t: string, i: string) => void; onLoeschen: (id: string) => void; laedt: boolean }) {
  const [titel, setTitel] = useState(makro.titel);
  const [inhalt, setInhalt] = useState(makro.inhalt);
  return (
    <div className="border-t border-[var(--border)] p-3 space-y-2">
      <input type="text" value={titel} onChange={(e) => setTitel(e.target.value)} className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
      <textarea value={inhalt} onChange={(e) => setInhalt(e.target.value)} rows={4} className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button onClick={() => onSpeichern(makro.id, titel, inhalt)} disabled={laedt} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Speichern</button>
        <button onClick={() => onLoeschen(makro.id)} className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">Löschen</button>
      </div>
    </div>
  );
}
