import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user } } = await supabase.auth.getUser(
    req.headers.get("Authorization")?.replace("Bearer ", "") ?? ""
  );
  if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const { aktion, ticketId } = await req.json();

  // Ticket + Nachrichten laden
  const { data: ticket } = await supabase
    .from("tickets")
    .select("titel, status, prioritaet, erstellt_am, kunde:kunde_id(name)")
    .eq("id", ticketId)
    .single();

  const { data: nachrichten } = await supabase
    .from("ticket_nachrichten")
    .select("inhalt, quelle, erstellt_am")
    .eq("ticket_id", ticketId)
    .not("inhalt", "is", null)
    .order("erstellt_am", { ascending: true })
    .limit(30);

  const verlauf = (nachrichten ?? [])
    .map((n) => `[${n.quelle === "intern" ? "Team" : "Kunde"}]: ${n.inhalt}`)
    .join("\n");

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY nicht konfiguriert. Bitte in Supabase → Settings → Edge Functions → Secrets eintragen." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let prompt = "";

  if (aktion === "zusammenfassung") {
    prompt = `Du bist ein präziser IT-Support-Assistent. Fasse dieses Support-Ticket in 2-3 Sätzen zusammen. Nenne das Kernproblem, den aktuellen Stand und ggf. den nächsten Schritt. Keine Floskeln.

Ticket: "${ticket?.titel}"
Status: ${ticket?.status}
Kunde: ${(ticket?.kunde as {name: string} | null)?.name ?? "Unbekannt"}

Verlauf:
${verlauf || "(Keine Nachrichten)"}`;

  } else if (aktion === "antwortvorschlag") {
    const { data: makros } = await supabase
      .from("makros")
      .select("titel, inhalt")
      .limit(10);

    const makroListe = (makros ?? [])
      .map((m) => `- ${m.titel}: ${m.inhalt.slice(0, 100)}`)
      .join("\n");

    prompt = `Du bist ein freundlicher, professioneller IT-Support-Mitarbeiter. Schreibe eine hilfreiche Antwort auf die letzte Kunden-Nachricht. Halte es kurz und konkret. Auf Deutsch. Kein "Sehr geehrte/r", aber höflich.

Ticket: "${ticket?.titel}"
Priorität: ${ticket?.prioritaet}

Verlauf:
${verlauf || "(Noch keine Nachrichten)"}

${makroListe ? `Verfügbare Textbausteine (nutze sie wenn passend):\n${makroListe}` : ""}

Schreibe nur die Antwort, keinen Betreff oder Metadaten.`;

  } else if (aktion === "stimmung") {
    prompt = `Analysiere die Stimmung des Kunden in diesem Support-Ticket. Antworte NUR mit einem JSON-Objekt, kein Text davor oder danach:
{"stimmung": "positiv"|"neutral"|"frustriert"|"dringend", "begruendung": "Ein Satz warum.", "empfehlung": "Kurze Handlungsempfehlung für den Techniker."}

Ticket: "${ticket?.titel}"
Verlauf:
${verlauf || "(Keine Nachrichten)"}`;

  } else if (aktion === "tags") {
    const { data: verfuegbareTags } = await supabase
      .from("tags")
      .select("name")
      .eq("organisation_id", (await supabase.from("tickets").select("organisation_id").eq("id", ticketId).single()).data?.organisation_id);

    const tagListe = (verfuegbareTags ?? []).map((t) => t.name).join(", ");

    prompt = `Analysiere dieses Support-Ticket und schlage passende Tags vor. Antworte NUR mit einem JSON-Array der Tag-Namen, kein Text:
["tag1", "tag2"]

Verfügbare Tags: ${tagListe || "(keine Tags angelegt)"}
Ticket: "${ticket?.titel}"
Verlauf:
${verlauf || "(Keine Nachrichten)"}

Wähle maximal 3 passende Tags aus der Liste. Wenn keiner passt, gib [] zurück.`;
  }

  // Claude API aufrufen
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const antwort = data.content?.[0]?.text ?? "";

  return new Response(
    JSON.stringify({ antwort }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
