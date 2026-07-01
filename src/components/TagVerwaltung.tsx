import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface Tag {
  id: string;
  name: string;
  farbe: string;
}

const FARBEN = ["#6b7280","#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899"];

export default function TagVerwaltung({ organisationId }: { organisationId: string }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [neuerName, setNeuerName] = useState("");
  const [neueFarbe, setNeueFarbe] = useState(FARBEN[5]);
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => { ladeTags(); }, [organisationId]);

  async function ladeTags() {
    const { data } = await supabase.from("tags").select("id, name, farbe").eq("organisation_id", organisationId).order("name");
    setTags(data ?? []);
  }

  async function anlegen() {
    if (!neuerName.trim()) { setHinweis("Name erforderlich."); return; }
    setLaedt(true);
    const { error } = await supabase.from("tags").insert({ organisation_id: organisationId, name: neuerName.trim(), farbe: neueFarbe });
    setLaedt(false);
    if (error) { setHinweis(error.message.includes("unique") ? "Dieser Tag existiert bereits." : "Fehler."); return; }
    setNeuerName(""); setHinweis(null); ladeTags();
  }

  async function loeschen(id: string) {
    if (!confirm("Tag löschen? Er wird auch von allen Tickets entfernt.")) return;
    await supabase.from("tags").delete().eq("id", id);
    ladeTags();
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">Tags / Kategorien</h3>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t.id} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white" style={{ background: t.farbe }}>
            {t.name}
            <button onClick={() => loeschen(t.id)} className="hover:opacity-75">×</button>
          </span>
        ))}
        {tags.length === 0 && <p className="text-xs text-[var(--text-faint)]">Noch keine Tags.</p>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={neuerName}
          onChange={(e) => setNeuerName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && anlegen()}
          placeholder="Neuer Tag…"
          className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
        />
        <div className="flex gap-1">
          {FARBEN.map((f) => (
            <button key={f} onClick={() => setNeueFarbe(f)} className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
              style={{ background: f, borderColor: neueFarbe === f ? "var(--text-strong)" : "transparent" }} />
          ))}
        </div>
        <button onClick={anlegen} disabled={laedt} className="rounded bg-akzent px-3 py-2 text-xs font-medium text-white disabled:opacity-50">+</button>
      </div>
      {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}
    </div>
  );
}
