// Supabase Edge Function: neuen Zugangslink für eine bestehende Person erzeugen
// Projektpfad: supabase/functions/neuer-zugangslink/index.ts
// Deploy: supabase functions deploy neuer-zugangslink
//
// Nutzt type "recovery" - das funktioniert für JEDE bestehende Person,
// egal ob sie ursprünglich per Einladungslink oder mit direktem Passwort
// angelegt wurde. Login.tsx erkennt "type=recovery" in der URL und zeigt
// automatisch "Passwort festlegen" (siehe App.tsx kommtVonAuthLink()).

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
    // (org_admin/super_admin der jeweiligen Organisation)
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId ist erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData, error: userFehler } = await supabaseAdmin.auth.admin.getUserById(
      userId,
    );
    if (userFehler || !userData.user?.email) {
      throw userFehler ?? new Error("Nutzer nicht gefunden");
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: userData.user.email,
      options: {
        redirectTo: Deno.env.get("PUBLIC_SITE_URL"),
      },
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        ok: true,
        email: userData.user.email,
        link: data.properties?.action_link,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Fehler beim Erzeugen des Zugangslinks:", err);
    return new Response(JSON.stringify({ error: "Konnte keinen neuen Link erzeugen" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
