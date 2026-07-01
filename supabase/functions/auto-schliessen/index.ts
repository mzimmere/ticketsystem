import { createClient } from "jsr:@supabase/supabase-js@2";

// Wird täglich per pg_cron aufgerufen.
// Schließt alle Tickets im Status "wartet_auf_kunde", bei denen die
// letzte Kunden-Nachricht länger als auto_schliessen_tage Tage her ist.

Deno.serve(async (req) => {
  // Sicherheit: nur interne Supabase-Aufrufe erlaubt
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

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

    // Automatische System-Nachricht pro Ticket
    const nachrichten = ticketIds.map((id) => ({
      ticket_id: id,
      quelle: "intern",
      inhalt: `Ticket automatisch geschlossen – keine Antwort des Kunden seit ${firma.auto_schliessen_tage} Tagen.`,
    }));

    await supabase.from("ticket_nachrichten").insert(nachrichten);

    geschlossenGesamt += ticketIds.length;
    console.log(`Firma ${firma.id}: ${ticketIds.length} Ticket(s) automatisch geschlossen.`);
  }

  return new Response(
    JSON.stringify({ geschlossen: geschlossenGesamt }),
    { headers: { "Content-Type": "application/json" } },
  );
});
