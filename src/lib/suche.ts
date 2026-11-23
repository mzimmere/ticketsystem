// Gemeinsame Suchlogik fuer Kunden-, Ticket- und Dongle-Suchfelder.
// Verglichen wird ohne Gross-/Kleinschreibung, ohne Umlaut-Akzente (Zähne = zahne,
// Schöfmann = schofmann, ß = ss) und ohne Satzzeichen. Mehrere Woerter muessen alle
// vorkommen - in beliebiger Reihenfolge und auch ueber mehrere Felder verteilt
// (z.B. "graf zmvz" findet Name "Tim Graf" mit Firma "ZÄHNE ZMVZ …").
export function normalisiereSuche(text: string | null | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9#]+/g, " ")
    .trim();
}

export function sucheTrifft(begriff: string, ...felder: (string | null | undefined)[]): boolean {
  const woerter = normalisiereSuche(begriff).split(" ").filter(Boolean);
  if (woerter.length === 0) return true;
  const heuhaufen = normalisiereSuche(felder.filter(Boolean).join(" "));
  return woerter.every((w) => heuhaufen.includes(w));
}
