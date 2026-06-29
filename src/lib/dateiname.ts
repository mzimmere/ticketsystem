// Supabase Storage lehnt Objekt-Pfade mit Leerzeichen, Kommas, Umlauten
// & Co. ab ("Invalid key"). Diese Funktion macht aus einem beliebigen
// Datei-Namen einen Pfad-sicheren Namen, ohne die Dateiendung zu verlieren.
export function sichererDateiname(name: string): string {
  const punkt = name.lastIndexOf(".");
  const hatEndung = punkt > 0 && punkt < name.length - 1;
  const basis = hatEndung ? name.slice(0, punkt) : name;
  const endung = hatEndung ? name.slice(punkt + 1) : "";

  const sicherBasis = basis
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // Akzente/Umlaute auf Basisbuchstaben reduzieren
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  const sichereEndung = endung.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  if (!sicherBasis) return sichereEndung ? `datei.${sichereEndung}` : "datei";
  return sichereEndung ? `${sicherBasis}.${sichereEndung}` : sicherBasis;
}
