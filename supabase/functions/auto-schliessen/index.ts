import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: firmen, error: firmenFehler } = await supabase
    .from("organisationen")
    .select("id, auto_schliessen_tage")
    .not("auto_schliessen_tage", "is", null)
    .gt("auto_schliessen_tage", 0);

  if (firmenFehler) {
    return new Response(JSON.stringify({ error: firmenFehler.message }), { status: 500 });
  }

  let geschlossenGesamt = 0;

  for (const firma of firmen ?? []) {
    const grenzeDatum = new Date();
    grenzeDatum.setDate(grenzeDatum.getDate() - firma.auto_schliessen_tage);

    const { data: tickets } = await supabase
      .from("tickets")
      .select("id")
      .eq("organisation_id", firma.id)
      .eq("status", "wartet_auf_kunde")
      .lt("zuletzt_kunden_nachricht_am", grenzeDatum.toISOString());

    if (!tickets || tickets.length === 0) continue;

    const ticketIds = tickets.map((t) => t.id);

    await supabase.from("tickets").update({ status: "geschlossen" }).in("id", ticketIds);

    await supabase.from("ticket_nachrichten").insert(
      ticketIds.map((id) => ({
        ticket_id: id,
        quelle: "intern",
        inhalt: `Ticket automatisch geschlossen – keine Antwort des Kunden seit ${firma.auto_schliessen_tage} Tagen.`,
      }))
    );

    geschlossenGesamt += ticketIds.length;
  }

  return new Response(
    JSON.stringify({ geschlossen: geschlossenGesamt }),
    { headers: { "Content-Type": "application/json" } },
  );
});