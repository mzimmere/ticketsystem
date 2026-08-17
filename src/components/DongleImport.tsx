import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { parseCsv } from "../lib/csv";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import DateiAuswahl from "./DateiAuswahl";

type ImportZiel = "dongle" | "lizenz";

interface Feld {
  schluessel: string;
  label: string;
  pflicht: boolean;
}

// Ziel 1: exocad "activation_keys"-Export -> Dongles/Module (Phase 1).
// Ein Modul (= eine Zeile) je Seriennummer, gruppiert nach Seriennummer.
function felderDongle(txt: ReturnType<typeof texte>["dongleImport"]): Feld[] {
  return [
    { schluessel: "seriennummer", label: txt.feldSeriennummerDongle, pflicht: true },
    { schluessel: "modulname", label: txt.feldModulname, pflicht: true },
    { schluessel: "lieferdatum", label: txt.feldLieferdatum, pflicht: false },
    { schluessel: "activation_key", label: txt.feldActivationKey, pflicht: false },
    { schluessel: "article_number", label: txt.feldArtikelnummer, pflicht: false },
    { schluessel: "gruppe", label: txt.feldGruppenhinweis, pflicht: false },
  ];
}
const ALIASE_DONGLE: Record<string, string[]> = {
  seriennummer: ["serialnumber", "serial_number", "seriennummer", "serial"],
  modulname: ["name", "module", "modulename", "module_name"],
  lieferdatum: ["deliverydate", "delivery_date", "lieferdatum"],
  activation_key: ["activation_key", "activationkey"],
  article_number: ["articlenumber", "article_number"],
  gruppe: ["group_name", "groupname", "gruppe"],
};

// Ziel 2: exocad "license_history"-Export -> Lizenzvertraege (Phase 3).
// Eigenstaendiger Identifikator, ueberschneidet sich NICHT mit den
// Dongle-Seriennummern aus Ziel 1. Eine Zeile = ein Lizenzvertrag.
function felderLizenz(txt: ReturnType<typeof texte>["dongleImport"]): Feld[] {
  return [
    { schluessel: "seriennummer", label: txt.feldSeriennummerLizenz, pflicht: true },
    { schluessel: "produkt_name", label: txt.feldProduktname, pflicht: true },
    { schluessel: "lizenz_typ", label: txt.feldLizenztyp, pflicht: false },
    { schluessel: "vertrag_start", label: txt.feldVertragsbeginn, pflicht: false },
    { schluessel: "vertrag_ende", label: txt.feldVertragsende, pflicht: false },
    { schluessel: "aktiviert_am", label: txt.feldAktiviertAm, pflicht: false },
    { schluessel: "status", label: txt.feldStatus, pflicht: false },
    { schluessel: "frei_zeitraum_ende", label: txt.feldFreierZeitraumBis, pflicht: false },
    { schluessel: "lizenz_attribut", label: txt.feldLizenzAttribut, pflicht: false },
    { schluessel: "aktuelle_engine_build", label: txt.feldAktuelleBuild, pflicht: false },
    { schluessel: "max_erlaubte_engine_build", label: txt.feldMaxErlaubteBuild, pflicht: false },
  ];
}
const ALIASE_LIZENZ: Record<string, string[]> = {
  seriennummer: ["serialnumber", "serial_number", "seriennummer", "serial"],
  produkt_name: ["productname", "product_name"],
  lizenz_typ: ["licensetype", "license_type"],
  vertrag_start: ["contractstartdate", "contract_start_date"],
  vertrag_ende: ["contractenddate", "contract_end_date"],
  aktiviert_am: ["activatedat", "activated_at"],
  status: ["status"],
  frei_zeitraum_ende: ["freeperiodenddate", "free_period_end_date"],
  lizenz_attribut: ["licenseattribute", "license_attribute"],
  aktuelle_engine_build: ["currusedenginebuild", "curr_used_engine_build"],
  max_erlaubte_engine_build: ["maxallowedenginebuild", "max_allowed_engine_build"],
};

