// Toleranter CSV-Parser (RFC4180-artig): behandelt in Anführungszeichen
// gesetzte Felder mit eingebetteten Kommas/Zeilenumbruechen, verdoppelte
// Anfuehrungszeichen ("") als Escape, CRLF/LF, sowie ein evtl. fuehrendes
// BOM (kommt bei manchen Portal-Exporten vor).

export interface GeparsteCsv {
  header: string[];
  zeilen: string[][];
}

export function parseCsv(text: string): GeparsteCsv {
  const bereinigt = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const alleZeilen: string[][] = [];
  let feld = "";
  let zeile: string[] = [];
  let inAnfuehrung = false;

  for (let i = 0; i < bereinigt.length; i++) {
    const zeichen = bereinigt[i];

    if (inAnfuehrung) {
      if (zeichen === '"') {
        if (bereinigt[i + 1] === '"') {
          feld += '"';
          i++;
        } else {
          inAnfuehrung = false;
        }
      } else {
        feld += zeichen;
      }
      continue;
    }

    if (zeichen === '"') {
      inAnfuehrung = true;
    } else if (zeichen === ",") {
      zeile.push(feld);
      feld = "";
    } else if (zeichen === "\n" || zeichen === "\r") {
      if (zeichen === "\r" && bereinigt[i + 1] === "\n") i++;
      zeile.push(feld);
      feld = "";
      if (zeile.length > 1 || zeile[0] !== "") alleZeilen.push(zeile);
      zeile = [];
    } else {
      feld += zeichen;
    }
  }
  if (feld !== "" || zeile.length > 0) {
    zeile.push(feld);
    if (zeile.length > 1 || zeile[0] !== "") alleZeilen.push(zeile);
  }

  if (alleZeilen.length === 0) return { header: [], zeilen: [] };
  const [header, ...zeilen] = alleZeilen;
  return { header: header.map((h) => h.trim()), zeilen };
}
