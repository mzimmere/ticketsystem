// Supabase Edge Function: Kunde per Mail über ein Ticket-Ereignis
// benachrichtigen (z.B. Statuswechsel). Versand per SMTP über das eigene
// Postfach (nicht den Supabase-Auth-Mailer), weil das hier App-eigene
// Benachrichtigungen sind, keine Auth-Mails.
//
// Nutzt zuerst die pro Firma hinterlegte SMTP-Konfiguration
// (organisation_smtp_konfiguration, Abschnitt 60 - jede Firma kann eine
// eigene Absenderadresse haben), sonst Fallback auf die globalen
// SMTP_*-Secrets.
//
// WICHTIG: der eigentliche SMTP-Versand laeuft NICHT direkt aus dieser
// Function heraus, sondern ueber eine kleine Vercel-Function
// (api/send-mail.ts im Projekt-Repo, Node.js-Laufzeit). Grund: Supabase
// Edge Functions laufen in einer Deno-Sandbox, die rohe TCP-Verbindungen
// nach aussen blockiert - jeder direkte SMTP-Versuch von hier aus stuerzt
// sofort mit HTTP 503 ab (kein abfangbarer JS-Fehler). Diese Function
// schickt die Mail-Daten stattdessen per HTTPS an die Vercel-Function,
// die den echten SMTP-Versand macht.
//
// Projektpfad: supabase/functions/benachrichtige-kunde/index.ts
// Deploy: supabase functions deploy benachrichtige-kunde
// Secrets:
// supabase secrets set MAIL_RELAY_URL=https://deine-domain.vercel.app/api/send-mail MAIL_RELAY_SECRET=...
// Fallback-SMTP (falls eine Firma keine eigene Konfiguration hat):
// supabase secrets set SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASSWORD=... ABSENDER_EMAIL=ticket@deine-domain.de

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function smtpKonfigLaden(organisationId: string) {
  const { data } = await supabaseAdmin
    .from("organisation_smtp_konfiguration")
    .select("smtp_host, smtp_port, smtp_user, smtp_password, absender_email")
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (data?.smtp_host && data.smtp_user && data.smtp_password && data.absender_email) {
    return { host: data.smtp_host, port: data.smtp_port ?? 587, user: data.smtp_user, passwort: data.smtp_password, absender: data.absender_email };
  }

  const host = Deno.env.get("SMTP_HOST");
  const user = Deno.env.get("SMTP_USER");
  const passwort = Deno.env.get("SMTP_PASSWORD");
  const absender = Deno.env.get("ABSENDER_EMAIL") ?? user;
  if (!host || !user || !passwort || !absender) return null;
  return { host, port: Number(Deno.env.get("SMTP_PORT") ?? "587"), user, passwort, absender };
}

async function mailSenden(organisationId: string, empfaenger: string, betreff: string, text: string, absenderName: string) {
  const konfig = await smtpKonfigLaden(organisationId);
  if (!konfig) return { ok: false, grund: "smtp_nicht_konfiguriert" };

  const relayUrl = Deno.env.get("MAIL_RELAY_URL");
  const relaySecret = Deno.env.get("MAIL_RELAY_SECRET");
  if (!relayUrl || !relaySecret) return { ok: false, grund: "relay_nicht_konfiguriert" };

  const relayRes = await fetch(relayUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Relay-Secret": relaySecret },
    body: JSON.stringify({
      host: konfig.host, port: konfig.port, user: konfig.user, password: konfig.passwort,
      from: `${absenderName} <${konfig.absender}>`, to: empfaenger, subject: betreff, text,
    }),
  });
  const relayJson = await relayRes.json().catch(() => ({}));
  if (!relayRes.ok || !relayJson.ok) {
    console.error("Relay-Fehler:", relayJson);
    return { ok: false, grund: "relay_fehler" };
  }
  return { ok: true };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Signiert die CSAT-Bewertungslinks (siehe Function "csat-bewerten") mit dem
