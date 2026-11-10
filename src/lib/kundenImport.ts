import type { CellValue } from "exceljs";
import { supabase } from "./supabaseClient";
import { alleKundenLaden } from "./alleKundenLaden";
import { LAENDER_LISTE } from "./laender";
import { texte } from "./uebersetzungen";
import type { ExportKunde, KundenExportTexte } from "./kundenExport";

export type KundenImportTexte = ReturnType<typeof texte>["kundenImport"];

export interface Aenderung {
  feld: string;
  alt: string;
  neu: string;
}

export interface ImportZeile {
  zeile: number; // Zeilennummer in Excel
  kundeId: string | null;
  anzeigeName: string;
  aenderungen: Aenderung[];
  update: Record<string, string | number | boolean | null>;
  fehler: string[];
}

// Fehler mit bereits uebersetzter, fuer Nutzer gedachter Meldung.
export class ImportFehler extends Error {}

type SpaltenKey =
  | "id" | "emailLogin" | "firma" | "vorname" | "nachname" | "telefon" | "strasse" | "hausnummer"
  | "plz" | "ort" | "land" | "mwst" | "ustId" | "wartungsvertrag" | "subreseller" | "status" | "notizen";

const SPALTEN: SpaltenKey[] = [
  "id", "emailLogin", "firma", "vorname", "nachname", "telefon", "strasse", "hausnummer",
  "plz", "ort", "land", "mwst", "ustId", "wartungsvertrag", "subreseller", "status", "notizen",
];

// Einfache Textfelder: Spalte in Excel -> Spalte in profiles.
const TEXTFELDER: { key: SpaltenKey; spalte: keyof ExportKunde & string }[] = [
  { key: "firma", spalte: "firmenname" },
  { key: "vorname", spalte: "vorname" },
  { key: "nachname", spalte: "nachname" },
  { key: "telefon", spalte: "telefonnummer" },
  { key: "strasse", spalte: "strasse" },
  { key: "hausnummer", spalte: "hausnummer" },
  { key: "plz", spalte: "plz" },
  { key: "ort", spalte: "ort" },
  { key: "ustId", spalte: "ust_id" },
  { key: "notizen", spalte: "notizen" },
];

const norm = (s: string) => s.trim().toLowerCase();

function zellText(v: CellValue | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.replace(/\r\n/g, "\n").trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText)) return zellText((o.richText as { text: string }[]).map((t) => t.text).join("") as CellValue);
    if ("result" in o) return zellText(o.result as CellValue);
    if (typeof o.text === "string") return o.text.trim();
  }
  return "";
}

// Spaltenueberschriften in Deutsch und Englisch erkennen, damit eine Datei auch
// nach einem Sprachwechsel noch eingelesen werden kann.
function kopfZuordnung(): Map<string, SpaltenKey> {
  const map = new Map<string, SpaltenKey>();
  for (const sprache of ["de", "en"] as const) {
    const t = texte(sprache).kundenExport;
    for (const key of SPALTEN) map.set(norm(t[key]), key);
  }
  return map;
}

function kundenName(k: ExportKunde): string {
  const n = k.name?.trim() || k.firmenname?.trim() || "?";
  return k.firmenname && k.name && k.firmenname !== k.name ? `${n} (${k.firmenname})` : n;
}

