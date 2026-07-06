// Supabase Edge Function: einen bereits bestehenden Account (egal ob
// vorher Kunde, Mitarbeiter einer anderen Firma, oder noch ohne
// Organisation) der angegebenen Firma mit einer Rolle zuweisen.
//
// Techniker/Org-Admin: fuegt eine zusaetzliche Mitgliedschaft hinzu
// (firmen_mitgliedschaften) - bestehende Mitgliedschaften bei anderen
// Firmen bleiben unangetastet, eine Person kann gleichzeitig bei
// mehreren Firmen aktiv sein.
//
// Kunde: bleibt strikt 1:1 (ein Kunden-Account gehoert genau einer
// Firma) - hier wird weiterhin profiles.organisation_id ueberschrieben,
// mit Warnung falls der Account gerade woanders Kunde ist.
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

function fehlerAntwort(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: authData } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!authData.user) return fehlerAntwort(401, "Nicht eingeloggt");

    const { data: anfragendesProfil } = await supabaseAdmin
      .from("profiles")
      .select("rolle, organisation_id")
      .eq("id", authData.user.id)
      .single();

    if (!anfragendesProfil || !["super_admin", "org_admin"].includes(anfragendesProfil.rolle)) {
      return fehlerAntwort(403, "Nur Org-Admin oder Super-Admin dürfen Nutzer zuweisen.");
    }

    const { email, organisationId, rolle, bestaetigt } = await req.json();

    if (!email || !organisationId || !rolle) {
      return fehlerAntwort(400, "email, organisationId und rolle sind erforderlich");
    }

    // Org-Admin darf nur innerhalb der eigenen Firma zuweisen. Bei
    // Mehrfach-Mitgliedschaft reicht "irgendeine eigene Firma" -
    // deshalb zusaetzlich ueber firmen_mitgliedschaften pruefen.
    if (anfragendesProfil.rolle === "org_admin" && organisationId !== anfragendesProfil.organisation_id) {
      const { data: eigeneMitgliedschaft } = await supabaseAdmin
        .from("firmen_mitgliedschaften")
        .select("id")
        .eq("profil_id", authData.user.id)
        .eq("organisation_id", organisationId)
        .eq("rolle", "org_admin")
        .eq("deaktiviert", false)
        .maybeSingle();
      if (!eigeneMitgliedschaft) {
        return fehlerAntwort(403, "Du kannst Personen nur einer Firma zuweisen, bei der du selbst Org-Admin bist.");
      }
    }

    const erlaubteRollen = ["kunde", "techniker", "org_admin"];
    if (!erlaubteRollen.includes(rolle)) {
      return fehlerAntwort(400, "Ungültige Rolle");
    }

    const { data: userId, error: rpcFehler } = await supabaseAdmin.rpc(
      "get_user_id_by_email",
      { p_email: email },
    );
    if (rpcFehler) throw rpcFehler;

    if (!userId) {
      return fehlerAntwort(404, "Kein Account mit dieser E-Mail gefunden.");
    }

    // Schutz: Ein Super-Admin-Account darf nicht versehentlich auf eine
    // Firmenrolle herabgestuft werden - er hat über "Alle Firmen" ohnehin
    // schon vollen Zugriff auf jede Organisation, ganz ohne Mitgliedschaft.
    const { data: bestehendesProfil } = await supabaseAdmin
      .from("profiles")
      .select("rolle, organisation_id, name")
      .eq("id", userId)
      .single();

    if (bestehendesProfil?.rolle === "super_admin") {
      return fehlerAntwort(
        409,
        "Dieser Account ist Super-Admin und hat bereits vollen Zugriff auf alle Firmen über 'Alle Firmen' - keine Zuweisung nötig (und würde den Super-Admin-Status entfernen).",
      );
    }

    const name = bestehendesProfil?.name ?? email;

    // ---- Techniker / Org-Admin: additive Mitgliedschaft ----
    // Bestehende Mitgliedschaften bei anderen Firmen bleiben unberuehrt -
    // die Person arbeitet danach einfach bei mehreren Firmen gleichzeitig.
    if (rolle === "techniker" || rolle === "org_admin") {
      const { error: upsertFehler } = await supabaseAdmin
        .from("firmen_mitgliedschaften")
        .upsert(
          { profil_id: userId, organisation_id: organisationId, rolle, deaktiviert: false },
          { onConflict: "profil_id,organisation_id" },
        );
      if (upsertFehler) throw upsertFehler;

      // War der Account bisher nur Kunde (oder ganz ohne Firma), auf
      // "intern" hochstufen, damit er die interne Ansicht sieht. Ist er
      // bereits Techniker/Org-Admin (z.B. bei einer anderen Firma), bleibt
      // die globale Rolle unangetastet - massgeblich ist ab jetzt die
      // Mitgliedschaft der jeweils aktiven Firma.
      const updates: Record<string, unknown> = {};
      if (!bestehendesProfil || !["techniker", "org_admin"].includes(bestehendesProfil.rolle)) {
        updates.rolle = rolle;
      }
      if (!bestehendesProfil?.organisation_id) {
        updates.organisation_id = organisationId;
      }
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from("profiles").update(updates).eq("id", userId);
      }

      return new Response(JSON.stringify({ ok: true, userId, name }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Kunde: bleibt strikt 1:1, wie bisher ----
    if (
      !bestaetigt &&
      bestehendesProfil?.organisation_id &&
      bestehendesProfil.organisation_id !== organisationId &&
      bestehendesProfil.rolle === "kunde"
    ) {
      if (anfragendesProfil.rolle === "super_admin") {
        const { data: bisherigeFirma } = await supabaseAdmin
          .from("organisationen")
          .select("name")
          .eq("id", bestehendesProfil.organisation_id)
          .single();
        return new Response(
          JSON.stringify({
            warnung: true,
            meldung: `${name} ist aktuell Kunde bei "${bisherigeFirma?.name ?? "einer anderen Firma"}". Bei Zuweisung wird der Account dort entfernt.`,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          warnung: true,
          meldung: `${name} ist bereits Kunde bei einer anderen Firma. Bei Zuweisung wird der Account dort entfernt.`,
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
    return fehlerAntwort(500, "Zuweisen fehlgeschlagen");
  }
});