function erkenneZiel(header: string[]): ImportZiel {
  const h = header.map((s) => s.toLowerCase());
  const hatProduktname = h.some((s) => ["productname", "product_name"].includes(s));
  const hatVertragsende = h.some((s) => ["contractenddate", "contract_end_date"].includes(s));
  return hatProduktname && hatVertragsende ? "lizenz" : "dongle";
}

interface VorschauDongle {
  ziel: "dongle";
  gesamtZeilen: number;
  uebersprungen: number;
  neueDongles: number;
  bestehendeDongles: number;
  gruppiert: Map<
    string,
    {
      gruppe: string | null;
      minLieferdatum: string | null;
      module: { modulname: string; lieferdatum: string | null; activationKey: string | null; articleNumber: string | null }[];
    }
  >;
  existierendeSerials: Set<string>;
}

interface VorschauLizenzZeile {
  produktName: string;
  lizenzTyp: string | null;
  vertragStart: string | null;
  vertragEnde: string | null;
  aktiviertAm: string | null;
  status: string | null;
  freiZeitraumEnde: string | null;
  lizenzAttribut: string | null;
  aktuelleBuild: string | null;
  maxErlaubteBuild: string | null;
}

interface VorschauLizenz {
  ziel: "lizenz";
  gesamtZeilen: number;
  uebersprungen: number;
  neueVertraege: number;
  bestehendeVertraege: number;
  zeilen: Map<string, VorschauLizenzZeile>;
  existierendeSerials: Set<string>;
}

type Vorschau = VorschauDongle | VorschauLizenz;

type Ergebnis =
  | { ziel: "dongle"; neueDongles: number; bestehendeDongles: number; module: number }
  | { ziel: "lizenz"; neueVertraege: number; aktualisierteVertraege: number };

interface DongleImportProps {
  organisationId: string;
  onImportiert: () => void;
}

function inChunks<T>(liste: T[], groesse: number): T[][] {
  const ergebnis: T[][] = [];
  for (let i = 0; i < liste.length; i += groesse) ergebnis.push(liste.slice(i, i + groesse));
  return ergebnis;
}

