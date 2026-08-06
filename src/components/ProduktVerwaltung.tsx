import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import type { Sprache } from "../lib/SpracheContext";

interface Produkt {
  id: string;
  bezeichnung: string;
  beschreibung: string | null;
  einzelpreis_cent: number;
  einheit: string;
  aktiv: boolean;
}

const EINHEITEN = ["Stück", "Minute", "Stunde", "Pauschale", "Lizenz", "Monat", "Tag", "km"];

function euro(cent: number, sprache: Sprache): string {
  return (cent / 100).toLocaleString(sprache === "en" ? "en-US" : "de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProduktVerwaltung({ organisationId, profilId }: { organisationId: string; profilId: string }) {
  const { sprache } = useSprache();
  const txt = texte(sprache).produktVerwaltung;
  const [produkte, setProdukte] = useState<Produkt[]>([]);
  const [offen, setOffen] = useState<string | null>(null);
  const [zeigeNeu, setZeigeNeu] = useState(false);
  const [bezeichnung, setBezeichnung] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [preisEuro, setPreisEuro] = useState("");
  const [einheit, setEinheit] = useState("Stück");
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => { laden(); }, [profilId]);

  async function laden() {
    const { data } = await supabase
      .from("produkte")
      .select("id, bezeichnung, beschreibung, einzelpreis_cent, einheit, aktiv")
      .eq("ersteller_id", profilId)
      .order("bezeichnung");
    setProdukte(data ?? []);
  }

  async function speichern() {
    if (!bezeichnung.trim() || !preisEuro.trim()) {
      setHinweis(txt.fehlerPflichtfelder);
      return;
    }
    const cent = Math.round(parseFloat(preisEuro.replace(",", ".")) * 100);
    if (isNaN(cent)) { setHinweis(txt.fehlerPreis); return; }

    setLaedt(true);
    const { error } = await supabase.from("produkte").insert({
      organisation_id: organisationId,
      ersteller_id: profilId,
      bezeichnung: bezeichnung.trim(),
      beschreibung: beschreibung.trim() || null,
      einzelpreis_cent: cent,
      einheit,
    });
    setLaedt(false);
    if (error) { setHinweis(txt.fehlerSpeichern); return; }
    setBezeichnung(""); setBeschreibung(""); setPreisEuro(""); setEinheit("Stück");
    setZeigeNeu(false); setHinweis(null);
    laden();
  }

  async function aktualisieren(p: Produkt) {
    await supabase.from("produkte").update({
      bezeichnung: p.bezeichnung,
      beschreibung: p.beschreibung,
      einzelpreis_cent: p.einzelpreis_cent,
      einheit: p.einheit,
      aktiv: p.aktiv,
    }).eq("id", p.id);
    setOffen(null);
    laden();
  }

  async function loeschen(id: string) {
    if (!confirm(txt.loeschenBestaetigen)) return;
    await supabase.from("produkte").delete().eq("id", id);
    laden();
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-strong)]">{txt.titel}</h3>
        <button onClick={() => setZeigeNeu(!zeigeNeu)} className="rounded bg-akzent px-3 py-1.5 text-xs font-medium text-white">
          {txt.neu}
        </button>
      </div>
      <p className="text-xs text-[var(--text-faint)]">
        {txt.hinweisText}
      </p>

      {zeigeNeu && (
        <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-3">
          <input type="text" value={bezeichnung} onChange={(e) => setBezeichnung(e.target.value)}
            placeholder={txt.bezeichnungPlatzhalter}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
          <input type="text" value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)}
            placeholder={txt.beschreibungPlatzhalter}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-[var(--text-faint)]">{txt.einzelpreis}</label>
              <input type="text" inputMode="decimal" value={preisEuro} onChange={(e) => setPreisEuro(e.target.value)}
                placeholder="0,00"
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-[var(--text-faint)]">{txt.einheit}</label>
              <select value={einheit} onChange={(e) => setEinheit(e.target.value)}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm">
                {EINHEITEN.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}
          <div className="flex gap-2">
            <button onClick={speichern} disabled={laedt} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{txt.speichern}</button>
            <button onClick={() => { setZeigeNeu(false); setHinweis(null); }} className="rounded border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-soft)]">{txt.abbrechen}</button>
          </div>
        </div>
      )}

      {produkte.length === 0 && !zeigeNeu && (
        <p className="text-xs text-[var(--text-faint)]">{txt.keineProdukte}</p>
      )}

      <div className="space-y-1.5">
        {produkte.map((p) => (
          <div key={p.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
            <button onClick={() => setOffen(offen === p.id ? null : p.id)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
              {!p.aktiv && <span className="text-[0.6rem] uppercase text-[var(--text-faint)]">{txt.inaktiv}</span>}
              <span className="flex-1 truncate text-sm text-[var(--text-strong)]">{p.bezeichnung}</span>
              <span className="shrink-0 text-sm font-medium text-[var(--text-strong)]">{euro(p.einzelpreis_cent, sprache)} €</span>
              <span className="shrink-0 text-xs text-[var(--text-faint)]">/ {p.einheit}</span>
            </button>
            {offen === p.id && (
              <ProduktBearbeiten produkt={p} onSpeichern={aktualisieren} onLoeschen={loeschen} txt={txt} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProduktBearbeiten({ produkt, onSpeichern, onLoeschen, txt }: {
  produkt: Produkt;
  onSpeichern: (p: Produkt) => void;
  onLoeschen: (id: string) => void;
  txt: ReturnType<typeof texte>["produktVerwaltung"];
}) {
  const [p, setP] = useState({ ...produkt });
  const [preisEuro, setPreisEuro] = useState((produkt.einzelpreis_cent / 100).toFixed(2).replace(".", ","));

  function speichern() {
    const cent = Math.round(parseFloat(preisEuro.replace(",", ".")) * 100);
    onSpeichern({ ...p, einzelpreis_cent: isNaN(cent) ? produkt.einzelpreis_cent : cent });
  }

  return (
    <div className="border-t border-[var(--border)] p-3 space-y-2">
      <input type="text" value={p.bezeichnung} onChange={(e) => setP({ ...p, bezeichnung: e.target.value })}
        className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
      <input type="text" value={p.beschreibung ?? ""} onChange={(e) => setP({ ...p, beschreibung: e.target.value || null })}
        placeholder={txt.beschreibungOptional}
        className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <input type="text" inputMode="decimal" value={preisEuro} onChange={(e) => setPreisEuro(e.target.value)}
          className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
        <select value={p.einheit} onChange={(e) => setP({ ...p, einheit: e.target.value })}
          className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm">
          {EINHEITEN.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-xs text-[var(--text-soft)]">
        <input type="checkbox" checked={p.aktiv} onChange={(e) => setP({ ...p, aktiv: e.target.checked })} className="accent-amber-500" />
        {txt.aktivHinweis}
      </label>
      <div className="flex gap-2">
        <button onClick={speichern} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">{txt.speichern}</button>
        <button onClick={() => onLoeschen(produkt.id)} className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-600">{txt.loeschen}</button>
      </div>
    </div>
  );
}
