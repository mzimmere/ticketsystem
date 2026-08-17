import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface Stufe {
  id: string;
  name: string;
  farbe: string;
}

const FARBEN = ["#6b7280", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];
const MAX_STUFEN = 3;

export default function WartungsvertragStufenVerwaltung({ organisationId }: { organisationId: string }) {
  const { sprache } = useSprache();
  const txt = texte(sprache).wartungsvertragStufenVerwaltung;
  const [stufen, setStufen] = useState<Stufe[]>([]);
  const [neuerName, setNeuerName] = useState("");
  const [neueFarbe, setNeueFarbe] = useState(FARBEN[5]);
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => { ladeStufen(); }, [organisationId]);

  async function ladeStufen() {
    const { data } = await supabase
      .from("wartungsvertrag_stufen")
      .select("id, name, farbe")
      .eq("organisation_id", organisationId)
      .order("reihenfolge");
    setStufen(data ?? []);
  }

  async function anlegen() {
    if (!neuerName.trim()) { setHinweis(txt.nameErforderlich); return; }
    if (stufen.length >= MAX_STUFEN) { setHinweis(txt.maxErreicht); return; }
    setLaedt(true);
    const { error } = await supabase.from("wartungsvertrag_stufen").insert({
      organisation_id: organisationId,
      name: neuerName.trim(),
      farbe: neueFarbe,
      reihenfolge: stufen.length,
    });
    setLaedt(false);
    if (error) { setHinweis(txt.fehler); return; }
    setNeuerName(""); setHinweis(null); ladeStufen();
  }

  async function loeschen(id: string) {
    if (!confirm(txt.loeschenConfirm)) return;
    await supabase.from("wartungsvertrag_stufen").delete().eq("id", id);
    ladeStufen();
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">{txt.titel}</h3>
      <p className="text-xs text-[var(--text-faint)]">{txt.beschreibung}</p>
      <div className="flex flex-wrap gap-1.5">
        {stufen.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white" style={{ background: s.farbe }}>
            {s.name}
            <button onClick={() => loeschen(s.id)} className="hover:opacity-75">×</button>
          </span>
        ))}
        {stufen.length === 0 && <p className="text-xs text-[var(--text-faint)]">{txt.nochKeineStufen}</p>}
      </div>
      {stufen.length < MAX_STUFEN ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={neuerName}
            onChange={(e) => setNeuerName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && anlegen()}
            placeholder={txt.neueStufePlatzhalter}
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
      ) : (
        <p className="text-xs text-[var(--text-faint)]">{txt.maxErreicht}</p>
      )}
      {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}
    </div>
  );
}
