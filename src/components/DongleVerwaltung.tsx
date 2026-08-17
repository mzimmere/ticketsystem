import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

type Wartungsvertrag = "aktiv" | "inaktiv" | "nicht_gewuenscht";

interface Dongle {
  id: string;
  seriennummer: string;
  software: string;
  wartungsvertrag: Wartungsvertrag;
  freiminuten_pro_monat: number;
  gruppe: string | null;
  liefer_datum: string | null;
  notiz: string | null;
}

interface Modul {
  id: string;
  name: string;
  aktiv: boolean;
  activation_key: string | null;
  article_number: string | null;
  liefer_datum: string | null;
}

interface LizenzVertrag {
  id: string;
  lizenz_seriennummer: string;
  produkt_name: string;
  vertrag_ende: string | null;
  status: string | null;
  dongle_id: string | null;
  aktuelle_engine_build: string | null;
}

const WARTUNG_FARBE: Record<Wartungsvertrag, string> = {
  aktiv: "bg-[var(--status-geloest-bg)] text-[var(--status-geloest-text)]",
  inaktiv: "bg-[var(--badge-kritisch-bg)] text-[var(--badge-kritisch-text)]",
  nicht_gewuenscht: "bg-[var(--bg-muted)] text-[var(--text-faint)]",
};

// exocad-Lizenzen laufen ueblicherweise ein Jahr - ohne Vertragsbeginn
// im Datenmodell dient ein 365-Tage-Referenzfenster als Naeherung fuer
// den Fuellstand des Laufzeit-Balkens (100% = Vertragsende erreicht).
function laufzeitInfo(vertragEnde: string | null | undefined) {
  if (!vertragEnde) return null;
  const tage = Math.round((new Date(vertragEnde).getTime() - Date.now()) / 86400000);
  const prozent = Math.max(0, Math.min(100, 100 - (tage / 365) * 100));
  const farbe =
    tage < 0
      ? "var(--badge-kritisch-text)"
      : tage <= 30
      ? "var(--status-offen-text)"
      : "var(--akzent)";
  return { tage, prozent, farbe };
}

const ANZAHL_STANDARD_SICHTBAR = 3;

interface DongleVerwaltungProps {
  kundeId: string;
  organisationId: string;
}