export async function kundenImportPruefen(opts: {
  organisationId: string;
  datei: File;
  exportTxt: KundenExportTexte;
  txt: KundenImportTexte;
}): Promise<ImportZeile[]> {
  const { organisationId, datei, exportTxt, txt } = opts;

  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  try {
    await wb.xlsx.load(await datei.arrayBuffer());
  } catch {
    throw new ImportFehler(txt.fehlerLesen);
  }

  const zuordnung = kopfZuordnung();
  let ws: (typeof wb.worksheets)[number] | null = null;
  let spalten = new Map<SpaltenKey, number>();
  for (const blatt of wb.worksheets) {
    const gefunden = new Map<SpaltenKey, number>();
    blatt.getRow(1).eachCell((zelle, nr) => {
      const key = zuordnung.get(norm(zellText(zelle.value)));
      if (key && !gefunden.has(key)) gefunden.set(key, nr);
    });
    if (gefunden.has("id") || gefunden.has("emailLogin")) {
      ws = blatt;
      spalten = gefunden;
      break;
    }
  }
  if (!ws) {
    const hatKundenBlatt = wb.worksheets.some((b) => [texte("de").kundenExport.blattKunden, texte("en").kundenExport.blattKunden].includes(b.name));
    throw new ImportFehler(hatKundenBlatt ? txt.fehlerKeineZuordnung : txt.fehlerKeinBlatt);
  }
  const blatt = ws;

  let kunden: ExportKunde[];
  let stufen: { id: string; name: string }[];
  let subreseller: { id: string; name: string }[];
  let loginMails: { kunde_id: string; email: string }[];
  try {
    const [k, s, r, m] = await Promise.all([
      alleKundenLaden(organisationId, true),
      supabase.from("wartungsvertrag_stufen").select("id, name").eq("organisation_id", organisationId),
      supabase.from("subreseller").select("id, name").eq("organisation_id", organisationId),
      supabase.rpc("kunden_emails_export", { p_organisation_id: organisationId }),
    ]);
    if (s.error || r.error) throw s.error ?? r.error;
    kunden = k;
    stufen = (s.data as { id: string; name: string }[]) ?? [];
    subreseller = (r.data as { id: string; name: string }[]) ?? [];
    loginMails = (m.data as { kunde_id: string; email: string }[] | null) ?? [];
  } catch (err) {
    console.error(err);
    throw new ImportFehler(txt.fehlerLaden);
  }

  const nachId = new Map(kunden.map((k) => [k.id.toLowerCase(), k]));
  const nachMail = new Map(loginMails.map((m) => [norm(m.email), nachId.get(m.kunde_id.toLowerCase())]));
  const stufeNachName = new Map(stufen.map((s) => [norm(s.name), s]));
  const stufeNachId = new Map(stufen.map((s) => [s.id, s]));
  const subNachName = new Map(subreseller.map((s) => [norm(s.name), s]));
  const subNachId = new Map(subreseller.map((s) => [s.id, s]));
  const minutenNamen = new Set([norm(texte("de").kundenExport.minutenabrechnung), norm(texte("en").kundenExport.minutenabrechnung)]);
  const aktivNamen = new Set([norm(texte("de").kundenExport.statusAktiv), norm(texte("en").kundenExport.statusAktiv)]);
  const archivNamen = new Set([norm(texte("de").kundenExport.statusArchiviert), norm(texte("en").kundenExport.statusArchiviert)]);

  const lies = (row: ReturnType<typeof blatt.getRow>, key: SpaltenKey) => {
    const nr = spalten.get(key);
    return nr ? row.getCell(nr).value : undefined;
  };

  const ergebnis: ImportZeile[] = [];
  const gesehen = new Set<string>();

  for (let nr = 2; nr <= blatt.rowCount; nr++) {
    const row = blatt.getRow(nr);
    const texteJeSpalte = new Map<SpaltenKey, string>();
    for (const key of spalten.keys()) texteJeSpalte.set(key, zellText(lies(row, key)));
    if ([...texteJeSpalte.values()].every((t) => t === "")) continue;

    const idText = texteJeSpalte.get("id") ?? "";
    const mailText = texteJeSpalte.get("emailLogin") ?? "";
    const aktuell = idText ? nachId.get(idText.toLowerCase()) : mailText ? nachMail.get(norm(mailText)) : undefined;

    const zeile: ImportZeile = {
      zeile: nr,
      kundeId: aktuell?.id ?? null,
      anzeigeName:
        (aktuell && kundenName(aktuell)) ||
        [texteJeSpalte.get("firma"), texteJeSpalte.get("vorname"), texteJeSpalte.get("nachname")].filter(Boolean).join(" ") ||
        mailText ||
        `${txt.zeile} ${nr}`,
      aenderungen: [],
      update: {},
      fehler: [],
    };
    ergebnis.push(zeile);

    if (!aktuell) {
      zeile.fehler.push(idText || mailText ? txt.fehlerUnbekannterKunde : txt.fehlerNeuerKunde);
      continue;
    }
    if (gesehen.has(aktuell.id)) {
      zeile.fehler.push(txt.fehlerDoppelt);
      continue;
    }
    gesehen.add(aktuell.id);

    const aendere = (feld: string, alt: string, neu: string) => zeile.aenderungen.push({ feld, alt: alt || txt.leer, neu: neu || txt.leer });

    // Einfache Textfelder
    for (const { key, spalte } of TEXTFELDER) {
      const text = texteJeSpalte.get(key);
      if (!text) continue; // leere Zelle = nicht aendern
      const neu = text === "-" ? "" : text;
      const alt = ((aktuell[spalte] as string | null) ?? "").replace(/\r\n/g, "\n");
      if (neu === alt.trim()) continue;
      // Zahlen ohne fuehrende Null (z.B. PLZ 01234 -> 1234) nicht als Aenderung werten
      const istZahl = typeof lies(row, key) === "number";
      if (istZahl && alt.replace(/^0+/, "") === neu) continue;
      zeile.update[spalte] = neu || null;
      aendere(exportTxt[key], alt, neu);
    }

    // Land: nur bekannte Laender (wie im Auswahlfeld der Kundenverwaltung)
    const landText = texteJeSpalte.get("land");
    if (landText) {
      const neu = landText === "-" ? "" : landText;
      const alt = aktuell.land ?? "";
      if (neu !== alt) {
        const treffer = neu ? LAENDER_LISTE.find((l) => norm(l) === norm(neu)) : "";
        if (treffer === undefined) zeile.fehler.push(`${txt.fehlerLand} ${landText}`);
        else if (treffer !== alt) {
          zeile.update.land = treffer || null;
          aendere(exportTxt.land, alt, treffer);
        }
      }
    }

    // MwSt: Zahl 0-100, Komma oder Punkt
    const mwstText = texteJeSpalte.get("mwst");
    if (mwstText) {
      const alt = aktuell.mwst_satz;
      if (mwstText === "-") {
        if (alt !== null) {
          zeile.update.mwst_satz = null;
          aendere(exportTxt.mwst, String(alt), "");
        }
      } else {
        const zahl = Number(mwstText.replace(",", "."));
        if (!Number.isFinite(zahl) || zahl < 0 || zahl > 100) zeile.fehler.push(`${txt.fehlerMwst} ${mwstText}`);
        else if (zahl !== alt) {
          zeile.update.mwst_satz = zahl;
          aendere(exportTxt.mwst, alt === null ? "" : String(alt), String(zahl));
        }
      }
    }

    // Wartungsvertrag ueber den Namen; "Minutenabrechnung" = kein Vertrag
    const wartungText = texteJeSpalte.get("wartungsvertrag");
    if (wartungText) {
      const keiner = wartungText === "-" || minutenNamen.has(norm(wartungText));
      const ziel = keiner ? null : stufeNachName.get(norm(wartungText));
      const altId = aktuell.wartungsvertrag_stufe_id;
      if (!keiner && !ziel) zeile.fehler.push(`${txt.fehlerWartung} ${wartungText}`);
      else if ((ziel?.id ?? null) !== altId) {
        zeile.update.wartungsvertrag_stufe_id = ziel?.id ?? null;
        aendere(exportTxt.wartungsvertrag, (altId && stufeNachId.get(altId)?.name) || exportTxt.minutenabrechnung, ziel?.name ?? exportTxt.minutenabrechnung);
      }
    }

    // Subreseller ueber den Namen
    const subText = texteJeSpalte.get("subreseller");
    if (subText) {
      const keiner = subText === "-";
      const ziel = keiner ? null : subNachName.get(norm(subText));
      const altId = aktuell.subreseller_id;
      if (!keiner && !ziel) zeile.fehler.push(`${txt.fehlerSubreseller} ${subText}`);
      else if ((ziel?.id ?? null) !== altId) {
        zeile.update.subreseller_id = ziel?.id ?? null;
        aendere(exportTxt.subreseller, (altId && subNachId.get(altId)?.name) || "", ziel?.name ?? "");
      }
    }

    // Status aktiv / archiviert
    const statusText = texteJeSpalte.get("status");
    if (statusText) {
      const archiviert = archivNamen.has(norm(statusText)) ? true : aktivNamen.has(norm(statusText)) ? false : null;
      if (archiviert === null) zeile.fehler.push(`${txt.fehlerStatus} ${statusText}`);
      else if (archiviert !== aktuell.deaktiviert) {
        zeile.update.deaktiviert = archiviert;
        aendere(exportTxt.status, aktuell.deaktiviert ? exportTxt.statusArchiviert : exportTxt.statusAktiv, archiviert ? exportTxt.statusArchiviert : exportTxt.statusAktiv);
      }
    }
  }

  return ergebnis;
}

// Schreibt die geprueften Aenderungen. Zeilen mit Fehlern werden uebersprungen.
// select() liefert die tatsaechlich geaenderten Zeilen zurueck - so faellt auch
// ein stilles Abweisen durch die Zugriffsregeln (0 Zeilen) auf.
export async function kundenImportAnwenden(
  zeilen: ImportZeile[],
  txt: KundenImportTexte,
): Promise<{ ok: number; fehlgeschlagen: { name: string; grund: string }[] }> {
  const offen = zeilen.filter((z) => z.kundeId && z.fehler.length === 0 && Object.keys(z.update).length > 0);
  let ok = 0;
  const fehlgeschlagen: { name: string; grund: string }[] = [];

  for (let i = 0; i < offen.length; i += 5) {
    await Promise.all(
      offen.slice(i, i + 5).map(async (z) => {
        const { data, error } = await supabase.from("profiles").update(z.update).eq("id", z.kundeId!).select("id");
        if (error || !data || data.length === 0) {
          if (error) console.error(error);
          fehlgeschlagen.push({ name: z.anzeigeName, grund: error?.message ?? txt.fehlerSpeichern });
        } else {
          ok++;
        }
      }),
    );
  }
  return { ok, fehlgeschlagen };
}
