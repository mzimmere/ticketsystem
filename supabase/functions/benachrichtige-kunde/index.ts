// Supabase Edge Function: Kunde per Mail über ein Ticket-Ereignis
// benachrichtigen (z.B. Statuswechsel). Nutzt Resend direkt (nicht den
// Supabase-Auth-Mailer), weil das hier App-eigene Benachrichtigungen sind,
// keine Auth-Mails.
//
// Projektpfad: supabase/functions/benachrichtige-kunde/index.ts
// Deploy: supabase functions deploy benachrichtige-kunde
// Secret: supabase secrets set RESEND_API_KEY=... ABSENDER_EMAIL=ticket@deine-domain.de

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
      text = [
        `Hallo ${kunde?.name ?? ""},`,
        ``,
        `der Status deines Tickets "${ticket.titel}" (#${ticket.ticket_nr}) wurde auf "${statusText}" geändert.`,
        ``,
        `Details ansehen: ${seitenUrl}`,
        ``,
        `— ${firmenName}`,
      ].join("\n");
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

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const absender = Deno.env.get("ABSENDER_EMAIL");
    if (!resendKey || !absender) {
      // Resend noch nicht eingerichtet - kein Fehler, einfach nichts senden
      return new Response(JSON.stringify({ ok: false, grund: "resend_nicht_konfiguriert" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${firmenName} <${absender}>`,
        to: kundeEmail,
        subject: betreff,
        text,
      }),
    });

    if (!resendRes.ok) {
      const fehlerText = await resendRes.text();
      throw new Error(`Resend-Fehler: ${fehlerText}`);
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
