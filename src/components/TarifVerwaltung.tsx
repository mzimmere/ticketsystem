import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface Staffel {
  id: string;
  von_mitarbeiter: number;
  bis_mitarbeiter: number | null;
  preis_pro_mitarbeiter_cent: number;
}

interface Tarif {
  id: string;
  name: string;
  grundpreis_cent: number;
  inklusive_mitarbeiter: number;
  mwst_satz: number;
  aktiv: boolean;
  staffeln: Staffel[];
}

function euro(cent: number, sprache: "de" | "en"): string {
  return (cent / 100).toLocaleString(sprache === "en" ? "en-US" : "de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TarifVerwaltung() {
  const { sprache } = useSprache();
  const txt = texte(sprache).tarifVerwaltung;
  const [tarife, setTarife] = useState<Tarif[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [zeigeNeu, setZeigeNeu] = useState(false);
  const [neuName, setNeuName] = useState("");
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => {
    laden();
  }, []);

  async function laden() {
    setLaedt(true);
    const [{ data: tarifDaten }, { data: staffelDaten }] = await Promise.all([
      supabase.from("tarife").select("id, name, grundpreis_cent, inklusive_mitarbeiter, mwst_satz, aktiv").order("grundpreis_cent"),
      supabase.from("tarif_staffeln").select("id, tarif_id, von_mitarbeiter, bis_mitarbeiter, preis_pro_mitarbeiter_cent").order("von_mitarbeiter"),
    ]);
    const zusammengefuehrt: Tarif[] = (tarifDaten ?? []).map((t) => ({
      ...t,
      staffeln: (staffelDaten ?? []).filter((s) => s.tarif_id === t.id),
    }));
    setTarife(zusammengefuehrt);
    setLaedt(false);
  }

  async function neuenTarifAnlegen() {
    if (!neuName.trim()) { setHinweis(txt.namePflicht); return; }
    const { error } = await supabase.from("tarife").insert({ name: neuName.trim() });
    if (error) { setHinweis(txt.anlegenFehlgeschlagen); return; }
    setNeuName("");
    setZeigeNeu(false);
    setHinweis(null);
    laden();
  }

  async function tarifAktualisieren(t: Tarif) {
    await supabase.from("tarife").update({
      name: t.name,
      grundpreis_cent: t.grundpreis_cent,
      inklusive_mitarbeiter: t.inklusive_mitarbeiter,
      mwst_satz: t.mwst_satz,
      aktiv: t.aktiv,
    }).eq("id", t.id);
    laden();
  }

  async function tarifLoeschen(id: string) {
    if (!confirm(txt.loeschenConfirm)) return;
    const { error } = await supabase.from("tarife").delete().eq("id", id);
    if (error) { setHinweis(txt.loeschenFehlgeschlagen); return; }
    laden();
  }

  async function staffelHinzufuegen(tarifId: string) {
    await supabase.from("tarif_staffeln").insert({
      tarif_id: tarifId,
      von_mitarbeiter: 1,
      preis_pro_mitarbeiter_cent: 0,
    });
    laden();
  }

  async function staffelAktualisieren(s: Staffel) {
    await supabase.from("tarif_staffeln").update({
      von_mitarbeiter: s.von_mitarbeiter,
      bis_mitarbeiter: s.bis_mitarbeiter,
      preis_pro_mitarbeiter_cent: s.preis_pro_mitarbeiter_cent,
    }).eq("id", s.id);
    laden();
  }

  async function staffelLoeschen(id: string) {
    await supabase.from("tarif_staffeln").delete().eq("id", id);
    laden();
  }

  if (laedt) return <p className="text-sm text-[var(--text-faint)]">{txt.laedt}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-faint)]">
          {txt.beschreibung}
        </p>
        <button
          onClick={() => setZeigeNeu(!zeigeNeu)}
          className="shrink-0 rounded bg-akzent px-3 py-1.5 text-xs font-medium text-white"
        >
          {txt.neuerTarif}
        </button>
      </div>

      {zeigeNeu && (
        <div className="flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-3">
          <input
            type="text"
            value={neuName}
            onChange={(e) => setNeuName(e.target.value)}
            placeholder={txt.tarifNamePlatzhalter}
            className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
          />
          <button onClick={neuenTarifAnlegen} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            {txt.anlegen}
          </button>
        </div>
      )}
      {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}

      {tarife.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">{txt.nochKeineTarife}</p>
      ) : (
        <div className="space-y-3">
          {tarife.map((t) => (
            <div key={t.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={t.name}
                  onChange={(e) => setTarife(tarife.map((x) => x.id === t.id ? { ...x, name: e.target.value } : x))}
                  onBlur={() => tarifAktualisieren(t)}
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-sm font-medium"
                />
                <label className="flex items-center gap-1.5 text-xs text-[var(--text-soft)]">
                  <input
                    type="checkbox"
                    checked={t.aktiv}
                    onChange={(e) => { const upd = { ...t, aktiv: e.target.checked }; setTarife(tarife.map((x) => x.id === t.id ? upd : x)); tarifAktualisieren(upd); }}
                    className="accent-amber-500"
                  />
                  {txt.aktiv}
                </label>
                <button onClick={() => tarifLoeschen(t.id)} className="rounded border border-red-300 px-2 py-1.5 text-xs text-red-600">
                  {txt.loeschen}
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-faint)]">{txt.grundgebuehr}</label>
                  <input
                    type="text" inputMode="decimal"
                    defaultValue={euro(t.grundpreis_cent, sprache)}
                    onBlur={(e) => {
                      const cent = Math.round((parseFloat(e.target.value.replace(",", ".")) || 0) * 100);
                      tarifAktualisieren({ ...t, grundpreis_cent: cent });
                    }}
                    className="w-28 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-faint)]">{txt.inklusiveMitarbeiter}</label>
                  <input
                    type="number" min={0}
                    defaultValue={t.inklusive_mitarbeiter}
                    onBlur={(e) => tarifAktualisieren({ ...t, inklusive_mitarbeiter: parseInt(e.target.value, 10) || 0 })}
                    className="w-24 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-faint)]">{txt.mwst}</label>
                  <input
                    type="text" inputMode="decimal"
                    defaultValue={t.mwst_satz}
                    onBlur={(e) => tarifAktualisieren({ ...t, mwst_satz: parseFloat(e.target.value.replace(",", ".")) || 0 })}
                    className="w-20 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">{txt.staffelnLabel}</p>
                  <button onClick={() => staffelHinzufuegen(t.id)} className="text-xs text-akzent hover:underline">
                    {txt.staffelHinzufuegen}
                  </button>
                </div>
                {t.staffeln.length === 0 ? (
                  <p className="text-xs text-[var(--text-faint)]">{txt.keineStaffeln}</p>
                ) : (
                  t.staffeln.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-xs">
                      <span className="text-[var(--text-faint)]">{txt.von}</span>
                      <input
                        type="number" min={1}
                        defaultValue={s.von_mitarbeiter}
                        onBlur={(e) => staffelAktualisieren({ ...s, von_mitarbeiter: parseInt(e.target.value, 10) || 1 })}
                        className="w-16 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1 text-xs"
                      />
                      <span className="text-[var(--text-faint)]">{txt.bis}</span>
                      <input
                        type="number" min={1}
                        placeholder="∞"
                        defaultValue={s.bis_mitarbeiter ?? ""}
                        onBlur={(e) => staffelAktualisieren({ ...s, bis_mitarbeiter: e.target.value ? parseInt(e.target.value, 10) : null })}
                        className="w-16 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1 text-xs"
                      />
                      <span className="text-[var(--text-faint)]">à</span>
                      <input
                        type="text" inputMode="decimal"
                        defaultValue={euro(s.preis_pro_mitarbeiter_cent, sprache)}
                        onBlur={(e) => staffelAktualisieren({ ...s, preis_pro_mitarbeiter_cent: Math.round((parseFloat(e.target.value.replace(",", ".")) || 0) * 100) })}
                        className="w-20 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1 text-xs"
                      />
                      <span className="text-[var(--text-faint)]">{txt.proMa}</span>
                      <button onClick={() => staffelLoeschen(s.id)} className="ml-auto text-[var(--text-faint)] hover:text-red-600">
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
