import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface Subreseller {
  id: string;
  name: string;
  email: string;
}

export default function SubresellerVerwaltung({ organisationId }: { organisationId: string }) {
  const { sprache } = useSprache();
  const txt = texte(sprache).subresellerVerwaltung;
  const [subreseller, setSubreseller] = useState<Subreseller[]>([]);
  const [neuerName, setNeuerName] = useState("");
  const [neueEmail, setNeueEmail] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => { ladeSubreseller(); }, [organisationId]);

  async function ladeSubreseller() {
    const { data } = await supabase
      .from("subreseller")
      .select("id, name, email")
      .eq("organisation_id", organisationId)
      .order("name");
    setSubreseller(data ?? []);
  }

  async function anlegen() {
    if (!neuerName.trim()) { setHinweis(txt.nameErforderlich); return; }
    if (!neueEmail.trim()) { setHinweis(txt.emailErforderlich); return; }
    setLaedt(true);
    const { error } = await supabase.from("subreseller").insert({
      organisation_id: organisationId,
      name: neuerName.trim(),
      email: neueEmail.trim(),
    });
    setLaedt(false);
    if (error) { setHinweis(txt.fehler); return; }
    setNeuerName(""); setNeueEmail(""); setHinweis(null); ladeSubreseller();
  }

  async function loeschen(id: string) {
    if (!confirm(txt.loeschenConfirm)) return;
    await supabase.from("subreseller").delete().eq("id", id);
    ladeSubreseller();
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">{txt.titel}</h3>
      <p className="text-xs text-[var(--text-faint)]">{txt.beschreibung}</p>
      <div className="space-y-1.5">
        {subreseller.map((s) => (
          <div key={s.id} className="flex items-center gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5">
            <span className="text-sm font-medium text-[var(--text-strong)]">{s.name}</span>
            <span className="text-xs text-[var(--text-faint)]">{s.email}</span>
            <button onClick={() => loeschen(s.id)} className="ml-auto text-[var(--text-faint)] hover:text-red-600">×</button>
          </div>
        ))}
        {subreseller.length === 0 && <p className="text-xs text-[var(--text-faint)]">{txt.nochKeineSubreseller}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={neuerName}
          onChange={(e) => setNeuerName(e.target.value)}
          placeholder={txt.neuerNamePlatzhalter}
          className="min-w-[10rem] flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
        />
        <input
          type="email"
          value={neueEmail}
          onChange={(e) => setNeueEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && anlegen()}
          placeholder={txt.neueEmailPlatzhalter}
          className="min-w-[12rem] flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
        />
        <button onClick={anlegen} disabled={laedt} className="shrink-0 rounded bg-akzent px-3 py-2 text-xs font-medium text-white disabled:opacity-50">+</button>
      </div>
      {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}
    </div>
  );
}
