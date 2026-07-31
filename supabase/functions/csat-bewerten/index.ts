// Oeffentliche Edge Function: wird direkt aus den 👍/👎-Links in der
// "Ticket geschlossen"-Mail (benachrichtige-kunde) angeklickt - ganz ohne
// Login, damit die Huerde fuer eine Bewertung so klein wie moeglich ist.
// verify_jwt=false, weil das ein simpler Klick aus einem Mail-Client ist,
// kein authentifizierter App-Request. Stattdessen wird die Signatur (HMAC
// ueber Ticket-ID + Bewertung, Schluessel = Service-Role-Key) geprueft, damit
// niemand beliebige Tickets ueber geratene URLs bewerten kann.
//
// Projektpfad: supabase/functions/csat-bewerten/index.ts
// Deploy: supabase functions deploy csat-bewerten --no-verify-jwt

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function csatSignatur(ticketId: string, wert: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ticketId}:${wert}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function seite(titel: string, text: string): Response {
  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titel}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background:#f4f5f7; margin:0; padding:0; }
  .box { max-width: 420px; margin: 15vh auto; background:#fff; border-radius:12px; padding:32px 28px; text-align:center; box-shadow:0 1px 4px rgba(0,0,0,0.08); }
  h1 { font-size: 1.2rem; margin: 0 0 8px; color:#14181f; }
  p { color:#4d5563; font-size:0.95rem; margin:0; line-height:1.5; }
</style></head>
<body><div class="box"><h1>${titel}</h1><p>${text}</p></div></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const ticketId = url.searchParams.get("t");
  const wert = Number(url.searchParams.get("w"));
  const sig = url.searchParams.get("s");

  if (!ticketId || (wert !== 1 && wert !== 2) || !sig) {
    return seite("Ungültiger Link", "Dieser Bewertungslink ist unvollständig oder ungültig.");
  }

  const erwarteteSig = await csatSignatur(ticketId, wert);
  if (erwarteteSig !== sig) {
    return seite("Ungültiger Link", "Dieser Bewertungslink ist nicht gültig.");
  }

  const { data: ticket } = await supabaseAdmin
    .from("tickets")
    .select("csat_bewertung, organisation_id")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) {
    return seite("Ticket nicht gefunden", "Dieses Ticket existiert nicht (mehr).");
  }

  if (ticket.csat_bewertung !== null) {
    return seite("Bereits bewertet", "Für dieses Ticket wurde schon eine Bewertung abgegeben. Danke dafür!");
  }

  const { data: organisation } = await supabaseAdmin
    .from("organisationen")
    .select("name")
    .eq("id", ticket.organisation_id)
    .maybeSingle();
  const firmenName = organisation?.name ?? "uns";

  await supabaseAdmin
    .from("tickets")
    .update({ csat_bewertung: wert, csat_am: new Date().toISOString() })
    .eq("id", ticketId);

  return seite(
    wert === 1 ? "Danke für dein Feedback! 👍" : "Danke für dein Feedback! 👎",
    `Deine Rückmeldung zu ${firmenName} wurde gespeichert.`,
  );
});
