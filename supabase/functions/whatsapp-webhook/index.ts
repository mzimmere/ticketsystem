// Supabase Edge Function: WhatsApp Cloud API Webhook
// Projektpfad: supabase/functions/whatsapp-webhook/index.ts
//
// Deploy:  supabase functions deploy whatsapp-webhook --no-verify-jwt
// Secrets: supabase secrets set WHATSAPP_VERIFY_TOKEN=... WHATSAPP_ACCESS_TOKEN=...
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sind in Edge Functions automatisch verfügbar)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN")!;
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;

Deno.serve(async (req: Request) => {
  // ----------------------------------------------------------
  // 1) Meta-Webhook-Verifizierung (einmalig beim Einrichten im
  //    Meta App Dashboard unter WhatsApp > Configuration)
  // ----------------------------------------------------------
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Verification failed", { status: 403 });
  }

  // ----------------------------------------------------------
  // 2) Eingehende Nachrichten / Status-Updates
  // ----------------------------------------------------------
  if (req.method === "POST") {
    // TODO vor Produktiveinsatz: X-Hub-Signature-256 Header prüfen
    // (Meta signiert jeden Request mit deinem App Secret – verhindert
    // gefälschte Webhook-Aufrufe von außen)

    const payload = await req.json();

    try {
      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const phoneNumberId = change?.metadata?.phone_number_id;
      const message = change?.messages?.[0];
      const contact = change?.contacts?.[0];

      if (!message || !phoneNumberId) {
        // z.B. nur ein Zustellstatus (delivered/read) – nichts zu tun
        return new Response("ok", { status: 200 });
      }

      const vonNummer: string = message.from; // z.B. "4915112345678"
      const nachrichtId: string = message.id;
      const text: string = message.text?.body ?? "[Nicht-Text-Nachricht, z.B. Bild]";
      const name: string | null = contact?.profile?.name ?? null;

      // a) Organisation über die Meta phone_number_id finden
      const { data: organisation } = await supabase
        .from("organisationen")
        .select("id")
        .eq("whatsapp_phone_number_id", phoneNumberId)
        .single();

      if (!organisation) {
        console.error("Keine Organisation für phone_number_id:", phoneNumberId);
        return new Response("ok", { status: 200 });
      }

      // b) Kunde über Telefonnummer + Organisation finden, sonst anlegen
      let { data: kunde } = await supabase
        .from("profiles")
        .select("id")
        .eq("telefonnummer", vonNummer)
        .eq("organisation_id", organisation.id)
        .maybeSingle();

      if (!kunde) {
        const { data: neuerKunde, error: kundeFehler } = await supabase
          .from("profiles")
          .insert({
            organisation_id: organisation.id,
            rolle: "kunde",
            telefonnummer: vonNummer,
            name,
          })
          .select("id")
          .single();
        if (kundeFehler) throw kundeFehler;
        kunde = neuerKunde;
      }

      // c) Offenes Ticket dieses Kunden suchen, sonst neues anlegen
      let { data: ticket } = await supabase
        .from("tickets")
        .select("id")
        .eq("kunde_id", kunde!.id)
        .not("status", "in", '("geloest","geschlossen")')
        .order("erstellt_am", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!ticket) {
        const { data: neuesTicket, error: ticketFehler } = await supabase
          .from("tickets")
          .insert({
            organisation_id: organisation.id,
            kunde_id: kunde!.id,
            titel: text.slice(0, 80),
            quelle: "whatsapp",
          })
          .select("id")
          .single();
        if (ticketFehler) throw ticketFehler;
        ticket = neuesTicket;
      }

      // d) Nachricht im Thread speichern
      //    (Dedupe über den unique index auf whatsapp_message_id –
      //    Meta sendet Webhooks bei Netzwerkproblemen mehrfach)
      const { error: nachrichtFehler } = await supabase
        .from("ticket_nachrichten")
        .insert({
          ticket_id: ticket!.id,
          quelle: "whatsapp",
          inhalt: text,
          whatsapp_message_id: nachrichtId,
        });

      if (nachrichtFehler && nachrichtFehler.code !== "23505") {
        // 23505 = unique_violation, d.h. Nachricht war schon gespeichert -> ignorieren
        throw nachrichtFehler;
      }

      // e) Kurze Eingangsbestätigung zurückschicken (optional)
      await sendeWhatsAppNachricht(
        phoneNumberId,
        vonNummer,
        "Danke, wir haben deine Anfrage erhalten und melden uns.",
      );

      return new Response("ok", { status: 200 });
    } catch (err) {
      console.error("Webhook-Fehler:", err);
      // Trotzdem 200 zurückgeben – sonst wiederholt Meta die Zustellung
      // immer wieder und du bekommst Duplikate/Spam in den Logs
      return new Response("ok", { status: 200 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

async function sendeWhatsAppNachricht(
  phoneNumberId: string,
  an: string,
  text: string,
) {
  await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: an,
      type: "text",
      text: { body: text },
    }),
  });
}

// TODO als Nächstes:
// - Bilder/Dokumente aus message.type === 'image' | 'document' herunterladen
//   (Media-ID -> Meta-Media-URL -> Download -> Supabase Storage -> anhaenge-Tabelle)
// - Statuswechsel-Benachrichtigungen (Template-Nachrichten) als eigene Funktion,
//   aufgerufen z.B. per DB-Trigger oder vom Dashboard aus bei Statusänderung
