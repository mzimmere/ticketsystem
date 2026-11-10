import { supabase } from "./supabaseClient";
import { ladeSeiten } from "./ladeSeiten";
import { vonDatum, alsBesuchsZeilen } from "./zeitText";
import type { texte } from "./uebersetzungen";

export type KundenExportTexte = ReturnType<typeof texte>["kundenExport"];

export interface ExportKunde {
  id: string;
  name: string | null;
  vorname: string | null;
  nachname: string | null;
  firmenname: string | null;
  telefonnummer: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  land: string | null;
  mwst_satz: number | null;
  ust_id: string | null;
  notizen: string | null;
  deaktiviert: boolean;
  wartungsvertrag_stufe_id: string | null;
  subreseller_id: string | null;
}

type Zelle = string | number | Date | null;

interface Dongle {
  id: string;
  kunde_id: string;
  seriennummer: string;
  software: string;
}

interface Vertrag {
  kunde_id: string;
  dongle_id: string | null;
  lizenz_seriennummer: string;
  produkt_name: string;
  vertrag_ende: string | null;
  status: string | null;
  renewal_bezahlt: boolean;
  aktuelle_engine_build: string | null;
}

// Excel speichert Datumswerte ohne Zeitzone; exceljs rechnet Date-Objekte als
// UTC. Deshalb immer UTC-Mitternacht des gemeinten Kalendertags verwenden -
// sonst springt das Datum je nach Zeitzone um einen Tag.
function tagAlsDatum(iso: string | null): Date | null {
  return iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : null;
}

