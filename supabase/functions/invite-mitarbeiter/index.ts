// Supabase Edge Function: Mitarbeiter (Techniker/Org-Admin) einladen
// Projektpfad: supabase/functions/invite-mitarbeiter/index.ts
// Deploy: supabase functions deploy invite-mitarbeiter

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
    // TODO vor Produktiveinsatz: Auth-Header des Aufrufers prüfen
    // (org_admin/super_admin der jeweiligen Organisation)
    const { email, name, organisationId, rolle } = await req.json();

    if (!email || !organisationId) {
      return new Response(
        JSON.stringify({ error: "email und organisationId sind erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const erlaubteRollen = ["techniker", "org_admin"];
    const gewaehlteRolle = erlaubteRollen.includes(rolle) ? rolle : "techniker";

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        organisation_id: organisationId,
        rolle: gewaehlteRolle,
        name: name ?? null,
      },
      redirectTo: Deno.env.get("PUBLIC_SITE_URL"),
    });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, userId: data.user?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Einladungs-Fehler:", err);
    return new Response(JSON.stringify({ error: "Einladung fehlgeschlagen" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
