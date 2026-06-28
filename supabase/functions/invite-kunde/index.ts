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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // TODO vor Produktiveinsatz: Auth-Header des aufrufenden Nutzers prüfen
    // und sicherstellen, dass er org_admin/super_admin für genau diese
    // organisationId ist. Sonst könnte theoretisch jeder eingeloggte
    // Nutzer Kunden in fremde Organisationen einladen.

    const { email, name, organisationId } = await req.json();

    if (!email || !organisationId) {
      return new Response(
        JSON.stringify({ error: "email und organisationId sind erforderlich" }),
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        organisation_id: organisationId,
        rolle: "kunde",
        name: name ?? null,
      },
    });

    if (error) throw error;

    // Der Trigger trg_handle_new_user (siehe SQL-Schema, Abschnitt 9)
    // legt jetzt automatisch die passende profiles-Zeile an.

    return new Response(JSON.stringify({ ok: true, userId: data.user?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Einladungs-Fehler:", err);
    return new Response(JSON.stringify({ error: "Einladung fehlgeschlagen" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
