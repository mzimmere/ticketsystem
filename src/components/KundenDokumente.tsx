import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface Kategorie {
  id: string;
  name: string;
}

interface Dokument {
  id: string;
  storage_path: string;
  dateiname: string;
  erstellt_am: string;
  kategorie_id: string | null;
}

interface KundenDokumenteProps {
  kundeId: string;
  organisationId: string;
}

export default function KundenDokumente({ kundeId, organisationId }: KundenDokumenteProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).kundenDokumente;
  const [kategorien, setKategorien] = useState<Kategorie[]>([]);
  const [dokumente, setDokumente] = useState<Dokument[]>([]);
  const [neueKategorieId, setNeueKategorieId] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kundeId, organisationId]);

  async function laden() {
    const [{ data: katDaten }, { data: dokDaten }] = await Promise.all([
      supabase.from("dokument_kategorien").select("id, name").eq("organisation_id", organisationId).order("name"),
      supabase
        .from("kunden_dokumente")
        .select("id, storage_path, dateiname, erstellt_am, kategorie_id")
        .eq("kunde_id", kundeId)
        .order("erstellt_am", { ascending: false }),
    ]);
    setKategorien((katDaten as Kategorie[]) ?? []);
    setDokumente((dokDaten as Dokument[]) ?? []);
  }

  async function dokumentHochladen(datei: File) {
    setLaedt(true);
    setHinweis(null);
    try {
      const pfad = `${kundeId}/${Date.now()}-${sichererDateiname(datei.name)}`;
      const { error: uploadFehler } = await supabase.storage.from("kundendokumente").upload(pfad, datei);
      if (uploadFehler) throw uploadFehler;

      const { data: authData } = await supabase.auth.getUser();
      const { error: insertFehler } = await supabase.from("kunden_dokumente").insert({
        organisation_id: organisationId,
        kunde_id: kundeId,
        storage_path: pfad,
        dateiname: datei.name,
        dateityp: datei.type,
        hochgeladen_von: authData.user?.id,
        kategorie_id: neueKategorieId || null,
      });
      if (insertFehler) throw insertFehler;

      laden();
    } catch (err) {
      console.error(err);
      setHinweis(txt.fehlerUpload);
    } finally {
      setLaedt(false);
    }
  }

  async function dokumentOeffnen(pfad: string) {
    const { data, error } = await supabase.storage.from("kundendokumente").createSignedUrl(pfad, 60);
    if (error || !data) {
      setHinweis(txt.fehlerOeffnen);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function dokumentLoeschen(dokId: string, pfad: string) {
    await supabase.storage.from("kundendokumente").remove([pfad]);
    await supabase.from("kunden_dokumente").delete().eq("id", dokId);
    laden();
  }

  async function kategorieAendern(dokId: string, kategorieId: string) {
    await supabase.from("kunden_dokumente").update({ kategorie_id: kategorieId || null }).eq("id", dokId);
    laden();
  }

  const gruppen: { id: string | null; name: string }[] = [
    ...kategorien.map((k) => ({ id: k.id, name: k.name })),
    { id: null, name: txt.ohneKategorie },
  ];

  return (
    <div className="space-y-3">
      {dokumente.length > 0 && (
        <div className="space-y-3">
          {gruppen.map((g) => {
            const zugeordnet = dokumente.filter((d) => d.kategorie_id === g.id);
            if (zugeordnet.length === 0) return null;
            return (
              <div key={g.id ?? "ohne"}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                  {g.name}
                </p>
                <div className="space-y-1.5">
                  {zugeordnet.map((d) => (
                    <div
                      key={d.id}
                      className="flex flex-wrap items-center gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5"
                    >
                      <button
                        onClick={() => dokumentOeffnen(d.storage_path)}
                        className="truncate text-left text-sm text-[var(--text-strong)] hover:underline"
                      >
                        {d.dateiname}
                      </button>
                      <select
                        value={d.kategorie_id ?? ""}
                        onChange={(e) => kategorieAendern(d.id, e.target.value)}
                        className="ml-auto rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-xs text-[var(--text-soft)]"
                      >
                        <option value="">{txt.ohneKategorie}</option>
                        {kategorien.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => dokumentLoeschen(d.id, d.storage_path)}
                        className="shrink-0 text-xs text-[var(--text-faint)] hover:text-red-600"
                      >
                        {txt.loeschen}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        {kategorien.length > 0 && (
          <select
            value={neueKategorieId}
            onChange={(e) => setNeueKategorieId(e.target.value)}
            className="rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-2 text-sm text-[var(--text-soft)]"
          >
            <option value="">{txt.ohneKategorie}</option>
            {kategorien.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        )}
        <label className="flex-1 cursor-pointer rounded border border-dashed border-[var(--border-input)] px-3 py-2 text-center text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">
          {laedt ? txt.wirdHochgeladen : txt.dokumentHochladen}
          <input
            type="file"
            className="hidden"
            disabled={laedt}
            onChange={(e) => e.target.files?.[0] && dokumentHochladen(e.target.files[0])}
          />
        </label>
      </div>
      {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}
    </div>
  );
}
