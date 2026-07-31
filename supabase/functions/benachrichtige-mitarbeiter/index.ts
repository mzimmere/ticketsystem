// Supabase Edge Function: zugewiesenen Techniker per Mail ueber ein
// Ticket-Ereignis benachrichtigen (Neu-Zuweisung, Statusaenderung durch
// eine andere Person, neue Kundenantwort). Wird von einer authentifizierten
// Sitzung aufgerufen (Techniker/Org-Admin ODER Kunde im Portal), NICHT nur
// von Mitarbeitern - der Kunde loest z.B. bei einer neuen Antwort selbst
// diese Function aus.
//
// Verschickt bewusst KEINE Mail, wenn der aufrufende Nutzer selbst der
// zugewiesene Techniker ist (kein Sinn, sich ueber die eigene Aktion zu
// benachrichtigen) - das wird serverseitig anhand des Auth-Tokens
// geprueft, nicht anhand eines vom Client mitgeschickten Felds.
//
// SMTP-Versand laeuft wie bei benachrichtige-kunde ueber die Vercel-
// Relay-Function (api/send-mail.ts), da Supabase Edge Functions keine
// rohen TCP-Verbindungen aufbauen koennen. Nutzt zuerst die pro Firma
// hinterlegte SMTP-Konfiguration (organisation_smtp_konfiguration,
// Abschnitt 60), sonst Fallback auf die globalen SMTP_*-Secrets.
//
// Projektpfad: supabase/functions/benachrichtige-mitarbeiter/index.ts
// Deploy: supabase functions deploy benachrichtige-mitarbeiter
// Secrets: siehe benachrichtige-kunde (MAIL_RELAY_URL/MAIL_RELAY_SECRET,
// SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD/ABSENDER_EMAIL als Fallback).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

const STATUS_LABEL: Record<string, string> = {
  offen: "Offen",
  in_bearbeitung: "In Bearbeitung",
  wartet_auf_kunde: "Wartet auf Kunde",
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

    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: userData } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Nicht eingeloggt" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ticket, error: ticketFehler } = await supabaseAdmin
      .from("tickets")
      .select("ticket_nr, titel, organisation_id, zugewiesen_an")
      .eq("id", ticketId)
      .single();
    if (ticketFehler || !ticket) throw ticketFehler ?? new Error("Ticket nicht gefunden");

    if (!ticket.zugewiesen_an) {
      return new Response(JSON.stringify({ ok: false, grund: "nicht_zugewiesen" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (ticket.zugewiesen_an === userData.user.id) {
      // Eigene Aktion - keine Benachrichtigung ueber sich selbst.
      return new Response(JSON.stringify({ ok: false, grund: "selbst" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: technikerAuth } = await supabaseAdmin.auth.admin.getUserById(ticket.zugewiesen_an);
    const technikerEmail = technikerAuth.user?.email;
    if (!technikerEmail) {
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

    if (ereignis === "zugewiesen") {
      betreff = `Ticket #${ticket.ticket_nr} wurde dir zugewiesen`;
      text = [
        `Das Ticket "${ticket.titel}" (#${ticket.ticket_nr}) wurde dir zugewiesen.`,
        ``,
        `Ticket ansehen: ${seitenUrl}`,
      ].join("\n");
    } else if (ereignis === "status_geaendert") {
      const statusText = STATUS_LABEL[neuerStatus] ?? neuerStatus;
      betreff = `Ticket #${ticket.ticket_nr}: Status geändert auf "${statusText}"`;
      text = [
        `Der Status deines Tickets "${ticket.titel}" (#${ticket.ticket_nr}) wurde von einer anderen Person auf "${statusText}" geändert.`,
        ``,
        `Ticket ansehen: ${seitenUrl}`,
      ].join("\n");
    } else {
      betreff = `Ticket #${ticket.ticket_nr}: Neue Kundenantwort`;
      text = [
        `Der Kunde hat auf dein Ticket "${ticket.titel}" (#${ticket.ticket_nr}) geantwortet.`,
        ``,
        `Ticket ansehen: ${seitenUrl}`,
      ].join("\n");
    }

    const ergebnis = await mailSenden(ticket.organisation_id, technikerEmail, betreff, text, firmenName);
    return new Response(JSON.stringify(ergebnis), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Mitarbeiter-Benachrichtigungs-Fehler:", err);
    return new Response(JSON.stringify({ error: "Benachrichtigung fehlgeschlagen" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
