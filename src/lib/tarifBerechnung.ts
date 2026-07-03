// Berechnet den Plattform-Preis einer Firma für einen Monat anhand ihres
// zugewiesenen Tarifs (Grundgebühr bis inklusive_mitarbeiter, danach
// Staffelpreise nach absoluter Mitarbeiterzahl).

export interface TarifStaffel {
  von_mitarbeiter: number;
  bis_mitarbeiter: number | null;
  preis_pro_mitarbeiter_cent: number;
}

export interface TarifBasis {
  grundpreis_cent: number;
  inklusive_mitarbeiter: number;
  mwst_satz: number;
}

export interface RechnungsPosition {
  label: string;
  betrag_cent: number;
}

export interface TarifBerechnung {
  positionen: RechnungsPosition[];
  staffelBetragCent: number;
  nettoCent: number;
  mwstCent: number;
  bruttoCent: number;
}

export function berechneTarifpreis(
  tarif: TarifBasis,
  staffeln: TarifStaffel[],
  mitarbeiterAnzahl: number,
): TarifBerechnung {
  const positionen: RechnungsPosition[] = [
    {
      label: `Grundgebühr (bis ${tarif.inklusive_mitarbeiter} Mitarbeiter inklusive)`,
      betrag_cent: tarif.grundpreis_cent,
    },
  ];

  let staffelBetragCent = 0;
  const sortiert = [...staffeln].sort((a, b) => a.von_mitarbeiter - b.von_mitarbeiter);
  for (const s of sortiert) {
    const von = Math.max(s.von_mitarbeiter, tarif.inklusive_mitarbeiter + 1);
    const bis = s.bis_mitarbeiter ?? Infinity;
    const oben = Math.min(bis, mitarbeiterAnzahl);
    const anzahl = Math.max(0, oben - von + 1);
    if (anzahl <= 0) continue;
    const betrag = anzahl * s.preis_pro_mitarbeiter_cent;
    staffelBetragCent += betrag;
    const bisLabel = s.bis_mitarbeiter != null ? s.bis_mitarbeiter : "∞";
    positionen.push({
      label: `Mitarbeiter ${s.von_mitarbeiter}–${bisLabel} (${anzahl} × ${(s.preis_pro_mitarbeiter_cent / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €)`,
      betrag_cent: betrag,
    });
  }

  const nettoCent = tarif.grundpreis_cent + staffelBetragCent;
  const mwstCent = Math.round(nettoCent * (tarif.mwst_satz / 100));
  const bruttoCent = nettoCent + mwstCent;

  return { positionen, staffelBetragCent, nettoCent, mwstCent, bruttoCent };
}
