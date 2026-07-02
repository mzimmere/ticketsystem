import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface FaqEintrag {
  id: string;
  frage: string;
  antwort: string;
  kategorie: string | null;
  reihenfolge: number;
  oeffentlich: boolean;
}

export default function FaqVerwaltung({ organisationId, slug }: { organisationId: string; slug?: string | null }) {
  const [eintraege, setEintraege] = useState<FaqEintrag[]>([]);
  const [offen, setOffen] = useState<string | null>(null);
  const [zeigeNeu, setZeigeNeu] = useState(false);
  const [frage, setFrage] = useState("");
  const [antwort, setAntwort] = useState("");
  const [kategorie, setKategorie] = useState("");
  const [oeffentlich, setOeffentlich] = useState(true);
  const [laedt, setLaedt] = useState(false);
  const [linkKopiert, setLinkKopiert] = useState(false);
  const faqUrl = slug ? `${window.location.origin}/?faq=${slug}` : null;
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => { laden(); }, [organisationId]);

  async function laden() {
    const { data } = await supabase
      .from("faq_eintraege").select("id, frage, antwort, kategorie, reihenfolge, oeffentlich")
      .eq("organisation_id", organisationId).order("reihenfolge").order("erstellt_am");
    setEintraege(data ?? []);
  }

  async function speichern() {
    if (!frage.trim() || !antwort.trim()) { setHinweis("Frage und Antwort sind Pflichtfelder."); return; }
    setLaedt(true);
    await supabase.from("faq_eintraege").insert({
      organisation_id: organisationId,
      frage: frage.trim(), antwort: antwort.trim(),
      kategorie: kategorie.trim() || null, oeffentlich,
    });
    setFrage(""); setAntwort(""); setKategorie(""); setOeffentlich(true);
    setZeigeNeu(false); setHinweis(null); setLaedt(false); laden();
  }

  async function aktualisieren(e: FaqEintrag) {
    await supabase.from("faq_eintraege").update({
      frage: e.frage, antwort: e.antwort, kategorie: e.kategorie, oeffentlich: e.oeffentlich,
    }).eq("id", e.id);
    setOffen(null); laden();
  }

  async function loeschen(id: string) {
    if (!confirm("FAQ-Eintrag wirklich löschen?")) return;
    await supabase.from("faq_eintraege").delete().eq("id", id);
    laden();
  }

  const kategorien = [...new Set(eintraege.map((e) => e.kategorie).filter(Boolean))] as string[];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-strong)]">FAQ / Wissensdatenbank</h3>
        <button onClick={() => setZeigeNeu(!zeigeNeu)} className="rounded bg-akzent px-3 py-1.5 text-xs font-medium text-white">
          + Neuer Eintrag
        </button>
      </div>

      {faqUrl ? (
        <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-muted)] px-3 py-2">
          <span className="text-xs text-[var(--text-faint)]">🔗 Öffentlicher Link:</span>
          <code className="flex-1 truncate text-xs text-[var(--text-soft)]">{faqUrl}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(faqUrl); setLinkKopiert(true); setTimeout(() => setLinkKopiert(false), 2000); }}
            className="shrink-0 rounded border border-[var(--border-input)] px-2 py-1 text-xs text-[var(--text-faint)] hover:bg-[var(--bg-muted)]"
          >
            {linkKopiert ? "✓ Kopiert" : "Kopieren"}
          </button>
          <a href={faqUrl} target="_blank" rel="noreferrer"
            className="shrink-0 rounded border border-[var(--border-input)] px-2 py-1 text-xs text-[var(--text-faint)] hover:bg-[var(--bg-muted)]">
            ↗ Vorschau
          </a>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-faint)]">
          Trage unter <strong>Firma → Registrierungslink</strong> einen Slug ein, damit der öffentliche FAQ-Link aktiviert wird.
        </p>
      )}
      <p className="text-xs text-[var(--text-faint)]">
        Öffentliche Einträge sind für Kunden im Portal sichtbar. Interne Einträge nur für dein Team.
      </p>

      {zeigeNeu && (
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <input type="text" value={frage} onChange={(e) => setFrage(e.target.value)}
            placeholder="Frage (z.B. Wie setze ich mein Passwort zurück?)"
            className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
          <textarea value={antwort} onChange={(e) => setAntwort(e.target.value)}
            rows={4} placeholder="Antwort…"
            className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <input type="text" value={kategorie} onChange={(e) => setKategorie(e.target.value)}
              placeholder="Kategorie (optional)"
              list="faq-kategorien"
              className="flex-1 rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
            <datalist id="faq-kategorien">
              {kategorien.map((k) => <option key={k} value={k} />)}
            </datalist>
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-soft)]">
              <input type="checkbox" checked={oeffentlich} onChange={(e) => setOeffentlich(e.target.checked)} className="accent-amber-500" />
              Öffentlich
            </label>
          </div>
          {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}
          <div className="flex gap-2">
            <button onClick={speichern} disabled={laedt} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Speichern</button>
            <button onClick={() => setZeigeNeu(false)} className="rounded border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-soft)]">Abbrechen</button>
          </div>
        </div>
      )}

      {eintraege.length === 0 && !zeigeNeu && (
        <p className="text-xs text-[var(--text-faint)]">Noch keine Einträge. Füge häufig gestellte Fragen hinzu, damit Kunden sich selbst helfen können.</p>
      )}

      <div className="space-y-1.5">
        {eintraege.map((e) => (
          <div key={e.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <button onClick={() => setOffen(offen === e.id ? null : e.id)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left">
              <span className={`shrink-0 text-[0.6rem] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded ${e.oeffentlich ? "bg-green-100 text-green-700" : "bg-[var(--bg-muted)] text-[var(--text-faint)]"}`}>
                {e.oeffentlich ? "Öffentlich" : "Intern"}
              </span>
              {e.kategorie && <span className="shrink-0 text-xs text-[var(--text-faint)]">{e.kategorie} ·</span>}
              <span className="flex-1 truncate text-sm text-[var(--text-strong)]">{e.frage}</span>
              <span className="text-xs text-[var(--text-faint)]">{offen === e.id ? "▲" : "▼"}</span>
            </button>
            {offen === e.id && (
              <FaqBearbeiten eintrag={e} onSpeichern={aktualisieren} onLoeschen={loeschen} kategorien={kategorien} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FaqBearbeiten({ eintrag, onSpeichern, onLoeschen, kategorien }: {
  eintrag: FaqEintrag;
  onSpeichern: (e: FaqEintrag) => void;
  onLoeschen: (id: string) => void;
  kategorien: string[];
}) {
  const [e, setE] = useState({ ...eintrag });
  return (
    <div className="border-t border-[var(--border)] p-4 space-y-2">
      <input type="text" value={e.frage} onChange={(x) => setE({ ...e, frage: x.target.value })}
        className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
      <textarea value={e.antwort} onChange={(x) => setE({ ...e, antwort: x.target.value })}
        rows={4} className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <input type="text" value={e.kategorie ?? ""} onChange={(x) => setE({ ...e, kategorie: x.target.value || null })}
          placeholder="Kategorie" list="faq-kat-edit"
          className="flex-1 rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
        <datalist id="faq-kat-edit">{kategorien.map((k) => <option key={k} value={k} />)}</datalist>
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-soft)]">
          <input type="checkbox" checked={e.oeffentlich} onChange={(x) => setE({ ...e, oeffentlich: x.target.checked })} className="accent-amber-500" />
          Öffentlich
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSpeichern(e)} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">Speichern</button>
        <button onClick={() => onLoeschen(eintrag.id)} className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-600">Löschen</button>
      </div>
    </div>
  );
}
