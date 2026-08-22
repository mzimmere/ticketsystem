// Oeffentliche Edge Function: liefert ein unsichtbares 1x1-Pixel aus, das in
// bestimmte Mails eingebettet wird (aktuell nur die Lizenz-Update-Einladung,
// siehe benachrichtige-kunde). Wird das Bild vom Mailclient des Empfaengers
// nachgeladen, gilt die Mail als "geoeffnet" - dient als Beleg, WANN eine
// Benachrichtigung beim Kunden ankam, falls spaeter behauptet wird, man habe
// nichts davon erfahren.
//
// KEIN verlaesslicher Nachweis im strengen Sinn: manche Mailclients laden
// Bilder nie nach (dann bleibt geoeffnet_am leer, obwohl gelesen wurde),
// andere (z.B. Apple Mail "Mail-Datenschutz") laden JEDES Bild sofort beim
// Empfang vor, unabhaengig davon ob der Nutzer die Mail je geoeffnet hat
// (dann steht ein Zeitstempel, der nichts über echtes Lesen aussagt). Es ist
// also nur ein Anhaltspunkt, kein Beweis.
//
// verify_jwt=false, weil ein Mailclient keinen Supabase-Login mitschickt -
// stattdessen ist der Token selbst schon der Zugriffsschluessel (zufaellig,
// pro versendeter Mail einzigartig, siehe email_sendungen.pixel_token).
//
// Projektpfad: supabase/functions/mail-pixel/index.ts
// Deploy: supabase functions deploy mail-pixel --no-verify-jwt

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Kleinstmoegliches transparentes GIF (1x1 Pixel), 43 Bytes.
const PIXEL_GIF = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="),
  (c) => c.charCodeAt(0),
);

function pixelAntwort(): Response {
  return new Response(PIXEL_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t");
    if (token) {
      // Nur beim ERSTEN Aufruf setzen - spaetere Aufrufe (z.B. erneutes
      // Oeffnen derselben Mail) sollen den urspruenglichen Zeitstempel nicht
      // ueberschreiben.
      await supabaseAdmin
        .from("email_sendungen")
        .update({ geoeffnet_am: new Date().toISOString() })
        .eq("pixel_token", token)
        .is("geoeffnet_am", null);
    }
  } catch (err) {
    // Nie einen Fehler nach aussen geben - das Bild muss in jedem Fall
    // ausgeliefert werden, sonst faellt der Ladefehler im Mailclient auf.
    console.error("mail-pixel Fehler:", err);
  }
  return pixelAntwort();
});
