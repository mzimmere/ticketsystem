// Supabase Edge Function: Kunde einladen
// Projektpfad: supabase/functions/invite-kunde/index.ts
// Deploy: supabase functions deploy invite-kunde
//
// Aufruf vom Admin-Dashboard aus, z.B.:
//   await fetch(`${SUPABASE_URL}/functions/v1/invite-kunde`, {
//     method: "POST",
//     headers: { Authorization: `Bearer ${session.access_token}` },
//     body: JSON.stringify({ email, name, organisationId }),
//   });

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// CORS: nötig, weil diese Function direkt aus dem Browser (Vercel-Domain)
// aufgerufen wird. Ohne diese Header blockt der Browser den Request schon
// beim Preflight (OPTIONS), bevor er überhaupt bei der Function ankommt.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // TODO vor Produktiveinsatz: Auth-Header des aufrufenden Nutzers prüfen
    // und sicherstellen, dass er org_admin/super_admin für genau diese
    // organisationId ist. Sonst könnte theoretisch jeder eingeloggte
    // Nutzer Kunden in fremde Organisationen einladen.

    const { email, name, organisationId, passwort } = await req.json();

    if (!email || !organisationId) {
      return new Response(
        JSON.stringify({ error: "email und organisationId sind erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const metadaten = {
      organisation_id: organisationId,
      rolle: "kunde",
      name: name ?? null,
    };

    // Mit Passwort: Account wird sofort nutzbar angelegt, keine Mail nötig
    // (Fallback, falls der Mail-Versand mal nicht funktioniert).
    // Ohne Passwort: normaler Einladungs-Link per Mail, wie bisher.
    // Mit Passwort: Account wird sofort nutzbar angelegt, keine Mail nötig
    // (Fallback, falls der Mail-Versand mal nicht funktioniert).
    // Ohne Passwort: Link wird erzeugt, aber NICHT automatisch verschickt -
    // das Frontend zeigt ihn an, damit du ihn per WhatsApp/Mail/Kopieren
    // selbst weitergeben kannst (umgeht Supabase's Mail-Limits komplett).
    if (passwort) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: passwort,
        email_confirm: true,
        user_metadata: metadaten,
      });
      if (error) throw error;

      return new Response(JSON.stringify({ ok: true, userId: data.user?.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: metadaten,
        redirectTo: Deno.env.get("PUBLIC_SITE_URL"),
      },
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        ok: true,
        userId: data.user?.id,
        link: data.properties?.action_link,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Einladungs-Fehler:", err);
    const meldung = err instanceof Error ? err.message : String(err);
    if (meldung.toLowerCase().includes("already") || meldung.toLowerCase().includes("registered")) {
      return new Response(
        JSON.stringify({
          error:
            "Für diese E-Mail existiert schon ein Account. Nutze stattdessen 'Bestehenden Nutzer zuweisen'.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: "Einladung fehlgeschlagen" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
