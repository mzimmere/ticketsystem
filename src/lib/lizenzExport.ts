// Excel-Export der nicht zugeordneten Dongles bzw. Lizenzvertraege
// (Dongles & Lizenzen -> Import & Zuordnung). Exportiert genau die Eintraege,
// die in der Liste gerade angezeigt werden (also inkl. Filter). exceljs wird
// erst hier nachgeladen, damit es das Haupt-Bundle nicht aufblaeht.

import { downloadBlob } from "./kundenExport";

type Zelle = string | Date | null;

export interface LizenzExportTexte {
  blatt: string;
  kopf: string[];
  datei: string;
}

// Excel speichert Datumswerte ohne Zeitzone; exceljs rechnet Date-Objekte als
// UTC - deshalb UTC-Mitternacht des gemeinten Kalendertags verwenden.
export function tagAlsDatumFuerExcel(iso: string | null): Date | null {
  return iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : null;
}

export async function lizenzListeExportieren(texte: LizenzExportTexte, zeilen: Zelle[][]) {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const ws = wb.addWorksheet(texte.blatt);
  ws.addRow(texte.kopf);
  zeilen.forEach((z) => ws.addRow(z));

  const kopfZeile = ws.getRow(1);
  kopfZeile.font = { bold: true, color: { argb: "FFFFFFFF" } };
  texte.kopf.forEach((_, i) => {
    kopfZeile.getCell(i + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E6E8C" } };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: texte.kopf.length } };

  texte.kopf.forEach((titel, i) => {
    let max = titel.length;
    zeilen.forEach((z) => {
      const w = z[i];
      const laenge = w instanceof Date ? 10 : w === null ? 0 : String(w).length;
      if (laenge > max) max = laenge;
    });
    ws.getColumn(i + 1).width = Math.min(Math.max(max + 2, 10), 60);
  });
  zeilen.forEach((z, r) => {
    z.forEach((w, i) => {
      if (w instanceof Date) ws.getRow(r + 2).getCell(i + 1).numFmt = "dd.mm.yyyy";
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(buffer, texte.datei, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
