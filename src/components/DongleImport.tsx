import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { parseCsv } from "../lib/csv";
import DateiAuswahl from "./DateiAuswahl";

// Zielfelder fuer den Import + gaengige Spaltennamen aus Portal-Exporten
// (aktuell exocad "activation_keys"-Export), fuer die automatische
// Spalten-Erkennung. Das Mapping bleibt in der UI trotzdem frei anpassbar,
// falls ein anderes Portal andere Spaltennamen liefert.
const ZIELFELD_LABEL = {
  seriennummer: "Seriennummer (Dongle)",
  modulname: "Modulname",
  lieferdatum: "Lieferdatum",
  activation_key: "Activation Key",
  article_number: "Artikelnummer",
  gruppe: "Kunden-/Gruppenhinweis",
} as const;

type Zielfeld = keyof typeof ZIELFELD_LABEL;

const ALIASE: Record<Zielfeld, string[]> = {
  seriennummer: ["serialnumber", "serial_number", "seriennummer", "serial"],
  modulname: ["name", "module", "modulename", "module_name"],
  lieferdatum: ["deliverydate", "delivery_date", "lieferdatum"],
  activation_key: ["activation_key", "activationkey"],
  article_number: ["articlenumber", "article_number"],
  gruppe: ["group_name", "groupname", "gruppe"],
};

const PFLICHTFELDER: Zielfeld[] = ["seriennummer", "modulname"];

interface Vorschau {
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
  const [offen, setOffen] = useState(false);
  const [datei, setDatei] = useState<File | null>(null);
  const [header, setHeader] = useState<string[]>([]);
  const [zeilen, setZeilen] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<Zielfeld, string>>({
    seriennummer: "",
    modulname: "",
    lieferdatum: "",
    activation_key: "",
    article_number: "",
    gruppe: "",
  });
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<{ neueDongles: number; bestehendeDongles: number; module: number } | null>(null);

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
      setFehler("Datei konnte nicht gelesen werden oder ist leer.");
      return;
    }
    setHeader(h);
    setZeilen(z);

    // Auto-Erkennung anhand gaengiger Spaltennamen
    const neuesMapping = { ...mapping };
    for (const ziel of Object.keys(ZIELFELD_LABEL) as Zielfeld[]) {
      const treffer = h.find((spalte) => ALIASE[ziel].includes(spalte.toLowerCase()));
      neuesMapping[ziel] = treffer ?? "";
    }
    setMapping(neuesMapping);
  }

  function spaltenIndex(spaltenname: string): number {
    return header.indexOf(spaltenname);
  }

  async function vorschauBerechnen() {
    setFehler(null);
    const fehlt = PFLICHTFELDER.filter((f) => !mapping[f]);
    if (fehlt.length > 0) {
      setFehler(`Bitte Spalte für "${ZIELFELD_LABEL[fehlt[0]]}" zuordnen.`);
      return;
    }
    setLaedt(true);

    const idxSerial = spaltenIndex(mapping.seriennummer);
    const idxName = spaltenIndex(mapping.modulname);
    const idxDatum = mapping.lieferdatum ? spaltenIndex(mapping.lieferdatum) : -1;
    const idxKey = mapping.activation_key ? spaltenIndex(mapping.activation_key) : -1;
    const idxArt = mapping.article_number ? spaltenIndex(mapping.article_number) : -1;
    const idxGruppe = mapping.gruppe ? spaltenIndex(mapping.gruppe) : -1;

    const gruppiert: Vorschau["gruppiert"] = new Map();
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
      gesamtZeilen: zeilen.length,
      uebersprungen,
      neueDongles: alleSerials.filter((s) => !existierendeSerials.has(s)).length,
      bestehendeDongles: existierendeSerials.size,
      gruppiert,
      existierendeSerials,
    });
    setLaedt(false);
  }

  async function importieren() {
    if (!vorschau) return;
    setLaedt(true);
    setFehler(null);
    try {
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
        neueDongles: vorschau.neueDongles,
        bestehendeDongles: vorschau.bestehendeDongles,
        module: moduleVerarbeitet,
      });
      setVorschau(null);
      onImportiert();
    } catch (err) {
      console.error(err);
      setFehler("Import fehlgeschlagen (Details in der Browser-Konsole).");
    } finally {
      setLaedt(false);
    }
  }

  if (!offen) {
    return (
      <button
        onClick={() => setOffen(true)}
        className="w-full rounded border border-dashed border-[var(--border-input)] px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
      >
        Dongles/Module aus Portal-Export importieren
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--text-strong)]">Dongles/Module importieren</p>
        <button
          onClick={() => {
            setOffen(false);
            zuruecksetzen();
          }}
          className="text-xs text-[var(--text-faint)] hover:text-[var(--text-soft)]"
        >
          Schließen
        </button>
      </div>

      {ergebnis ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-strong)]">
            ✓ Import abgeschlossen: {ergebnis.neueDongles} neue Dongles angelegt (im Pool
            „Nicht zugeordnet"), {ergebnis.bestehendeDongles} bestehende Dongles unverändert,{" "}
            {ergebnis.module} Module verarbeitet.
          </p>
          <button
            onClick={() => {
              zuruecksetzen();
            }}
            className="text-xs text-akzent hover:underline"
          >
            Weitere Datei importieren
          </button>
        </div>
      ) : (
        <>
          {!datei && (
            <DateiAuswahl
              dateien={[]}
              onAendern={dateiVerarbeiten}
              mehrfach={false}
              label="CSV-Datei auswählen"
            />
          )}

          {datei && header.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-faint)]">
                {datei.name} · {zeilen.length} Zeilen erkannt
              </p>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                  Spalten zuordnen
                </p>
                {(Object.keys(ZIELFELD_LABEL) as Zielfeld[]).map((ziel) => (
                  <div key={ziel} className="flex items-center gap-2">
                    <label className="w-40 shrink-0 text-xs text-[var(--text-soft)]">
                      {ZIELFELD_LABEL[ziel]}
                      {PFLICHTFELDER.includes(ziel) && <span className="text-red-600"> *</span>}
                    </label>
                    <select
                      value={mapping[ziel]}
                      onChange={(e) => setMapping((m) => ({ ...m, [ziel]: e.target.value }))}
                      className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-sm text-[var(--text-strong)]"
                    >
                      <option value="">— nicht zuordnen —</option>
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
                  {laedt ? "Prüft…" : "Vorschau berechnen"}
                </button>
              ) : (
                <div className="space-y-2 rounded-lg bg-[var(--bg-muted)] p-3">
                  <p className="text-sm text-[var(--text-strong)]">
                    {vorschau.gruppiert.size} Dongles ({vorschau.neueDongles} neu,{" "}
                    {vorschau.bestehendeDongles} bestehend), {vorschau.gesamtZeilen - vorschau.uebersprungen}{" "}
                    Modul-Zeilen werden verarbeitet.
                  </p>
                  {vorschau.uebersprungen > 0 && (
                    <p className="text-xs text-[var(--text-faint)]">
                      {vorschau.uebersprungen} Zeilen übersprungen (Seriennummer oder Modulname fehlt).
                    </p>
                  )}
                  <p className="text-xs text-[var(--text-faint)]">
                    Neue Dongles landen zunächst unzugeordnet und müssen einem Kunden zugewiesen werden.
                    Bestehende Dongles (Wartungsvertrag, Freiminuten) bleiben unverändert.
                  </p>
                  <button
                    onClick={importieren}
                    disabled={laedt}
                    className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {laedt ? "Importiert…" : "Jetzt importieren"}
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
