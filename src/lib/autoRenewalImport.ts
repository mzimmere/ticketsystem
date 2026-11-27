// Abgleich des exocad-"Auto-Renewal-Reports" (xlsx) mit den Lizenzvertraegen.
// Der Report listet die Lizenzen, die sich automatisch verlaengern. Der Import
// speichert das Auto-Renewal-Datum je Vertrag (lizenz_vertraege.
// auto_renewal_datum, Abschnitt 91) und zeigt vorher, was zusammenpasst, was
// im Report fehlt (kein Auto-Renewal) und was bei uns nicht existiert.

import { supabase } from "./supabaseClient";
import { ladeSeiten } from "./ladeSeiten";

export class AutoRenewalFehler extends Error {}

export interface ReportZeile {
  serial: string;
  start: string | null;
  ende: string | null;
  freiEnde: string | null;
  auto: string;
}

interface Vertrag {
  id: string;
  lizenz_seriennummer: string;
  vertrag_start: string | null;
  vertrag_ende: string | null;
  frei_zeitraum_ende: string | null;
  status: string | null;
  renewal_bezahlt: boolean;
  auto_renewal_datum: string | null;
  kunde: { name: string | null; firmenname: string | null } | null;
}

export interface Abweichung {
  serial: string;
  feld: "start" | "ende";
  system: string | null;
  report: string | null;
}

export interface FehltImReport {
  serial: string;
  ende: string;
  kunde: string | null;
  renewalBezahlt: boolean;
}

export interface AutoRenewalAbgleich {
  dateiZeilen: number;
  // Vertrag-IDs je neuem Auto-Renewal-Datum (nur wo sich etwas aendert).
  setzen: { id: string; serial: string; datum: string; alt: string | null }[];
  unveraendert: number;
  // Vertraege, die bisher ein Datum hatten, im Report aber nicht mehr stehen.
  entfernen: { id: string; serial: string; alt: string }[];
  nichtImSystem: ReportZeile[];
  fehltImReport: FehltImReport[];
  abweichungen: Abweichung[];
  frueh: string;
  spaet: string;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function zellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("").trim();
    if ("result" in o) return zellText(o.result);
    if (typeof o.text === "string") return o.text.trim();
    return "";
  }
  return String(v).trim();
}

function alsTag(v: unknown): string | null {
  const t = zellText(v);
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const de = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) return `${de[3]}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}`;
  return null;
}

const SPALTEN: Record<string, string[]> = {
  serial: ["serialnumber", "seriennummer", "serial"],
  start: ["contractstartdate", "vertragsbeginn", "vertragsstart"],
  ende: ["contractenddate", "vertragsende"],
  frei: ["freeperiodenddate", "freierzeitraumbis", "freiphaseende"],
  auto: ["autorenewaldate", "autorenewal", "autorenewaldatum"],
};

export async function reportLesen(datei: File): Promise<ReportZeile[]> {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  try {
    await wb.xlsx.load(await datei.arrayBuffer());
  } catch {
    throw new AutoRenewalFehler("lesen");
  }
  for (const blatt of wb.worksheets) {
    const spalten = new Map<string, number>();
    blatt.getRow(1).eachCell((zelle, nr) => {
      const n = norm(zellText(zelle.value));
      for (const [key, aliase] of Object.entries(SPALTEN)) if (aliase.includes(n) && !spalten.has(key)) spalten.set(key, nr);
    });
    if (!spalten.has("serial") || !spalten.has("auto")) continue;

    const zeilen: ReportZeile[] = [];
    blatt.eachRow((row, nr) => {
      if (nr === 1) return;
      const serial = zellText(row.getCell(spalten.get("serial")!).value).toUpperCase();
      const auto = alsTag(row.getCell(spalten.get("auto")!).value);
      if (!serial || !auto) return;
      zeilen.push({
        serial,
        start: spalten.has("start") ? alsTag(row.getCell(spalten.get("start")!).value) : null,
        ende: spalten.has("ende") ? alsTag(row.getCell(spalten.get("ende")!).value) : null,
        freiEnde: spalten.has("frei") ? alsTag(row.getCell(spalten.get("frei")!).value) : null,
        auto,
      });
    });
    if (zeilen.length === 0) throw new AutoRenewalFehler("leer");
    return zeilen;
  }
  throw new AutoRenewalFehler("spalten");
}