// Service-Role-Key als HMAC-Geheimnis - der ist in jeder Edge Function ohne
// weitere Konfiguration vorhanden, verhindert also ein zusaetzliches Secret
// nur fuer diesen Zweck. Der Key selbst wird dabei nie verschickt, nur eine
// Pruefsumme ueber Ticket-ID und Bewertung.
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

async function csatLink(ticketId: string, wert: number): Promise<string> {
  const basisUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/csat-bewerten`;
  const sig = await csatSignatur(ticketId, wert);
  return `${basisUrl}?t=${ticketId}&w=${wert}&s=${sig}`;
}

const STATUS_LABEL: Record<string, string> = {
  offen: "Offen",
  in_bearbeitung: "In Bearbeitung",
  wartet_auf_kunde: "Wartet auf dich",
  geloest: "Gelöst",
  geschlossen: "Geschlossen",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { ticketId, ereignis, neuerStatus } = await req.json();
    if (!ticketId) {
      return new Response(JSON.stringify({ error: "ticketId ist erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ticket + Kunde + Organisation laden
    const { data: ticket, error: ticketFehler } = await supabaseAdmin
      .from("tickets")
      .select("ticket_nr, titel, kunde_id, organisation_id")
      .eq("id", ticketId)
      .single();
    if (ticketFehler || !ticket) throw ticketFehler ?? new Error("Ticket nicht gefunden");

    const { data: kunde } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", ticket.kunde_id)
      .single();

    const { data: kundeAuth } = await supabaseAdmin.auth.admin.getUserById(ticket.kunde_id);
    const kundeEmail = kundeAuth.user?.email;
    if (!kundeEmail) {
      return new Response(JSON.stringify({ ok: false, grund: "keine_email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: organisation } = await supabaseAdmin
      .from("organisationen")
      .select("name")
      .eq("id", ticket.organisation_id)
      .single();

    const seitenUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "";
    const firmenName = organisation?.name ?? "Ticketsystem";

    let betreff: string;
    let text: string;

    if (ereignis === "status_geaendert") {
      const statusText = STATUS_LABEL[neuerStatus] ?? neuerStatus;
      betreff = `Ticket #${ticket.ticket_nr}: Status geändert auf "${statusText}"`;
      const zeilen = [
        `Hallo ${kunde?.name ?? ""},`,
        ``,
        `der Status deines Tickets "${ticket.titel}" (#${ticket.ticket_nr}) wurde auf "${statusText}" geändert.`,
        ``,
        `Details ansehen: ${seitenUrl}`,
      ];

      if (neuerStatus === "geschlossen") {
        const linkJa = await csatLink(ticketId, 1);
        const linkNein = await csatLink(ticketId, 2);
        zeilen.push(
          ``,
          `War unsere Hilfe zufriedenstellend?`,
          `👍 Ja: ${linkJa}`,
          `👎 Nicht wirklich: ${linkNein}`,
        );
      }

      zeilen.push(``, `— ${firmenName}`);
      text = zeilen.join("\n");
    } else {
      betreff = `Ticket #${ticket.ticket_nr}: Neue Antwort`;
      text = [
        `Hallo ${kunde?.name ?? ""},`,
        ``,
        `es gibt eine neue Antwort zu deinem Ticket "${ticket.titel}" (#${ticket.ticket_nr}).`,
        ``,
        `Details ansehen: ${seitenUrl}`,
        ``,
        `— ${firmenName}`,
      ].join("\n");
    }

    const ergebnis = await mailSenden(ticket.organisation_id, kundeEmail, betreff, text, firmenName);
    if (!ergebnis.ok) {
      // SMTP noch nicht eingerichtet - kein Fehler, einfach nichts senden
      return new Response(JSON.stringify(ergebnis), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Benachrichtigungs-Fehler:", err);
    return new Response(JSON.stringify({ error: "Benachrichtigung fehlgeschlagen" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
