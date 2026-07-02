import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Aufrufenden Nutzer prüfen
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user: aufrufer } } = await supabase.auth.getUser(token);
  if (!aufrufer) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const { data: aufruferProfil } = await supabase
    .from("profiles").select("rolle, organisation_id").eq("id", aufrufer.id).single();

  if (!aufruferProfil || !["org_admin", "super_admin"].includes(aufruferProfil.rolle)) {
    return new Response("Nur Admins dürfen E-Mails ändern.", { status: 403, headers: corsHeaders });
  }

  const { nutzerId, neueEmail } = await req.json();
  if (!nutzerId || !neueEmail?.includes("@")) {
    return new Response(JSON.stringify({ error: "nutzerId und gültige neueEmail erforderlich." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Sicherstellen, dass der Nutzer zur gleichen Firma gehört
  const { data: zielProfil } = await supabase
    .from("profiles").select("organisation_id, rolle").eq("id", nutzerId).single();

  if (!zielProfil) {
    return new Response(JSON.stringify({ error: "Nutzer nicht gefunden." }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Org-Admin darf nur eigene Firma ändern, Super-Admin alles
  if (aufruferProfil.rolle === "org_admin" &&
      zielProfil.organisation_id !== aufruferProfil.organisation_id) {
    return new Response(JSON.stringify({ error: "Keine Berechtigung für Nutzer aus anderer Firma." }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { error } = await supabase.auth.admin.updateUserById(nutzerId, {
    email: neueEmail.trim().toLowerCase(),
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
