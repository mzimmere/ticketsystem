import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface Kategorie {
  id: string;
  name: string;
}

interface Eintrag {
  id: string;
  kategorie_id: string;
  wert: string;
}

const VORSCHLAEGE_MAX = 6;

interface KundenHardwareProps {
  kundeId: string;
  organisationId: string;
}

export default function KundenHardware({ kundeId, organisationId }: KundenHardwareProps) {
  const [kategorien, setKategorien] = useState<Kategorie[]>([]);
  const [eintraege, setEintraege] = useState<Eintrag[]>([]);
  const [vorschlaege, setVorschlaege] = useState<Map<string, string[]>>(new Map());
  const [neuerWert, setNeuerWert] = useState<Record<string, string>>({});
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, kundeId]);

  async function laden() {
    const [{ data: katDaten }, { data: eintragDaten }, { data: alleDaten }] = await Promise.all([
      supabase.from("hardware_kategorien").select("id, name").eq("organisation_id", organisationId).order("name"),
      supabase.from("kunden_hardware").select("id, kategorie_id, wert").eq("kunde_id", kundeId),
      supabase.from("kunden_hardware").select("kategorie_id, wert").eq("organisation_id", organisationId),
    ]);
    setKategorien((katDaten as Kategorie[]) ?? []);
    setEintraege((eintragDaten as Eintrag[]) ?? []);

    const karte = new Map<string, string[]>();
    for (const e of (alleDaten as { kategorie_id: string; wert: string }[]) ?? []) {
      const liste = karte.get(e.kategorie_id) ?? [];
      if (!liste.includes(e.wert)) liste.push(e.wert);
      karte.set(e.kategorie_id, liste);
    }
    setVorschlaege(karte);
  }

  async function wertHinzufuegen(kategorieId: string, wert: string) {
    const bereinigt = wert.trim();
    if (!bereinigt) return;
    const { error } = await supabase.from("kunden_hardware").insert({
      organisation_id: organisationId,
      kunde_id: kundeId,
      kategorie_id: kategorieId,
      wert: bereinigt,
    });
    if (error) {
      console.error(error);
      setHinweis("Konnte nicht hinzugefügt werden.");
      return;
    }
    setNeuerWert((n) => ({ ...n, [kategorieId]: "" }));
    setHinweis(null);
    laden();
  }

  async function wertEntfernen(id: string) {
    await supabase.from("kunden_hardware").delete().eq("id", id);
    laden();
  }

  if (kategorien.length === 0) {
    return (
      <p className="text-xs text-[var(--text-faint)]">
        Noch keine Hardware-Kategorien definiert (Verwaltung → Werkzeuge → Hardware-Kategorien).
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {kategorien.map((k) => {
        const zugeordnet = eintraege.filter((e) => e.kategorie_id === k.id);
        const zugeordneteWerte = new Set(zugeordnet.map((e) => e.wert));
        const vorschlaegeFuerKategorie = (vorschlaege.get(k.id) ?? [])
          .filter((w) => !zugeordneteWerte.has(w))
          .slice(0, VORSCHLAEGE_MAX);

        return (
          <div key={k.id}>
            <p className="mb-1 text-xs font-medium text-[var(--text-soft)]">{k.name}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {zugeordnet.map((e) => (
                <span
                  key={e.id}
                  className="flex items-center gap-1.5 rounded-full bg-akzent/15 px-2.5 py-1 text-xs font-medium text-akzent"
                >
                  {e.wert}
                  <button onClick={() => wertEntfernen(e.id)} className="hover:opacity-75">
                    ×
                  </button>
                </span>
              ))}
              {vorschlaegeFuerKategorie.map((w) => (
                <button
                  key={w}
                  onClick={() => wertHinzufuegen(k.id, w)}
                  className="rounded-full border border-dashed border-[var(--border-input)] px-2.5 py-1 text-xs text-[var(--text-faint)] hover:bg-[var(--bg-muted)]"
                >
                  + {w}
                </button>
              ))}
              <input
                type="text"
                value={neuerWert[k.id] ?? ""}
                onChange={(e) => setNeuerWert((n) => ({ ...n, [k.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") wertHinzufuegen(k.id, neuerWert[k.id] ?? "");
                }}
                placeholder="Eigener Wert…"
                className="w-32 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-strong)]"
              />
            </div>
          </div>
        );
      })}
      {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}
    </div>
  );
}
