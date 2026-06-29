// Vorschlagswerte für den Regelsteuersatz, Stand 2026. Dient nur als
// Ausgangspunkt beim Anlegen - der tatsächliche Satz bleibt immer frei
// editierbar (z.B. wegen Kleinunternehmerregelung, Reverse-Charge bei
// EU-B2B-Geschäften, oder künftigen Satzänderungen).
export const LAENDER_MWST: Record<string, number> = {
  Deutschland: 19,
  Österreich: 20,
  Schweiz: 8.1,
  Belgien: 21,
  Niederlande: 21,
  Frankreich: 20,
  Italien: 22,
  Spanien: 21,
  Polen: 23,
  Luxemburg: 17,
  "Sonstiges Land": 0,
};

export const LAENDER_LISTE = Object.keys(LAENDER_MWST);
