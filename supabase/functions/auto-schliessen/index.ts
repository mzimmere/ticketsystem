import { createClient } from "jsr:@supabase/supabase-js@2";

// Wird täglich per pg_cron aufgerufen.
// Schließt alle Tickets im Status "wartet_auf_kunde", bei denen die
// letzte Kunden-Nachricht länger als auto_schliessen_tage Tage her ist.
//
// Auth: Diese Funktion hat verify_jwt=false (im Dashboard/Deploy), weil
// pg_cron kein echtes Supabase-JWT mitschickt - stattdessen prueft der
// Code selbst gegen ein Shared Secret aus Supabase Vault (Funktion
// get_cron_secret(), siehe schema.sql Abschnitt 45). Bewusst NICHT im
// Quellcode hartkodiert, da dieses Repo oeffentlich auf GitHub liegt.
// Vorher wurde faelschlich SUPABASE_SERVICE_ROLE_KEY erwartet, aber ein
// Platzhalter-Wert mitgeschickt - der Job lief seit Einfuehrung nie durch.

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const { data: cronSecret } = await supabase.rpc("get_cron_secret");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Firmen mit aktivem Auto-Schließen laden
  const { data: firmen, error: firmenFehler } = await supabase
    .from("organisationen")
    .select("id, auto_schliessen_tage")
    .not("auto_schliessen_tage", "is", null)
    .gt("auto_schliessen_tage", 0);

  if (firmenFehler) {
    console.error("Firmen laden fehlgeschlagen:", firmenFehler);
    return new Response(JSON.stringify({ error: firmenFehler.message }), { status: 500 });
  }

  let geschlossenGesamt = 0;

  for (const firma of firmen ?? []) {
    const grenzeDatum = new Date();
    grenzeDatum.setDate(grenzeDatum.getDate() - firma.auto_schliessen_tage);

    // Tickets finden: wartet_auf_kunde + letzte Kunden-Nachricht vor der Grenze
    const { data: tickets, error: ticketsFehler } = await supabase
      .from("tickets")
      .select("id")
      .eq("organisation_id", firma.id)
      .eq("status", "wartet_auf_kunde")
      .lt("zuletzt_kunden_nachricht_am", grenzeDatum.toISOString());

    if (ticketsFehler) {
      console.error(`Tickets für Firma ${firma.id} fehlgeschlagen:`, ticketsFehler);
      continue;
    }

    if (!tickets || tickets.length === 0) continue;

    const ticketIds = tickets.map((t) => t.id);

    // Tickets schließen
    const { error: updateFehler } = await supabase
      .from("tickets")
      .update({ status: "geschlossen" })
      .in("id", ticketIds);

    if (updateFehler) {
      console.error(`Update für Firma ${firma.id} fehlgeschlagen:`, updateFehler);
      continue;
    }

    // Automatische Status-Nachricht pro Ticket - quelle "status_aenderung"
    // statt "intern", damit sie (wie manuelle Statuswechsel) im Verlauf als
    // eigener Eintrag erscheint und auch fuer den Kunden sichtbar ist.
    const nachrichten = ticketIds.map((id) => ({
      ticket_id: id,
      quelle: "status_aenderung",
      inhalt: `Wartet auf Kunde → Geschlossen (automatisch, keine Antwort seit ${firma.auto_schliessen_tage} Tagen)`,
    }));

    await supabase.from("ticket_nachrichten").insert(nachrichten);

    // Kunden ueber den Abschluss informieren (inkl. Bewertungslinks, siehe
    // benachrichtige-kunde) - sonst wuerden automatisch geschlossene Tickets
    // (die Mehrheit der Abschluesse) nie eine CSAT-Anfrage ausloesen.
    // Service-Role-Key als Bearer-Token, da benachrichtige-kunde ein echtes
    // Supabase-JWT erwartet (verify_jwt=true) und dieser Cron-Job selbst
    // keine Nutzer-Session hat.
    const benachrichtigenUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/benachrichtige-kunde`;
    for (const id of ticketIds) {
      try {
        await fetch(benachrichtigenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ ticketId: id, ereignis: "status_geaendert", neuerStatus: "geschlossen" }),
        });
      } catch (err) {
        console.error(`Benachrichtigung fuer Ticket ${id} fehlgeschlagen:`, err);
      }
    }

    geschlossenGesamt += ticketIds.length;
    console.log(`Firma ${firma.id}: ${ticketIds.length} Ticket(s) automatisch geschlossen.`);
  }

  return new Response(
    JSON.stringify({ geschlossen: geschlossenGesamt }),
    { headers: { "Content-Type": "application/json" } },
  );
});
