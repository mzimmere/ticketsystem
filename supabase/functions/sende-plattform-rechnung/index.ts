// Supabase Edge Function: Plattform-Rechnung (Super-Admin an Firma) per
// Mail verschicken. Nutzt wie "benachrichtige-kunde" Resend direkt.
//
// Projektpfad: supabase/functions/sende-plattform-rechnung/index.ts
// Deploy: supabase functions deploy sende-plattform-rechnung
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

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const absenderEmail = Deno.env.get("ABSENDER_EMAIL");
    if (!resendKey || !absenderEmail) {
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
        from: `${absender?.firmenname ?? "Ticketsystem"} <${absenderEmail}>`,
        to: organisation.email,
        subject: betreff,
        text,
      }),
    });

    if (!resendRes.ok) {
      const fehlerText = await resendRes.text();
      throw new Error(`Resend-Fehler: ${fehlerText}`);
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
