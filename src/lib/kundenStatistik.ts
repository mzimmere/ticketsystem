import { supabase } from "./supabaseClient";
import { ladeSeiten } from "./ladeSeiten";
import { vonDatum, alsBesuchsZeilen } from "./zeitText";

export interface KundenStat {
  tickets: number; // im Zeitraum angelegt
  offen: number; // aktuell offen (unabhaengig vom Zeitraum)
  minuten: number; // im Zeitraum erfasst
  besuche: number; // Portal-Sitzungen im Zeitraum
  letzterBesuch: string | null;
  letztesTicket: string | null; // unabhaengig vom Zeitraum
}

const OFFENE_STATUS = new Set(["offen", "in_bearbeitung", "wartet_auf_kunde"]);

// Kennzahlen je Kunde fuer die Uebersicht in der Kundenverwaltung und die
// Top-Kunden-Karte im Dashboard: Tickets, Zeit und Portal-Besuche im Zeitraum.
// Bei fehlender Berechtigung fuer die Besuche (nur Techniker/Admins) bleiben
// diese einfach bei 0.
export async function ladeKundenStatistik(organisationId: string, tage: number): Promise<Record<string, KundenStat>> {
  const vonIso = new Date(Date.now() - tage * 86400000).toISOString();

  const [tickets, zeit, besuche] = await Promise.all([
    ladeSeiten<{ kunde_id: string | null; status: string; erstellt_am: string }>((von, bis) =>
      supabase
        .from("tickets")
        .select("kunde_id, status, erstellt_am")
        .eq("organisation_id", organisationId)
        .not("kunde_id", "is", null)
        .range(von, bis),
    ),
    ladeSeiten<{ kunde_id: string | null; minuten: number | null }>((von, bis) =>
      supabase
        .from("zeiteintraege")
        .select("kunde_id, minuten")
        .eq("organisation_id", organisationId)
        .gte("erstellt_am", vonIso)
        .not("kunde_id", "is", null)
        .not("minuten", "is", null)
        .range(von, bis),
    ),
    supabase.rpc("besuche_auswertung", { p_organisation_id: organisationId, p_von: vonDatum(tage) }),
  ]);

  const karte: Record<string, KundenStat> = {};
  const eintrag = (id: string) =>
    (karte[id] ??= { tickets: 0, offen: 0, minuten: 0, besuche: 0, letzterBesuch: null, letztesTicket: null });

  for (const t of tickets) {
    if (!t.kunde_id) continue;
    const e = eintrag(t.kunde_id);
    if (t.erstellt_am >= vonIso) e.tickets++;
    if (OFFENE_STATUS.has(t.status)) e.offen++;
    if (!e.letztesTicket || t.erstellt_am > e.letztesTicket) e.letztesTicket = t.erstellt_am;
  }
  for (const z of zeit) {
    if (z.kunde_id) eintrag(z.kunde_id).minuten += z.minuten ?? 0;
  }
  if (!besuche.error) {
    for (const b of alsBesuchsZeilen(besuche.data)) {
      if (b.ist_mitarbeiter) continue;
      const e = eintrag(b.nutzer_id);
      e.besuche = b.sitzungen;
      e.letzterBesuch = b.letzter_besuch;
    }
  }
  return karte;
}