export default function DongleImport({ organisationId, onImportiert }: DongleImportProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).dongleImport;
  const [offen, setOffen] = useState(false);
  const [datei, setDatei] = useState<File | null>(null);
  const [header, setHeader] = useState<string[]>([]);
  const [zeilen, setZeilen] = useState<string[][]>([]);
  const [ziel, setZiel] = useState<ImportZiel>("dongle");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);

  const felder = ziel === "lizenz" ? felderLizenz(txt) : felderDongle(txt);

  function zuruecksetzen() {
    setDatei(null);
    setHeader([]);
    setZeilen([]);
    setVorschau(null);
    setErgebnis(null);
    setFehler(null);
  }

  async function dateiVerarbeiten(dateien: File[]) {
    zuruecksetzen();
    const f = dateien[0];
    if (!f) return;
    setDatei(f);
    const text = await f.text();
    const { header: h, zeilen: z } = parseCsv(text);
    if (h.length === 0) {
      setFehler(txt.dateiLeerFehler);
      return;
    }
    setHeader(h);
    setZeilen(z);

    const erkanntesZiel = erkenneZiel(h);
    setZiel(erkanntesZiel);

    // Auto-Erkennung anhand gaengiger Spaltennamen
    const zielAliase = erkanntesZiel === "lizenz" ? ALIASE_LIZENZ : ALIASE_DONGLE;
    const zielFelder = erkanntesZiel === "lizenz" ? felderLizenz(txt) : felderDongle(txt);
    const neuesMapping: Record<string, string> = {};
    for (const feld of zielFelder) {
      const treffer = h.find((spalte) => zielAliase[feld.schluessel].includes(spalte.toLowerCase()));
      neuesMapping[feld.schluessel] = treffer ?? "";
    }
    setMapping(neuesMapping);
  }

  function spaltenIndex(spaltenname: string): number {
    return header.indexOf(spaltenname);
  }

  async function vorschauBerechnen() {
    setFehler(null);
    const fehlendeFelder = felder.filter((f) => f.pflicht && !mapping[f.schluessel]);
    if (fehlendeFelder.length > 0) {
      setFehler(txt.spalteZuordnenFehlerTemplate.replace("{label}", fehlendeFelder[0].label));
      return;
    }
    setLaedt(true);

    if (ziel === "lizenz") {
      await vorschauLizenzBerechnen();
    } else {
      await vorschauDongleBerechnen();
    }
    setLaedt(false);
  }

  async function vorschauDongleBerechnen() {
    const idxSerial = spaltenIndex(mapping.seriennummer);
    const idxName = spaltenIndex(mapping.modulname);
    const idxDatum = mapping.lieferdatum ? spaltenIndex(mapping.lieferdatum) : -1;
    const idxKey = mapping.activation_key ? spaltenIndex(mapping.activation_key) : -1;
    const idxArt = mapping.article_number ? spaltenIndex(mapping.article_number) : -1;
    const idxGruppe = mapping.gruppe ? spaltenIndex(mapping.gruppe) : -1;

    const gruppiert: VorschauDongle["gruppiert"] = new Map();
    let uebersprungen = 0;

    for (const z of zeilen) {
      const seriennummer = z[idxSerial]?.trim();
      const modulname = z[idxName]?.trim();
      if (!seriennummer || !modulname) {
        uebersprungen++;
        continue;
      }
      const lieferdatum = idxDatum >= 0 ? z[idxDatum]?.trim() || null : null;
      const activationKey = idxKey >= 0 ? z[idxKey]?.trim() || null : null;
      const articleNumber = idxArt >= 0 ? z[idxArt]?.trim() || null : null;
      const gruppe = idxGruppe >= 0 ? z[idxGruppe]?.trim() || null : null;

      if (!gruppiert.has(seriennummer)) {
        gruppiert.set(seriennummer, { gruppe, minLieferdatum: lieferdatum, module: [] });
      }
      const eintrag = gruppiert.get(seriennummer)!;
      if (lieferdatum && (!eintrag.minLieferdatum || lieferdatum < eintrag.minLieferdatum)) {
        eintrag.minLieferdatum = lieferdatum;
      }
      eintrag.module.push({ modulname, lieferdatum, activationKey, articleNumber });
    }

    const alleSerials = Array.from(gruppiert.keys());
    const existierendeSerials = new Set<string>();
    for (const chunk of inChunks(alleSerials, 500)) {
      const { data } = await supabase
        .from("kunden_dongles")
        .select("seriennummer")
        .eq("organisation_id", organisationId)
        .in("seriennummer", chunk);
      (data ?? []).forEach((d) => existierendeSerials.add(d.seriennummer));
    }

    setVorschau({
      ziel: "dongle",
      gesamtZeilen: zeilen.length,
      uebersprungen,
      neueDongles: alleSerials.filter((s) => !existierendeSerials.has(s)).length,
      bestehendeDongles: existierendeSerials.size,
      gruppiert,
      existierendeSerials,
    });
  }

  async function vorschauLizenzBerechnen() {
    const idxSerial = spaltenIndex(mapping.seriennummer);
    const idxProdukt = spaltenIndex(mapping.produkt_name);
    const idxTyp = mapping.lizenz_typ ? spaltenIndex(mapping.lizenz_typ) : -1;
    const idxStart = mapping.vertrag_start ? spaltenIndex(mapping.vertrag_start) : -1;
    const idxEnde = mapping.vertrag_ende ? spaltenIndex(mapping.vertrag_ende) : -1;
    const idxAktiviert = mapping.aktiviert_am ? spaltenIndex(mapping.aktiviert_am) : -1;
    const idxStatus = mapping.status ? spaltenIndex(mapping.status) : -1;
    const idxFreiEnde = mapping.frei_zeitraum_ende ? spaltenIndex(mapping.frei_zeitraum_ende) : -1;
    const idxAttribut = mapping.lizenz_attribut ? spaltenIndex(mapping.lizenz_attribut) : -1;
    const idxBuild = mapping.aktuelle_engine_build ? spaltenIndex(mapping.aktuelle_engine_build) : -1;
    const idxMaxBuild = mapping.max_erlaubte_engine_build ? spaltenIndex(mapping.max_erlaubte_engine_build) : -1;

    const zeilenKarte = new Map<string, VorschauLizenzZeile>();
    let uebersprungen = 0;

    for (const z of zeilen) {
      const seriennummer = z[idxSerial]?.trim();
      const produktName = z[idxProdukt]?.trim();
      if (!seriennummer || !produktName) {
        uebersprungen++;
        continue;
      }
      zeilenKarte.set(seriennummer, {
        produktName,
        lizenzTyp: idxTyp >= 0 ? z[idxTyp]?.trim() || null : null,
        vertragStart: idxStart >= 0 ? z[idxStart]?.trim() || null : null,
        vertragEnde: idxEnde >= 0 ? z[idxEnde]?.trim() || null : null,
        aktiviertAm: idxAktiviert >= 0 ? z[idxAktiviert]?.trim() || null : null,
        status: idxStatus >= 0 ? z[idxStatus]?.trim() || null : null,
        freiZeitraumEnde: idxFreiEnde >= 0 ? z[idxFreiEnde]?.trim() || null : null,
        lizenzAttribut: idxAttribut >= 0 ? z[idxAttribut]?.trim() || null : null,
        aktuelleBuild: idxBuild >= 0 ? z[idxBuild]?.trim() || null : null,
        maxErlaubteBuild: idxMaxBuild >= 0 ? z[idxMaxBuild]?.trim() || null : null,
      });
    }

    const alleSerials = Array.from(zeilenKarte.keys());
    const existierendeSerials = new Set<string>();
    for (const chunk of inChunks(alleSerials, 500)) {
      const { data } = await supabase
        .from("lizenz_vertraege")
        .select("lizenz_seriennummer")
        .eq("organisation_id", organisationId)
        .in("lizenz_seriennummer", chunk);
      (data ?? []).forEach((d) => existierendeSerials.add(d.lizenz_seriennummer));
    }

    setVorschau({
      ziel: "lizenz",
      gesamtZeilen: zeilen.length,
      uebersprungen,
      neueVertraege: alleSerials.filter((s) => !existierendeSerials.has(s)).length,
      bestehendeVertraege: existierendeSerials.size,
      zeilen: zeilenKarte,
      existierendeSerials,
    });
  }

  async function importieren() {
    if (!vorschau) return;
    setLaedt(true);
    setFehler(null);
    try {
      if (vorschau.ziel === "lizenz") {
        await lizenzImportieren(vorschau);
      } else {
        await dongleImportieren(vorschau);
      }
      setVorschau(null);
      onImportiert();
    } catch (err) {
      console.error(err);
      setFehler(txt.importFehlgeschlagen);
    } finally {
      setLaedt(false);
    }
  }

  async function dongleImportieren(vorschau: VorschauDongle) {
    const neueDongleRows = Array.from(vorschau.gruppiert.entries())
      .filter(([serial]) => !vorschau.existierendeSerials.has(serial))
      .map(([serial, info]) => ({
        organisation_id: organisationId,
        kunde_id: null,
        seriennummer: serial,
        software: "exocad",
        gruppe: info.gruppe,
        liefer_datum: info.minLieferdatum,
      }));

    for (const chunk of inChunks(neueDongleRows, 500)) {
      if (chunk.length === 0) continue;
      // ignoreDuplicates statt normalem upsert: bestehende Dongles (z.B.
      // schon einem Kunden zugeordnet, mit eigenem Wartungsvertrag/
      // Freiminuten) werden beim erneuten Import NICHT ueberschrieben.
      const { error } = await supabase
        .from("kunden_dongles")
        .upsert(chunk, { onConflict: "organisation_id,seriennummer", ignoreDuplicates: true });
      if (error) throw error;
    }

    // Alle betroffenen Dongle-IDs (neu + bestehend) nachladen, um Module zuzuordnen
    const alleSerials = Array.from(vorschau.gruppiert.keys());
    const serialZuId = new Map<string, string>();
    for (const chunk of inChunks(alleSerials, 500)) {
      const { data } = await supabase
        .from("kunden_dongles")
        .select("id, seriennummer")
        .eq("organisation_id", organisationId)
        .in("seriennummer", chunk);
      (data ?? []).forEach((d) => serialZuId.set(d.seriennummer, d.id));
    }

    const modulRows: { dongle_id: string; name: string; aktiv: boolean; activation_key: string | null; article_number: string | null; liefer_datum: string | null }[] = [];
    for (const [serial, info] of vorschau.gruppiert.entries()) {
      const dongleId = serialZuId.get(serial);
      if (!dongleId) continue;
      for (const m of info.module) {
        modulRows.push({
          dongle_id: dongleId,
          name: m.modulname,
          aktiv: true,
          activation_key: m.activationKey,
          article_number: m.articleNumber,
          liefer_datum: m.lieferdatum,
        });
      }
    }

    let moduleVerarbeitet = 0;
    for (const chunk of inChunks(modulRows, 500)) {
      if (chunk.length === 0) continue;
      const { error } = await supabase
        .from("dongle_module")
        .upsert(chunk, { onConflict: "dongle_id,name" });
      if (error) throw error;
      moduleVerarbeitet += chunk.length;
    }

    setErgebnis({
      ziel: "dongle",
      neueDongles: vorschau.neueDongles,
      bestehendeDongles: vorschau.bestehendeDongles,
      module: moduleVerarbeitet,
    });
  }

  async function lizenzImportieren(vorschau: VorschauLizenz) {
    const rows = Array.from(vorschau.zeilen.entries()).map(([serial, z]) => ({
      organisation_id: organisationId,
      lizenz_seriennummer: serial,
      produkt_name: z.produktName,
      lizenz_typ: z.lizenzTyp,
      vertrag_start: z.vertragStart,
      vertrag_ende: z.vertragEnde,
      aktiviert_am: z.aktiviertAm,
      status: z.status,
      frei_zeitraum_ende: z.freiZeitraumEnde,
      lizenz_attribut: z.lizenzAttribut,
      aktuelle_engine_build: z.aktuelleBuild,
      max_erlaubte_engine_build: z.maxErlaubteBuild,
    }));

    // Normaler Upsert (kein ignoreDuplicates): Vertragsdaten (Ablaufdatum,
    // Status, ...) sollen beim erneuten Import aktualisiert werden. kunde_id,
    // dongle_id und erinnerung_gesendet_am werden bewusst NICHT mitgeschickt,
    // damit eine bereits erfolgte manuelle Zuordnung bzw. eine schon
    // versendete Erinnerung dabei nicht ueberschrieben wird.
    for (const chunk of inChunks(rows, 500)) {
      if (chunk.length === 0) continue;
      const { error } = await supabase
        .from("lizenz_vertraege")
        .upsert(chunk, { onConflict: "organisation_id,lizenz_seriennummer" });
      if (error) throw error;
    }

    setErgebnis({
      ziel: "lizenz",
      neueVertraege: vorschau.neueVertraege,
      aktualisierteVertraege: vorschau.bestehendeVertraege,
    });
  }

  if (!offen) {
    return (
      <button
        onClick={() => setOffen(true)}
        className="w-full rounded border border-dashed border-[var(--border-input)] px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
      >
        {txt.oeffnenButton}
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--text-strong)]">{txt.titel}</p>
        <button
          onClick={() => {
            setOffen(false);
            zuruecksetzen();
          }}
          className="text-xs text-[var(--text-faint)] hover:text-[var(--text-soft)]"
        >
          {txt.schliessen}
        </button>
      </div>

      {ergebnis ? (
        <div className="space-y-2">
          {ergebnis.ziel === "dongle" ? (
            <p className="text-sm text-[var(--text-strong)]">
              {txt.ergebnisDongleTemplate
                .replace("{neu}", String(ergebnis.neueDongles))
                .replace("{bestehend}", String(ergebnis.bestehendeDongles))
                .replace("{module}", String(ergebnis.module))}
            </p>
          ) : (
            <p className="text-sm text-[var(--text-strong)]">
              {txt.ergebnisLizenzTemplate
                .replace("{neu}", String(ergebnis.neueVertraege))
                .replace("{aktualisiert}", String(ergebnis.aktualisierteVertraege))}
            </p>
          )}
          <button
            onClick={() => {
              zuruecksetzen();
            }}
            className="text-xs text-akzent hover:underline"
          >
            {txt.weitereDateiImportieren}
          </button>
        </div>
      ) : (
        <>
          {!datei && (
            <DateiAuswahl
              dateien={[]}
              onAendern={dateiVerarbeiten}
              mehrfach={false}
              label={txt.dateiAuswaehlenLabel}
            />
          )}

          {datei && header.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-faint)]">
                {txt.dateiInfoTemplate.replace("{dateiname}", datei.name).replace("{n}", String(zeilen.length))}{" "}
                {ziel === "lizenz" ? txt.erkanntAlsLizenz : txt.erkanntAlsDongle}
              </p>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                  {txt.spaltenZuordnen}
                </p>
                {felder.map((feld) => (
                  <div key={feld.schluessel} className="flex items-center gap-2">
                    <label className="w-40 shrink-0 text-xs text-[var(--text-soft)]">
                      {feld.label}
                      {feld.pflicht && <span className="text-red-600"> *</span>}
                    </label>
                    <select
                      value={mapping[feld.schluessel] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [feld.schluessel]: e.target.value }))}
                      className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-sm text-[var(--text-strong)]"
                    >
                      <option value="">{txt.nichtZuordnen}</option>
                      {header.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {!vorschau ? (
                <button
                  onClick={vorschauBerechnen}
                  disabled={laedt}
                  className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {laedt ? txt.prueft : txt.vorschauBerechnen}
                </button>
              ) : (
                <div className="space-y-2 rounded-lg bg-[var(--bg-muted)] p-3">
                  {vorschau.ziel === "dongle" ? (
                    <>
                      <p className="text-sm text-[var(--text-strong)]">
                        {txt.vorschauDongleTemplate
                          .replace("{n}", String(vorschau.gruppiert.size))
                          .replace("{neu}", String(vorschau.neueDongles))
                          .replace("{bestehend}", String(vorschau.bestehendeDongles))
                          .replace("{module}", String(vorschau.gesamtZeilen - vorschau.uebersprungen))}
                      </p>
                      <p className="text-xs text-[var(--text-faint)]">
                        {txt.vorschauDongleHinweis}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-[var(--text-strong)]">
                        {txt.vorschauLizenzTemplate
                          .replace("{n}", String(vorschau.zeilen.size))
                          .replace("{neu}", String(vorschau.neueVertraege))
                          .replace("{bestehend}", String(vorschau.bestehendeVertraege))}
                      </p>
                      <p className="text-xs text-[var(--text-faint)]">
                        {txt.vorschauLizenzHinweis}
                      </p>
                    </>
                  )}
                  {vorschau.uebersprungen > 0 && (
                    <p className="text-xs text-[var(--text-faint)]">
                      {txt.uebersprungenTemplate.replace("{n}", String(vorschau.uebersprungen))}
                    </p>
                  )}
                  <button
                    onClick={importieren}
                    disabled={laedt}
                    className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {laedt ? txt.importiert : txt.jetztImportieren}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {fehler && <p className="text-xs text-red-600">{fehler}</p>}
    </div>
  );
}
