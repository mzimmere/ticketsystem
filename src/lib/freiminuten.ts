// Freiminuten-Abzug: gilt pro Dongle, nur fuer dessen eigene Tickets (kein
// gemeinsamer Topf pro Kunde). Pro Dongle wird die abrechenbare Zeit des
// Monats summiert; die Freiminuten daraus werden zum gewichteten
// Durchschnittspreis dieses Dongles abgezogen.

export interface ZeitEintragMitDongle {
  minuten: number;
  preis_pro_minute_cent_snapshot: number;
  dongle_id: string | null;
}

export interface DongleFreiminuten {
  id: string;
  seriennummer: string;
  freiminuten_pro_monat: number;
}

export interface DongleAbzug {
  dongleId: string;
  seriennummer: string;
  freieMinuten: number;
  abzugCent: number;
}

export interface FreiminutenErgebnis {
  gesamtMinuten: number;
  zwischensummeOhneAbzug: number;
  abzugCent: number;
  zwischensummeNachAbzug: number;
  abzuegeJeDongle: DongleAbzug[];
}

export function berechneFreiminutenAbzug(
  eintraege: ZeitEintragMitDongle[],
  dongles: DongleFreiminuten[],
): FreiminutenErgebnis {
  const gesamtMinuten = eintraege.reduce((sum, e) => sum + e.minuten, 0);
  const zwischensummeOhneAbzug = eintraege.reduce(
    (sum, e) => sum + e.minuten * e.preis_pro_minute_cent_snapshot,
    0,
  );

  const dongleKarte = new Map(dongles.map((d) => [d.id, d]));
  const proDongle = new Map<string, { minuten: number; cent: number }>();
  for (const e of eintraege) {
    if (!e.dongle_id || !dongleKarte.has(e.dongle_id)) continue;
    const bestehend = proDongle.get(e.dongle_id) ?? { minuten: 0, cent: 0 };
    bestehend.minuten += e.minuten;
    bestehend.cent += e.minuten * e.preis_pro_minute_cent_snapshot;
    proDongle.set(e.dongle_id, bestehend);
  }

  const abzuegeJeDongle: DongleAbzug[] = [];
  let abzugCent = 0;
  for (const [dongleId, summe] of proDongle) {
    const dongle = dongleKarte.get(dongleId)!;
    if (dongle.freiminuten_pro_monat <= 0 || summe.minuten <= 0) continue;
    const freieMinuten = Math.min(dongle.freiminuten_pro_monat, summe.minuten);
    const dongleAbzug = Math.round((freieMinuten * summe.cent) / summe.minuten);
    abzugCent += dongleAbzug;
    abzuegeJeDongle.push({
      dongleId,
      seriennummer: dongle.seriennummer,
      freieMinuten,
      abzugCent: dongleAbzug,
    });
  }

  return {
    gesamtMinuten,
    zwischensummeOhneAbzug,
    abzugCent,
    zwischensummeNachAbzug: zwischensummeOhneAbzug - abzugCent,
    abzuegeJeDongle,
  };
}
