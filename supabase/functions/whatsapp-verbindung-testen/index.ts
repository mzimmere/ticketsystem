import { createClient } from "jsr:@supabase/supabase-js@2";

// Prueft die gespeicherte WhatsApp-Verbindung einer Firma gegen die echte
// Meta Graph API - zeigt sofort, ob Phone-Number-ID/Access-Token gueltig
// sind, statt dass ein abgelaufener Token erst beim naechsten Kunden-
// Webhook unbemerkt ins Leere laeuft (der haeufigste Grund fuer "WhatsApp
// geht auf einmal nicht mehr").

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user: aufrufer } } = await supabase.auth.getUser(token);
  if (!aufrufer) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const { organisationId } = await req.json();
  if (!organisationId) {
    return new Response(JSON.stringify({ error: "organisationId ist erforderlich." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: aufruferProfil } = await supabase
    .from("profiles").select("rolle, organisation_id").eq("id", aufrufer.id).single();

  let berechtigt = aufruferProfil?.rolle === "super_admin";
  if (!berechtigt && aufruferProfil?.rolle === "org_admin" && aufruferProfil.organisation_id === organisationId) {
    berechtigt = true;
  }
  if (!berechtigt) {
    const { data: mitgliedschaft } = await supabase
      .from("firmen_mitgliedschaften")
      .select("id")
      .eq("profil_id", aufrufer.id)
      .eq("organisation_id", organisationId)
      .eq("rolle", "org_admin")
      .eq("deaktiviert", false)
      .maybeSingle();
    berechtigt = !!mitgliedschaft;
  }
  if (!berechtigt) {
    return new Response(JSON.stringify({ error: "Keine Berechtigung für diese Firma." }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: org } = await supabase
    .from("organisationen")
    .select("whatsapp_phone_number_id, whatsapp_access_token, whatsapp_app_secret")
    .eq("id", organisationId)
    .single();

  if (!org?.whatsapp_phone_number_id || !org?.whatsapp_access_token) {
    return new Response(JSON.stringify({ ok: false, grund: "nicht_konfiguriert" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // appsecret_proof anhaengen, falls ein App Secret hinterlegt ist -
    // Meta verlangt das, wenn "App-Secret-Proof erforderlich" aktiv ist.
    const proof = org.whatsapp_app_secret
      ? await appsecretProof(org.whatsapp_access_token, org.whatsapp_app_secret)
      : null;
    const proofParam = proof ? `&appsecret_proof=${proof}` : "";

    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${org.whatsapp_phone_number_id}?fields=verified_name,display_phone_number,quality_rating${proofParam}`,
      { headers: { Authorization: `Bearer ${org.whatsapp_access_token}` } },
    );
    const metaJson = await metaRes.json();

    if (!metaRes.ok) {
      const metaFehler = metaJson?.error;
      const istTokenAbgelaufen = metaFehler?.code === 190;
      return new Response(JSON.stringify({
        ok: false,
        grund: istTokenAbgelaufen ? "token_abgelaufen" : "meta_fehler",
        meldung: metaFehler?.message ?? "Unbekannter Fehler von Meta.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      ok: true,
      verifizierterName: metaJson.verified_name,
      telefonnummer: metaJson.display_phone_number,
      qualitaet: metaJson.quality_rating,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, grund: "netzwerk_fehler", meldung: String(err) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// appsecret_proof = HMAC-SHA256(access_token, app_secret) als Hex.
async function appsecretProof(accessToken: string, appSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(accessToken));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