export async function autoRenewalAbgleichen(organisationId: string, zeilen: ReportZeile[]): Promise<AutoRenewalAbgleich> {
  const vertraege = await ladeSeiten<Vertrag>((von, bis) =>
    supabase
      .from("lizenz_vertraege")
      .select("id, lizenz_seriennummer, vertrag_start, vertrag_ende, frei_zeitraum_ende, status, renewal_bezahlt, auto_renewal_datum, kunde:kunde_id(name, firmenname)")
      .eq("organisation_id", organisationId)
      .order("lizenz_seriennummer")
      .range(von, bis) as unknown as PromiseLike<{ data: Vertrag[] | null }>,
  );
  const nachSerial = new Map(vertraege.map((v) => [v.lizenz_seriennummer.toUpperCase(), v]));
  const imReport = new Set(zeilen.map((z) => z.serial));

  const setzen: AutoRenewalAbgleich["setzen"] = [];
  const abweichungen: Abweichung[] = [];
  const nichtImSystem: ReportZeile[] = [];
  let unveraendert = 0;

  for (const z of zeilen) {
    const v = nachSerial.get(z.serial);
    if (!v) {
      nichtImSystem.push(z);
      continue;
    }
    if (v.auto_renewal_datum === z.auto) unveraendert++;
    else setzen.push({ id: v.id, serial: v.lizenz_seriennummer, datum: z.auto, alt: v.auto_renewal_datum });
    if (z.start && v.vertrag_start && z.start !== v.vertrag_start) abweichungen.push({ serial: z.serial, feld: "start", system: v.vertrag_start, report: z.start });
    if (z.ende && v.vertrag_ende && z.ende !== v.vertrag_ende) abweichungen.push({ serial: z.serial, feld: "ende", system: v.vertrag_ende, report: z.ende });
  }

  const entfernen = vertraege
    .filter((v) => v.auto_renewal_datum && !imReport.has(v.lizenz_seriennummer.toUpperCase()))
    .map((v) => ({ id: v.id, serial: v.lizenz_seriennummer, alt: v.auto_renewal_datum! }));

  // Zeitraum, den der Report abdeckt: aktive Vertraege, deren Ende darin liegt
  // und die trotzdem fehlen, verlaengern sich nicht automatisch.
  const daten = zeilen.map((z) => z.auto).sort();
  const frueh = daten[0];
  const spaet = daten[daten.length - 1];
  const fruehMinus7 = new Date(`${frueh}T00:00:00Z`);
  fruehMinus7.setUTCDate(fruehMinus7.getUTCDate() - 7);
  const untergrenze = fruehMinus7.toISOString().slice(0, 10);

  const fehltImReport: FehltImReport[] = vertraege
    .filter((v) => {
      if (imReport.has(v.lizenz_seriennummer.toUpperCase())) return false;
      if (!v.status || v.status.toLowerCase() !== "active") return false;
      const ende = v.vertrag_ende ?? v.frei_zeitraum_ende;
      return !!ende && ende >= untergrenze && ende <= spaet;
    })
    .map((v) => ({
      serial: v.lizenz_seriennummer,
      ende: (v.vertrag_ende ?? v.frei_zeitraum_ende)!,
      kunde: v.kunde?.name ?? v.kunde?.firmenname ?? null,
      renewalBezahlt: v.renewal_bezahlt,
    }))
    .sort((a, b) => a.ende.localeCompare(b.ende));

  return { dateiZeilen: zeilen.length, setzen, unveraendert, entfernen, nichtImSystem, fehltImReport, abweichungen, frueh, spaet };
}

export async function autoRenewalAnwenden(organisationId: string, abgleich: AutoRenewalAbgleich, dateiname: string | null) {
  const nachDatum = new Map<string, string[]>();
  for (const s of abgleich.setzen) nachDatum.set(s.datum, [...(nachDatum.get(s.datum) ?? []), s.id]);

  for (const [datum, ids] of nachDatum) {
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await supabase
        .from("lizenz_vertraege")
        .update({ auto_renewal_datum: datum })
        .eq("organisation_id", organisationId)
        .in("id", ids.slice(i, i + 100))
        .select("id");
      if (error) throw error;
      if ((data?.length ?? 0) !== ids.slice(i, i + 100).length) throw new AutoRenewalFehler("rls");
    }
  }
  const loeschIds = abgleich.entfernen.map((e) => e.id);
  for (let i = 0; i < loeschIds.length; i += 100) {
    const { error } = await supabase
      .from("lizenz_vertraege")
      .update({ auto_renewal_datum: null })
      .eq("organisation_id", organisationId)
      .in("id", loeschIds.slice(i, i + 100));
    if (error) throw error;
  }

  // Importprotokoll (Abschnitt 85/91) - ein Fehler hier kippt den Import nicht.
  const { data: authData } = await supabase.auth.getUser();
  const { error: protokollFehler } = await supabase.from("import_protokoll").insert({
    organisation_id: organisationId,
    art: "auto_renewal",
    dateiname,
    neu: abgleich.setzen.length,
    aktualisiert: abgleich.unveraendert,
    erstellt_von: authData.user?.id ?? null,
  });
  if (protokollFehler) console.error("[AutoRenewalImport] Protokoll fehlgeschlagen:", protokollFehler);
}