export default function DongleVerwaltung({ kundeId, organisationId }: DongleVerwaltungProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).dongleVerwaltung;
  const WARTUNG_LABEL: Record<Wartungsvertrag, string> = {
    aktiv: txt.wartungAktiv,
    inaktiv: txt.wartungInaktiv,
    nicht_gewuenscht: txt.wartungNichtGewuenscht,
  };
  const [dongles, setDongles] = useState<Dongle[]>([]);
  const [offenDongleId, setOffenDongleId] = useState<string | null>(null);
  const [module, setModule] = useState<Record<string, Modul[]>>({});
  const [neuesModul, setNeuesModul] = useState<Record<string, string>>({});
  const [zeigeNeuerDongle, setZeigeNeuerDongle] = useState(false);
  const [neueSeriennummer, setNeueSeriennummer] = useState("");
  const [neueSoftware, setNeueSoftware] = useState("exocad");
  const [filterNummer, setFilterNummer] = useState("");
  const [alleAnzeigen, setAlleAnzeigen] = useState(false);
  const [vertraege, setVertraege] = useState<LizenzVertrag[]>([]);
  const [verknuepfenAuswahl, setVerknuepfenAuswahl] = useState<Record<string, string>>({});
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => {
    ladeDongles();
    ladeVertraege();
    setOffenDongleId(null);
    setFilterNummer("");
    setAlleAnzeigen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kundeId]);

  async function ladeDongles() {
    const { data, error } = await supabase
      .from("kunden_dongles")
      .select("id, seriennummer, software, wartungsvertrag, freiminuten_pro_monat, gruppe, liefer_datum, notiz")
      .eq("kunde_id", kundeId)
      .order("erstellt_am", { ascending: false });
    if (error) {
      console.error(error);
      setHinweis(txt.fehlerLaden);
    }
    setDongles((data as Dongle[]) ?? []);
  }

  async function ladeVertraege() {
    const { data } = await supabase
      .from("lizenz_vertraege")
      .select("id, lizenz_seriennummer, produkt_name, vertrag_ende, status, dongle_id, aktuelle_engine_build")
      .eq("kunde_id", kundeId)
      .order("vertrag_ende", { ascending: true, nullsFirst: false });
    setVertraege((data as LizenzVertrag[]) ?? []);
  }

  async function ladeModule(dongleId: string) {
    const { data } = await supabase
      .from("dongle_module")
      .select("id, name, aktiv, activation_key, article_number, liefer_datum")
      .eq("dongle_id", dongleId)
      .order("name");
    setModule((m) => ({ ...m, [dongleId]: (data as Modul[]) ?? [] }));
  }

  function dongleOeffnen(id: string) {
    if (offenDongleId === id) {
      setOffenDongleId(null);
      return;
    }
    setOffenDongleId(id);
    if (!module[id]) ladeModule(id);
  }

  async function dongleAnlegen() {
    if (!neueSeriennummer.trim()) return;
    setHinweis(null);
    const { error } = await supabase.from("kunden_dongles").insert({
      organisation_id: organisationId,
      kunde_id: kundeId,
      seriennummer: neueSeriennummer.trim(),
      software: neueSoftware.trim() || "exocad",
    });
    if (error) {
      console.error(error);
      setHinweis(
        error.code === "23505"
          ? txt.seriennummerVergeben
          : txt.fehlerAnlegen,
      );
      return;
    }
    setNeueSeriennummer("");
    setNeueSoftware("exocad");
    setZeigeNeuerDongle(false);
    ladeDongles();
  }

  async function dongleAktualisieren(id: string, patch: Partial<Dongle>) {
    setDongles((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    await supabase.from("kunden_dongles").update(patch).eq("id", id);
  }

  async function dongleLoeschen(id: string, seriennummer: string) {
    if (!confirm(txt.loeschenConfirmTemplate.replace("{seriennummer}", seriennummer))) {
      return;
    }
    setHinweis(null);
    const { error } = await supabase.from("kunden_dongles").delete().eq("id", id);
    if (error) {
      console.error(error);
      setHinweis(txt.fehlerLoeschen);
      return;
    }
    if (offenDongleId === id) setOffenDongleId(null);
    ladeDongles();
  }

  async function modulHinzufuegen(dongleId: string) {
    const name = (neuesModul[dongleId] ?? "").trim();
    if (!name) return;
    const { error } = await supabase.from("dongle_module").insert({ dongle_id: dongleId, name });
    if (error) {
      console.error(error);
      setHinweis(error.code === "23505" ? txt.modulExistiertBereits : txt.fehlerModulAnlegen);
      return;
    }
    setNeuesModul((m) => ({ ...m, [dongleId]: "" }));
    ladeModule(dongleId);
  }

  async function modulUmschalten(modulId: string, dongleId: string, aktiv: boolean) {
    setModule((m) => ({
      ...m,
      [dongleId]: (m[dongleId] ?? []).map((mod) => (mod.id === modulId ? { ...mod, aktiv } : mod)),
    }));
    await supabase.from("dongle_module").update({ aktiv }).eq("id", modulId);
  }

  async function modulLoeschen(modulId: string, dongleId: string) {
    await supabase.from("dongle_module").delete().eq("id", modulId);
    ladeModule(dongleId);
  }

  async function vertragVerknuepfen(dongleId: string) {
    const vertragId = verknuepfenAuswahl[dongleId];
    if (!vertragId) return;
    await supabase.from("lizenz_vertraege").update({ dongle_id: dongleId }).eq("id", vertragId);
    setVerknuepfenAuswahl((v) => {
      const kopie = { ...v };
      delete kopie[dongleId];
      return kopie;
    });
    ladeVertraege();
  }

  async function vertragLoesen(vertragId: string) {
    await supabase.from("lizenz_vertraege").update({ dongle_id: null }).eq("id", vertragId);
    ladeVertraege();
  }

  const gefiltert = dongles.filter((d) =>
    d.seriennummer.toLowerCase().includes(filterNummer.trim().toLowerCase()),
  );
  const suchtAktiv = filterNummer.trim() !== "";
  const sichtbareDongles =
    suchtAktiv || alleAnzeigen ? gefiltert : gefiltert.slice(0, ANZAHL_STANDARD_SICHTBAR);
  const vertragJeDongle = new Map(vertraege.filter((v) => v.dongle_id).map((v) => [v.dongle_id!, v]));
  const unverknuepfteVertraege = vertraege.filter((v) => !v.dongle_id);

  return (
    <div className="space-y-2">
      {dongles.length === 0 && !zeigeNeuerDongle && (
        <p className="text-xs text-[var(--text-faint)]">{txt.nochKeineDongles}</p>
      )}

      {dongles.length > ANZAHL_STANDARD_SICHTBAR && (
        <input
          type="text"
          value={filterNummer}
          onChange={(e) => setFilterNummer(e.target.value)}
          placeholder={txt.filterPlatzhalterTemplate.replace("{n}", String(dongles.length))}
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-strong)]"
        />
      )}

      {suchtAktiv && gefiltert.length === 0 && (
        <p className="text-xs text-[var(--text-faint)]">{txt.keineTrefferFilter}</p>
      )}

      {sichtbareDongles.map((d) => {
        const laufzeit = vertragJeDongle.get(d.id);
        const info = laufzeitInfo(laufzeit?.vertrag_ende);
        return (
        <div key={d.id} className="overflow-hidden rounded-lg border border-[var(--border)]">
          <button
            onClick={() => dongleOeffnen(d.id)}
            className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-muted)]"
          >
            <span className="font-mono text-xs text-[var(--text-strong)]">{d.seriennummer}</span>
            <span className="text-xs text-[var(--text-faint)]">· {d.software}</span>
            {laufzeit?.aktuelle_engine_build && (
              <span className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-[0.65rem] text-[var(--text-soft)]">
                {txt.buildLabel} {laufzeit.aktuelle_engine_build}
              </span>
            )}
            {info && laufzeit?.vertrag_ende && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: info.farbe }}>
                <span className="h-1.5 w-10 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${info.prozent}%`, background: info.farbe }}
                  />
                </span>
                {txt.bisPrefix} {new Date(laufzeit.vertrag_ende).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE")}
              </span>
            )}
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${WARTUNG_FARBE[d.wartungsvertrag]}`}>
              {WARTUNG_LABEL[d.wartungsvertrag]}
            </span>
          </button>

          {offenDongleId === d.id && (
            <div className="space-y-3 border-t border-[var(--border)] bg-[var(--bg-surface)] px-3 py-3">
              {d.gruppe && (
                <p className="text-xs text-[var(--text-faint)]">{txt.importHinweis} {d.gruppe}</p>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.wartungsvertragLabel}</label>
                <div className="flex gap-1.5">
                  {(Object.keys(WARTUNG_LABEL) as Wartungsvertrag[]).map((w) => (
                    <button
                      key={w}
                      onClick={() => dongleAktualisieren(d.id, { wartungsvertrag: w })}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        d.wartungsvertrag === w
                          ? "border-[var(--akzent)] bg-akzent/10 text-akzent"
                          : "border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                      }`}
                    >
                      {WARTUNG_LABEL[w]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-[var(--text-soft)]">{txt.freiminutenLabel}</label>
                <input
                  type="number"
                  min={0}
                  value={d.freiminuten_pro_monat}
                  onChange={(e) => dongleAktualisieren(d.id, { freiminuten_pro_monat: Math.max(0, Number(e.target.value)) })}
                  className="w-20 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1 text-sm text-[var(--text-strong)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  {txt.lizenzvertragLabel}
                </label>
                {laufzeit ? (
                  <div className="space-y-2 rounded bg-[var(--bg-muted)] px-2.5 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[var(--text-strong)]">{laufzeit.produkt_name}</span>
                      <span className="font-mono text-xs text-[var(--text-faint)]">{laufzeit.lizenz_seriennummer}</span>
                      {laufzeit.status && <span className="text-xs text-[var(--text-faint)]">· {laufzeit.status}</span>}
                      {laufzeit.aktuelle_engine_build && (
                        <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-faint)]">
                          {txt.buildLabel} {laufzeit.aktuelle_engine_build}
                        </span>
                      )}
                      <button
                        onClick={() => vertragLoesen(laufzeit.id)}
                        className="ml-auto shrink-0 text-xs text-[var(--text-faint)] hover:text-red-600"
                      >
                        {txt.verknuepfungLoesen}
                      </button>
                    </div>
                    {laufzeit.vertrag_ende &&
                      (() => {
                        const info = laufzeitInfo(laufzeit.vertrag_ende);
                        if (!info) return null;
                        return (
                          <div>
                            <div className="mb-1 flex justify-between text-xs text-[var(--text-faint)]">
                              <span>{txt.laufzeit}</span>
                              <span style={{ color: info.farbe }} className="font-medium">
                                {txt.bisPrefix} {new Date(laufzeit.vertrag_ende!).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE")}
                                {info.tage >= 0 ? ` (${info.tage} ${txt.tageSuffix})` : ` ${txt.abgelaufen}`}
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${info.prozent}%`, background: info.farbe }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                  </div>
                ) : unverknuepfteVertraege.length > 0 ? (
                  <div className="flex gap-2">
                    <select
                      value={verknuepfenAuswahl[d.id] ?? ""}
                      onChange={(e) => setVerknuepfenAuswahl((v) => ({ ...v, [d.id]: e.target.value }))}
                      className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2.5 py-1.5 text-sm text-[var(--text-strong)]"
                    >
                      <option value="">{txt.lizenzvertragWaehlen}</option>
                      {unverknuepfteVertraege.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.produkt_name} ({v.lizenz_seriennummer})
                          {v.vertrag_ende ? txt.bisTemplate.replace("{datum}", new Date(v.vertrag_ende).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE")) : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => vertragVerknuepfen(d.id)}
                      disabled={!verknuepfenAuswahl[d.id]}
                      className="shrink-0 rounded bg-akzent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {txt.verknuepfen}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-faint)]">
                    {txt.keineUnverknuepftenVertraege}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  {txt.softwareModuleLabel} <span className="font-normal text-[var(--text-faint)]">{txt.reinInformativ}</span>
                </label>
                {(module[d.id] ?? []).length > 0 && (
                  <div className="mb-2 space-y-1">
                    {(module[d.id] ?? []).map((mod) => (
                      <label
                        key={mod.id}
                        className="flex items-center gap-2 rounded bg-[var(--bg-muted)] px-2.5 py-1.5"
                      >
                        <input
                          type="checkbox"
                          checked={mod.aktiv}
                          onChange={(e) => modulUmschalten(mod.id, d.id, e.target.checked)}
                          className="accent-akzent"
                        />
                        <span className={`flex-1 text-sm ${mod.aktiv ? "text-[var(--text-strong)]" : "text-[var(--text-faint)] line-through"}`}>
                          {mod.name}
                        </span>
                        <button
                          onClick={() => modulLoeschen(mod.id, d.id)}
                          className="shrink-0 text-xs text-[var(--text-faint)] hover:text-red-600"
                        >
                          {txt.entfernen}
                        </button>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={neuesModul[d.id] ?? ""}
                    onChange={(e) => setNeuesModul((m) => ({ ...m, [d.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && modulHinzufuegen(d.id)}
                    placeholder={txt.neuesModulPlatzhalter}
                    className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2.5 py-1.5 text-sm text-[var(--text-strong)]"
                  />
                  <button
                    onClick={() => modulHinzufuegen(d.id)}
                    className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={() => dongleLoeschen(d.id, d.seriennummer)}
                className="text-xs text-[var(--text-faint)] hover:text-red-600"
              >
                {txt.dongleLoeschen}
              </button>
            </div>
          )}
        </div>
        );
      })}

      {!suchtAktiv && gefiltert.length > ANZAHL_STANDARD_SICHTBAR && (
        <button
          onClick={() => setAlleAnzeigen((v) => !v)}
          className="w-full rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
        >
          {alleAnzeigen ? txt.wenigerAnzeigen : txt.alleAnzeigenTemplate.replace("{n}", String(gefiltert.length))}
        </button>
      )}

      {zeigeNeuerDongle ? (
        <div className="space-y-2 rounded-lg border border-dashed border-[var(--border-input)] p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={neueSeriennummer}
              onChange={(e) => setNeueSeriennummer(e.target.value)}
              placeholder={txt.seriennummerPlatzhalter}
              className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-sm text-[var(--text-strong)]"
            />
            <input
              type="text"
              value={neueSoftware}
              onChange={(e) => setNeueSoftware(e.target.value)}
              placeholder={txt.softwarePlatzhalter}
              className="w-28 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-sm text-[var(--text-strong)]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={dongleAnlegen}
              className="flex-1 rounded bg-akzent px-3 py-1.5 text-sm font-medium text-white"
            >
              {txt.anlegen}
            </button>
            <button
              onClick={() => {
                setZeigeNeuerDongle(false);
                setNeueSeriennummer("");
              }}
              className="rounded border border-[var(--border-input)] px-3 py-1.5 text-sm text-[var(--text-soft)]"
            >
              {txt.abbrechen}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setZeigeNeuerDongle(true)}
          className="w-full rounded border border-dashed border-[var(--border-input)] px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
        >
          {txt.dongleHinzufuegen}
        </button>
      )}

      {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}
    </div>
  );
}
