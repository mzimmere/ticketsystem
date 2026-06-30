// Supabase Edge Function: einen bereits bestehenden Account (egal ob
// vorher Kunde, Mitarbeiter einer anderen Firma, oder noch ohne
// Organisation) der angegebenen Firma mit einer Rolle zuweisen.
//
// Projektpfad: supabase/functions/zuweise-bestehenden-nutzer/index.ts
// Deploy: supabase functions deploy zuweise-bestehenden-nutzer

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
    const { email, organisationId, rolle } = await req.json();

    if (!email || !organisationId || !rolle) {
      return new Response(
        JSON.stringify({ error: "email, organisationId und rolle sind erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const erlaubteRollen = ["kunde", "techniker", "org_admin"];
    if (!erlaubteRollen.includes(rolle)) {
      return new Response(JSON.stringify({ error: "Ungültige Rolle" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userId, error: rpcFehler } = await supabaseAdmin.rpc(
      "get_user_id_by_email",
      { p_email: email },
    );
    if (rpcFehler) throw rpcFehler;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Kein Account mit dieser E-Mail gefunden." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Schutz: Ein Super-Admin-Account darf nicht versehentlich auf eine
    // Firmenrolle herabgestuft werden - er hat über "Alle Firmen" ohnehin
    // schon vollen Zugriff auf jede Organisation, ganz ohne Mitgliedschaft.
    const { data: bestehendesProfil } = await supabaseAdmin
      .from("profiles")
      .select("rolle")
      .eq("id", userId)
      .single();

    if (bestehendesProfil?.rolle === "super_admin") {
      return new Response(
        JSON.stringify({
          error:
            "Dieser Account ist Super-Admin und hat bereits vollen Zugriff auf alle Firmen über 'Alle Firmen' - keine Zuweisung nötig (und würde den Super-Admin-Status entfernen).",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: profil, error: updateFehler } = await supabaseAdmin
      .from("profiles")
      .update({ organisation_id: organisationId, rolle, deaktiviert: false })
      .eq("id", userId)
      .select("id, name")
      .single();
    if (updateFehler) throw updateFehler;

    return new Response(JSON.stringify({ ok: true, userId: profil.id, name: profil.name }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Zuweisungs-Fehler:", err);
    return new Response(JSON.stringify({ error: "Zuweisen fehlgeschlagen" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