function zeitpunktAlsTag(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function downloadBlob(inhalt: BlobPart, dateiname: string, typ: string) {
  const url = URL.createObjectURL(new Blob([inhalt], { type: typ }));
  const a = document.createElement("a");
  a.href = url;
  a.download = dateiname;
  a.click();
  URL.revokeObjectURL(url);
}

// Laedt zu den uebergebenen Kunden alles Zugehoerige (Login-/Zusatz-Mails,
// Dongles, Lizenzvertraege, Portal-Besuche) und baut daraus eine Excel-Datei mit
// zwei Blaettern: Stammdaten je Kunde und eine Zeile je Dongle/Lizenz.
// exceljs wird erst hier nachgeladen, damit es das Haupt-Bundle nicht aufblaeht.
export async function kundenExcelExportieren(opts: {
  organisationId: string;
  kunden: ExportKunde[];
  txt: KundenExportTexte;
  dateiname: string;
}): Promise<void> {
  const { organisationId, kunden, txt, dateiname } = opts;
  const ids = new Set(kunden.map((k) => k.id));

  const [stufen, subreseller, loginMails, zusatzMails, dongles, vertraege, besuche] = await Promise.all([
    supabase.from("wartungsvertrag_stufen").select("id, name").eq("organisation_id", organisationId),
    supabase.from("subreseller").select("id, name").eq("organisation_id", organisationId),
    supabase.rpc("kunden_emails_export", { p_organisation_id: organisationId }),
    ladeSeiten<{ kunde_id: string; email: string }>((von, bis) =>
      supabase.from("kunden_email_adressen").select("kunde_id, email").eq("organisation_id", organisationId).range(von, bis),
    ),
    ladeSeiten<Dongle>((von, bis) =>
      supabase
        .from("kunden_dongles")
        .select("id, kunde_id, seriennummer, software")
        .eq("organisation_id", organisationId)
        .not("kunde_id", "is", null)
        .range(von, bis),
    ),
    ladeSeiten<Vertrag>((von, bis) =>
      supabase
        .from("lizenz_vertraege")
        .select("kunde_id, dongle_id, lizenz_seriennummer, produkt_name, vertrag_ende, status, renewal_bezahlt, aktuelle_engine_build")
        .eq("organisation_id", organisationId)
        .not("kunde_id", "is", null)
        .range(von, bis),
    ),
    supabase.rpc("besuche_auswertung", { p_organisation_id: organisationId, p_von: vonDatum(90) }),
  ]);

  const stufeName = new Map((stufen.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
  const subName = new Map((subreseller.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
  const loginMail = new Map(((loginMails.data as { kunde_id: string; email: string }[] | null) ?? []).map((m) => [m.kunde_id, m.email]));
  const letzterBesuch = new Map(alsBesuchsZeilen(besuche.data).map((b) => [b.nutzer_id, b.letzter_besuch]));

  const weitereMails = new Map<string, string[]>();
  for (const m of zusatzMails) weitereMails.set(m.kunde_id, [...(weitereMails.get(m.kunde_id) ?? []), m.email]);

  const donglesJeKunde = new Map<string, Dongle[]>();
  for (const d of dongles) if (ids.has(d.kunde_id)) donglesJeKunde.set(d.kunde_id, [...(donglesJeKunde.get(d.kunde_id) ?? []), d]);
  const vertraegeJeKunde = new Map<string, Vertrag[]>();
  for (const v of vertraege) if (ids.has(v.kunde_id)) vertraegeJeKunde.set(v.kunde_id, [...(vertraegeJeKunde.get(v.kunde_id) ?? []), v]);

  const sortiert = [...kunden].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "de"));
  const heuteIso = new Date().toLocaleDateString("sv-SE");

  const kopfKunden = [
    txt.name, txt.firma, txt.vorname, txt.nachname, txt.emailLogin, txt.weitereEmails, txt.telefon,
    txt.strasse, txt.hausnummer, txt.plz, txt.ort, txt.land, txt.mwst, txt.ustId,
    txt.wartungsvertrag, txt.subreseller, txt.anzahlDongles, txt.anzahlLizenzen, txt.naechstesVertragsende,
    txt.renewalOffen, txt.zuletztImPortal, txt.status, txt.notizen, txt.id,
  ];
  // Nur diese Spalten liest der Re-Import wieder ein (kundenImport.ts);
  // alle anderen werden grau markiert und beim Import ignoriert.
  const nurAnzeige = new Set([
    txt.name, txt.emailLogin, txt.weitereEmails, txt.anzahlDongles, txt.anzahlLizenzen,
    txt.naechstesVertragsende, txt.renewalOffen, txt.zuletztImPortal, txt.id,
    txt.dongleSeriennummer, txt.software, txt.lizenzSeriennummer, txt.produkt,
    txt.vertragStatus, txt.vertragsende, txt.renewalBezahlt, txt.build,
  ]);
  const zeilenKunden: Zelle[][] = sortiert.map((k) => {
    const meineVertraege = vertraegeJeKunde.get(k.id) ?? [];
    const aktive = meineVertraege.filter((v) => v.vertrag_ende && (!v.status || v.status.toLowerCase() === "active"));
    const kuenftig = aktive
      .map((v) => v.vertrag_ende!.slice(0, 10))
      .filter((tag) => tag >= heuteIso)
      .sort();
    return [
      k.name, k.firmenname, k.vorname, k.nachname, loginMail.get(k.id) ?? null, (weitereMails.get(k.id) ?? []).join(", ") || null,
      k.telefonnummer, k.strasse, k.hausnummer, k.plz, k.ort, k.land, k.mwst_satz, k.ust_id,
      (k.wartungsvertrag_stufe_id && stufeName.get(k.wartungsvertrag_stufe_id)) || txt.minutenabrechnung,
      (k.subreseller_id && subName.get(k.subreseller_id)) || null,
      (donglesJeKunde.get(k.id) ?? []).length,
      meineVertraege.length,
      tagAlsDatum(kuenftig[0] ?? null),
      aktive.filter((v) => !v.renewal_bezahlt).length,
      zeitpunktAlsTag(letzterBesuch.get(k.id)),
      k.deaktiviert ? txt.statusArchiviert : txt.statusAktiv,
      k.notizen,
      k.id,
    ];
  });

  const kopfLizenzen = [
    txt.name, txt.firma, txt.dongleSeriennummer, txt.software, txt.lizenzSeriennummer, txt.produkt,
    txt.vertragStatus, txt.vertragsende, txt.renewalBezahlt, txt.build,
  ];
  const zeilenLizenzen: Zelle[][] = [];
  for (const k of sortiert) {
    const meineDongles = donglesJeKunde.get(k.id) ?? [];
    const meineVertraege = vertraegeJeKunde.get(k.id) ?? [];
    const zeile = (d: Dongle | null, v: Vertrag | null): Zelle[] => [
      k.name, k.firmenname, d?.seriennummer ?? null, d?.software ?? null,
      v?.lizenz_seriennummer ?? null, v?.produkt_name ?? null, v?.status ?? null,
      tagAlsDatum(v?.vertrag_ende ?? null),
      v ? (v.renewal_bezahlt ? txt.ja : txt.nein) : null,
      v?.aktuelle_engine_build && v.aktuelle_engine_build !== "null" ? v.aktuelle_engine_build : null,
    ];
    const verwendet = new Set<Vertrag>();
    for (const d of meineDongles) {
      const zuDongle = meineVertraege.filter((v) => v.dongle_id === d.id);
      if (zuDongle.length === 0) zeilenLizenzen.push(zeile(d, null));
      for (const v of zuDongle) {
        verwendet.add(v);
        zeilenLizenzen.push(zeile(d, v));
      }
    }
    for (const v of meineVertraege) if (!verwendet.has(v)) zeilenLizenzen.push(zeile(null, v));
  }

  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const blatt = (name: string, kopf: string[], zeilen: Zelle[][]) => {
    const ws = wb.addWorksheet(name);
    ws.addRow(kopf);
    zeilen.forEach((z) => ws.addRow(z));
    const kopfZeile = ws.getRow(1);
    kopfZeile.font = { bold: true, color: { argb: "FFFFFFFF" } };
    kopf.forEach((titel, i) => {
      kopfZeile.getCell(i + 1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: nurAnzeige.has(titel) ? "FF8A949E" : "FF0E6E8C" },
      };
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: kopf.length } };
    kopf.forEach((titel, i) => {
      let max = titel.length;
      zeilen.forEach((z) => {
        const w = z[i];
        const laenge = w instanceof Date ? 10 : w === null ? 0 : String(w).length;
        if (laenge > max) max = laenge;
      });
      const spalte = ws.getColumn(i + 1);
      spalte.width = Math.min(Math.max(max + 2, 10), 50);
      if (titel === txt.notizen) spalte.alignment = { wrapText: true, vertical: "top" };
    });
    // Anzeigespalten: hellgrau, gedaempfte Schrift und gesperrt; alle anderen
    // Zellen (auch leere) bleiben bearbeitbar. Gesperrt wird erst durch den
    // Blattschutz weiter unten wirksam.
    zeilen.forEach((_, z) => {
      const row = ws.getRow(z + 2);
      kopf.forEach((titel, i) => {
        const zelle = row.getCell(i + 1);
        if (zelle.value instanceof Date) zelle.numFmt = "dd.mm.yyyy";
        if (nurAnzeige.has(titel)) {
          zelle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F3F5" } };
          zelle.font = { color: { argb: "FF6B7280" } };
          zelle.protection = { locked: true };
        } else {
          zelle.protection = { locked: false };
        }
      });
    });
    // Ohne Passwort: wer wirklich etwas aendern will, hebt den Schutz in Excel
    // unter "Ueberpruefen" auf. Filtern und Spaltenbreite bleiben erlaubt.
    void ws.protect("", { autoFilter: true, formatColumns: true, formatRows: true, selectLockedCells: true, selectUnlockedCells: true });
  };
  blatt(txt.blattKunden, kopfKunden, zeilenKunden);
  blatt(txt.blattLizenzen, kopfLizenzen, zeilenLizenzen);

  const info = wb.addWorksheet(txt.hinweiseBlatt);
  txt.hinweise.forEach((zeile, i) => {
    const r = info.addRow([zeile]);
    if (i === 0) r.font = { bold: true };
  });
  info.getColumn(1).width = 130;
  info.getColumn(1).alignment = { wrapText: true, vertical: "top" };

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(buffer, dateiname, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
