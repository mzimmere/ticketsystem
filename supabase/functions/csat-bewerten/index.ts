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

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Optionales Textfeld nach der Bewertung. Wird per POST an dieselbe Funktion
// geschickt; Ticket, Bewertung und Signatur stammen aus dem (bereits
// geprueften) Link und werden beim Absenden erneut geprueft.
function kommentarFormular(ticketId: string, wert: number, sig: string): string {
  return `<form method="post" style="margin-top:20px;text-align:left">
  <input type="hidden" name="t" value="${esc(ticketId)}">
  <input type="hidden" name="w" value="${wert}">
  <input type="hidden" name="s" value="${esc(sig)}">
  <label for="k" style="display:block;font-size:0.85rem;color:#4d5563;margin-bottom:6px">Möchtest du uns noch etwas mitteilen? (optional)</label>
  <textarea id="k" name="k" rows="4" maxlength="1000" placeholder="Was hat gut funktioniert, was können wir besser machen?"></textarea>
  <button type="submit">Senden</button>
</form>`;
}

function seite(titel: string, text: string, extra = ""): Response {
  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background:#f4f5f7; margin:0; padding:0; }
  .box { max-width: 420px; margin: 15vh auto; background:#fff; border-radius:12px; padding:32px 28px; text-align:center; box-shadow:0 1px 4px rgba(0,0,0,0.08); }
  h1 { font-size: 1.2rem; margin: 0 0 8px; color:#14181f; }
  p { color:#4d5563; font-size:0.95rem; margin:0; line-height:1.5; }
  textarea { width:100%; box-sizing:border-box; border:1px solid #cfd4dc; border-radius:8px; padding:10px; font:inherit; font-size:0.9rem; }
  button { margin-top:10px; background:#0e6e8c; color:#fff; border:0; border-radius:8px; padding:9px 18px; font:inherit; font-size:0.9rem; cursor:pointer; }
</style></head>
<body><div class="box"><h1>${esc(titel)}</h1><p>${esc(text)}</p>${extra}</div></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const istPost = req.method === "POST";
  let ticketId = url.searchParams.get("t");
  let wert = Number(url.searchParams.get("w"));
  let sig = url.searchParams.get("s");
  let kommentar = "";
  if (istPost) {
    const form = await req.formData();
    ticketId = String(form.get("t") ?? "");
    wert = Number(form.get("w"));
    sig = String(form.get("s") ?? "");
    kommentar = String(form.get("k") ?? "").trim().slice(0, 1000);
  }

  // Supabase liefert HTML auf der Standard-Domain nur als text/plain mit
  // CSP-Sandbox aus - die Seite wuerde also als Quelltext erscheinen. Darum
  // rendert die Vercel-Seite /api/csat (api/csat.ts) das Ergebnis und fragt
  // diese Function mit ?format=json ab. Ohne den Parameter bleibt es beim
  // bisherigen HTML (fuer schon verschickte Links).
  const alsJson = url.searchParams.get("format") === "json";
  const antwort = (titel: string, text: string, formular?: { ticketId: string; wert: number; sig: string }) =>
    alsJson
      ? Response.json({ titel, text, formular: formular ?? null })
      : seite(titel, text, formular ? kommentarFormular(formular.ticketId, formular.wert, formular.sig) : "");

  if (!ticketId || (wert !== 1 && wert !== 2) || !sig) {
    return antwort("Ungültiger Link", "Dieser Bewertungslink ist unvollständig oder ungültig.");
  }

  const erwarteteSig = await csatSignatur(ticketId, wert);
  if (erwarteteSig !== sig) {
    return antwort("Ungültiger Link", "Dieser Bewertungslink ist nicht gültig.");
  }

  const { data: ticket } = await supabaseAdmin
    .from("tickets")
    .select("csat_bewertung, csat_kommentar, organisation_id")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) {
    return antwort("Ticket nicht gefunden", "Dieses Ticket existiert nicht (mehr).");
  }

  // Text nachreichen: nur zur Bewertung dieses Links und nur einmal.
  if (istPost) {
    if (ticket.csat_bewertung !== wert) {
      return antwort("Ungültiger Link", "Dieser Bewertungslink ist nicht gültig.");
    }
    if (kommentar && !ticket.csat_kommentar) {
      await supabaseAdmin.from("tickets").update({ csat_kommentar: kommentar }).eq("id", ticketId);
    }
    return antwort("Danke für dein Feedback!", "Deine Nachricht ist angekommen.");
  }

  if (ticket.csat_bewertung !== null) {
    return antwort("Bereits bewertet", "Für dieses Ticket wurde schon eine Bewertung abgegeben. Danke dafür!");
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

  return antwort(
    wert === 1 ? "Danke für dein Feedback! 👍" : "Danke für dein Feedback! 👎",
    `Deine Rückmeldung zu ${firmenName} wurde gespeichert.`,
    { ticketId, wert, sig },
  );
});
