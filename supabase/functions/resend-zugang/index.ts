// Supabase Edge Function: Neuen Zugangslink für einen bereits bestehenden
// Nutzer erzeugen (z.B. wenn der ursprüngliche Einladungslink abgelaufen ist).
// Nutzt type "recovery" statt "invite", weil "invite" nur für brandneue
// Nutzer gedacht ist - für bereits existierende Accounts ist "recovery"
// der richtige Mechanismus, um einen frischen "Passwort setzen"-Link zu
// bekommen. Unsere App behandelt beide Link-Typen ohnehin gleich.
//
// Projektpfad: supabase/functions/resend-zugang/index.ts
// Deploy: supabase functions deploy resend-zugang

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // TODO vor Produktiveinsatz: Auth-Header des Aufrufers prüfen
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId ist erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: nutzerDaten, error: nutzerFehler } =
      await supabaseAdmin.auth.admin.getUserById(userId);
    if (nutzerFehler || !nutzerDaten.user?.email) {
      throw nutzerFehler ?? new Error("Nutzer nicht gefunden");
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: nutzerDaten.user.email,
      options: {
        redirectTo: Deno.env.get("PUBLIC_SITE_URL"),
      },
    });
    if (error) throw error;

    return new Response(
      JSON.stringify({
        ok: true,
        email: nutzerDaten.user.email,
        link: data.properties?.action_link,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Fehler beim Neu-Erzeugen des Links:", err);
    return new Response(JSON.stringify({ error: "Link konnte nicht erzeugt werden" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
