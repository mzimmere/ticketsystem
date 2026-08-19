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

// Verpackt den rohen (einmaligen) Supabase-Link als Query-Parameter einer
// eigenen App-Seite, die erst per Klick weiterleitet - Messenger wie
// WhatsApp rufen geteilte Links selbst auf (Link-Vorschau) und wuerden den
// Einmal-Link sonst schon vor dem eigentlichen Klick verbrauchen.
function vorladeSichererLink(actionLink: string): string {
  const basis = Deno.env.get("PUBLIC_SITE_URL") ?? "";
  return `${basis}/?zugang=${encodeURIComponent(actionLink)}`;
}

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
    const { email, vorname, nachname, organisationId, rolle, passwort } = await req.json();

    if (!email || !organisationId) {
      return new Response(
        JSON.stringify({ error: "email und organisationId sind erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const erlaubteRollen = ["techniker", "org_admin"];
    const gewaehlteRolle = erlaubteRollen.includes(rolle) ? rolle : "techniker";

    // Vorab pruefen statt nur auf den generischen "already registered"-
    // Fehler von auth.admin.createUser()/generateLink() zu reagieren -
    // damit koennen wir dem Admin sagen WO die Mail schon existiert (Rolle
    // + Firma), statt nur "existiert schon" ohne jeden Kontext.
    const { data: bestehenderUserId } = await supabaseAdmin.rpc("get_user_id_by_email", { p_email: email });
    if (bestehenderUserId) {
      const { data: profil } = await supabaseAdmin
        .from("profiles")
        .select("rolle, organisation_id, name")
        .eq("id", bestehenderUserId)
        .maybeSingle();

      let firmenName: string | null = null;
      if (profil?.organisation_id) {
        const { data: org } = await supabaseAdmin
          .from("organisationen")
          .select("name")
          .eq("id", profil.organisation_id)
          .maybeSingle();
        firmenName = org?.name ?? null;
      }

      const rollenLabel: Record<string, string> = {
        kunde: "Kunde",
        techniker: "Mitarbeiter",
        org_admin: "Org-Admin",
        super_admin: "Super-Admin",
      };
      const rolleText = profil ? (rollenLabel[profil.rolle] ?? profil.rolle) : "Account ohne Profil";
      const wer = profil?.name ? `${profil.name} – ` : "";
      const firmaText = firmenName ? ` bei "${firmenName}"` : "";

      return new Response(
        JSON.stringify({
          error: `Für diese E-Mail existiert bereits ein Account: ${wer}${rolleText}${firmaText}. Nutze stattdessen "Bestehenden Nutzer zuweisen", oder lösche den bestehenden Account zuerst, falls er nicht mehr gebraucht wird.`,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const metadaten = {
      organisation_id: organisationId,
      rolle: gewaehlteRolle,
      vorname: vorname ?? null,
      nachname: nachname ?? null,
    };

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
        link: data.properties?.action_link ? vorladeSichererLink(data.properties.action_link) : undefined,
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
