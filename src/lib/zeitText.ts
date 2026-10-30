// "zuletzt aktiv"-Angaben: heute / gestern / vor n Tagen, danach das Datum.
export function zuletztText(iso: string | null, sprache: "de" | "en"): string {
  const en = sprache === "en";
  if (!iso) return en ? "never" : "nie";
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const tag = new Date(iso);
  tag.setHours(0, 0, 0, 0);
  const tage = Math.round((heute.getTime() - tag.getTime()) / 86400000);
  if (tage <= 0) return en ? "today" : "heute";
  if (tage === 1) return en ? "yesterday" : "gestern";
  if (tage < 14) return en ? `${tage} days ago` : `vor ${tage} Tagen`;
  return new Date(iso).toLocaleDateString(en ? "en-US" : "de-DE");
}

export interface BesuchsZeile {
  nutzer_id: string;
  ist_mitarbeiter: boolean;
  tage_aktiv: number;
  sitzungen: number;
  letzter_besuch: string | null;
}

// Eingabe fuer besuche_auswertung(p_organisation_id, p_von date).
export function vonDatum(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() - tage);
  return d.toLocaleDateString("sv-SE");
}

export function alsBesuchsZeilen(daten: unknown): BesuchsZeile[] {
  return ((daten as BesuchsZeile[] | null) ?? []).map((z) => ({
    ...z,
    tage_aktiv: Number(z.tage_aktiv),
    sitzungen: Number(z.sitzungen),
  }));
}
