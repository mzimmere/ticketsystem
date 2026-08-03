import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface Kategorie {
  id: string;
  name: string;
}

export default function HardwareKategorienVerwaltung({ organisationId }: { organisationId: string }) {
  const { sprache } = useSprache();
  const txt = texte(sprache).hardwareKategorienVerwaltung;
  const [kategorien, setKategorien] = useState<Kategorie[]>([]);
  const [neuerName, setNeuerName] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId]);

  async function laden() {
    const { data } = await supabase
      .from("hardware_kategorien")
      .select("id, name")
      .eq("organisation_id", organisationId)
      .order("name");
    setKategorien(data ?? []);
  }

  async function anlegen() {
    if (!neuerName.trim()) {
      setHinweis(txt.nameErforderlich);
      return;
    }
    setLaedt(true);
    const { error } = await supabase
      .from("hardware_kategorien")
      .insert({ organisation_id: organisationId, name: neuerName.trim() });
    setLaedt(false);
    if (error) {
      setHinweis(error.message.includes("unique") ? txt.kategorieExistiertBereits : txt.fehler);
      return;
    }
    setNeuerName("");
    setHinweis(null);
    laden();
  }

  async function loeschen(id: string, name: string) {
    if (!confirm(txt.loeschenConfirmTemplate.replace("{name}", name))) {
      return;
    }
    await supabase.from("hardware_kategorien").delete().eq("id", id);
    laden();
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">{txt.titel}</h3>
      <p className="text-xs text-[var(--text-faint)]">
        {txt.beschreibung}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {kategorien.map((k) => (
          <span
            key={k.id}
            className="flex items-center gap-1.5 rounded-full bg-[var(--bg-muted)] px-3 py-1 text-xs font-medium text-[var(--text-strong)]"
          >
            {k.name}
            <button onClick={() => loeschen(k.id, k.name)} className="text-[var(--text-faint)] hover:text-red-600">
              ×
            </button>
          </span>
        ))}
        {kategorien.length === 0 && <p className="text-xs text-[var(--text-faint)]">{txt.nochKeineKategorien}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={neuerName}
          onChange={(e) => setNeuerName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && anlegen()}
          placeholder={txt.neueKategoriePlatzhalter}
          className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
        />
        <button
          onClick={anlegen}
          disabled={laedt}
          className="rounded bg-akzent px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          +
        </button>
      </div>
      {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}
    </div>
  );
}
