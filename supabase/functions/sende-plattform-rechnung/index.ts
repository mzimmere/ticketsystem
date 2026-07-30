// Supabase Edge Function: Plattform-Rechnung (Super-Admin an Firma) per
// Mail verschicken. Nutzt immer die globalen SMTP_*-Secrets (nie die
// Firmen-eigene Konfiguration), da diese Mails im Namen der Plattform
// verschickt werden, nicht im Namen der Kunden-Firma.
//
// WICHTIG: der eigentliche SMTP-Versand laeuft ueber die Vercel-Function
// api/send-mail.ts (Node.js), NICHT direkt von hier aus - Supabase Edge
// Functions laufen in einer Deno-Sandbox, die rohe TCP-Verbindungen
// blockiert (siehe benachrichtige-kunde fuer den Hintergrund).
//
// Projektpfad: supabase/functions/sende-plattform-rechnung/index.ts
// Deploy: supabase functions deploy sende-plattform-rechnung
// Secrets:
// supabase secrets set MAIL_RELAY_URL=https://deine-domain.vercel.app/api/send-mail MAIL_RELAY_SECRET=...
// supabase secrets set SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASSWORD=... ABSENDER_EMAIL=ticket@deine-domain.de

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function mailSenden(empfaenger: string, betreff: string, text: string, absenderName: string) {
  const host = Deno.env.get("SMTP_HOST");
  const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
  const user = Deno.env.get("SMTP_USER");
  const passwort = Deno.env.get("SMTP_PASSWORD");
  const absender = Deno.env.get("ABSENDER_EMAIL") ?? user;
  if (!host || !user || !passwort || !absender) return { ok: false, grund: "smtp_nicht_konfiguriert" };

  const relayUrl = Deno.env.get("MAIL_RELAY_URL");
  const relaySecret = Deno.env.get("MAIL_RELAY_SECRET");
  if (!relayUrl || !relaySecret) return { ok: false, grund: "relay_nicht_konfiguriert" };

  const relayRes = await fetch(relayUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Relay-Secret": relaySecret },
    body: JSON.stringify({ host, port, user, password: passwort, from: `${absenderName} <${absender}>`, to: empfaenger, subject: betreff, text }),
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

function formatEuro(cent: number): string {
  return (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function monatLabel(monatIso: string): string {
  const [jahr, monat] = monatIso.split("-").map(Number);
  return new Date(jahr, monat - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // Nur ein eingeloggter super_admin darf ausloesen.
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: userData } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Nicht eingeloggt" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: anfragendesProfil } = await supabaseAdmin
      .from("profiles")
      .select("rolle")
      .eq("id", userData.user.id)
      .single();
    if (anfragendesProfil?.rolle !== "super_admin") {
      return new Response(JSON.stringify({ error: "Nur Super-Admin darf Plattform-Rechnungen versenden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { rechnungId } = await req.json();
    if (!rechnungId) {
      return new Response(JSON.stringify({ error: "rechnungId ist erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rechnung, error: rechnungFehler } = await supabaseAdmin
      .from("plattform_rechnungen")
      .select("*")
      .eq("id", rechnungId)
      .single();
    if (rechnungFehler || !rechnung) throw rechnungFehler ?? new Error("Rechnung nicht gefunden");

    const { data: organisation } = await supabaseAdmin
      .from("organisationen")
      .select("name, email")
      .eq("id", rechnung.organisation_id)
      .single();
    if (!organisation?.email) {
      return new Response(JSON.stringify({ ok: false, grund: "keine_email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: absender } = await supabaseAdmin
      .from("plattform_einstellungen")
      .select("firmenname, adresse, email, telefon, ust_id, steuernummer, iban")
      .eq("id", true)
      .single();

    const positionen = (rechnung.positionen as { label: string; betrag_cent: number }[]) ?? [];
    const positionenText = positionen
      .map((p) => `  - ${p.label}: ${formatEuro(p.betrag_cent)}`)
      .join("\n");

    const faelligLabel = rechnung.faellig_am
      ? new Date(rechnung.faellig_am).toLocaleDateString("de-DE")
      : null;
    const rechnungsdatumLabel = new Date(rechnung.rechnungsdatum).toLocaleDateString("de-DE");

    const betreff = `Rechnung ${rechnung.rechnungsnummer} – ${monatLabel(rechnung.monat)}`;
    const text = [
      `Hallo,`,
      ``,
      `anbei die Rechnung ${rechnung.rechnungsnummer} vom ${rechnungsdatumLabel} für ${monatLabel(rechnung.monat)} (Tarif "${rechnung.tarif_name}", ${rechnung.mitarbeiter_anzahl} Mitarbeiter):`,
      ``,
      positionenText,
      ``,
      `Netto: ${formatEuro(rechnung.netto_cent)}`,
      `MwSt. (${Number(rechnung.mwst_satz).toLocaleString("de-DE")} %): ${formatEuro(rechnung.mwst_cent)}`,
      `Gesamt (Brutto): ${formatEuro(rechnung.brutto_cent)}`,
      ``,
      faelligLabel ? `Fällig am ${faelligLabel} (${rechnung.zahlungsziel_tage} Tage Zahlungsziel).` : ``,
      absender?.iban ? `Bitte überweise den Betrag auf IBAN ${absender.iban}.` : ``,
      ``,
      rechnung.freitext ?? "",
      rechnung.rechtlicher_hinweis ?? "",
      ``,
      `— ${absender?.firmenname ?? "Ticketsystem"}`,
      absender?.adresse ?? "",
      [absender?.email, absender?.telefon].filter(Boolean).join(" · "),
      absender?.ust_id ? `USt-IdNr.: ${absender.ust_id}` : absender?.steuernummer ? `Steuernummer: ${absender.steuernummer}` : "",
    ]
      .filter((zeile) => zeile !== null && zeile !== undefined)
      .join("\n");

    const ergebnis = await mailSenden(organisation.email, betreff, text, absender?.firmenname ?? "Ticketsystem");
    if (!ergebnis.ok) {
      return new Response(JSON.stringify(ergebnis), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin
      .from("plattform_rechnungen")
      .update({ status: "versendet", versendet_am: new Date().toISOString() })
      .eq("id", rechnungId);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Plattform-Rechnung-Versand-Fehler:", err);
    return new Response(JSON.stringify({ error: "Versand fehlgeschlagen" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
