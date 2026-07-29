import { createClient } from "jsr:@supabase/supabase-js@2";

// Wird taeglich per pg_cron aufgerufen (Muster: sla-eskalation-pruefen).
// Findet aktive Lizenzvertraege (lizenz_vertraege, Abschnitt 56), die
// einem Kunden zugeordnet sind und deren Vertragsende innerhalb der pro
// Firma konfigurierbaren Frist liegt (lizenz_konfiguration, Abschnitt 57,
// Standard 30 Tage), schickt eine Erinnerungs-Mail und setzt
// erinnerung_gesendet_am (damit nicht bei jedem Lauf erneut benachrichtigt
// wird). Empfaenger: lizenz_konfiguration.erinnerung_email falls gesetzt
// (z.B. Support-Postfach oder eine bestimmte Person), sonst alle Org-Admins
// der Firma. Kunden werden nie kontaktiert. Erstellt/verschickt bewusst
// KEINE Rechnung - das bleibt weiterhin ein manueller Schritt in
// Abrechnung.tsx/RechnungDetail.tsx.
//
// Auth: verify_jwt=false, stattdessen Pruefung gegen dasselbe Shared
// Secret aus Supabase Vault wie bei den anderen Cron-Functions.

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface FaelligerVertrag {
  id: string;
  lizenz_seriennummer: string;
  produkt_name: string;
  vertrag_ende: string;
  kunde: { name: string | null } | null;
}

async function orgAdminEmails(organisationId: string): Promise<string[]> {
  const { data: mitglieder } = await supabase
    .from("firmen_mitgliedschaften")
    .select("profil_id")
    .eq("organisation_id", organisationId)
    .eq("rolle", "org_admin")
    .eq("deaktiviert", false);

  const emails: string[] = [];
  for (const m of mitglieder ?? []) {
    const { data } = await supabase.auth.admin.getUserById(m.profil_id);
    if (data.user?.email) emails.push(data.user.email);
  }
  return emails;
}

async function mailSenden(empfaenger: string[], betreff: string, text: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const absender = Deno.env.get("ABSENDER_EMAIL");
  if (!resendKey || !absender || empfaenger.length === 0) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `Ticketsystem <${absender}>`, to: empfaenger, subject: betreff, text }),
  }).catch((err) => console.error("Resend-Fehler:", err));
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const { data: cronSecret } = await supabase.rpc("get_cron_secret");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const seitenUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "";
  let erinnertGesamt = 0;

  const { data: orgs } = await supabase.from("organisationen").select("id");
  const { data: konfigs } = await supabase
    .from("lizenz_konfiguration")
    .select("organisation_id, erinnerung_tage_vorher, erinnerung_email");
  const tageJeOrg = new Map((konfigs ?? []).map((k) => [k.organisation_id, k.erinnerung_tage_vorher]));
  const emailJeOrg = new Map((konfigs ?? []).map((k) => [k.organisation_id, k.erinnerung_email]));

  for (const org of orgs ?? []) {
    const tage = tageJeOrg.get(org.id) ?? 30;
    const grenze = new Date(Date.now() + tage * 86400000).toISOString().slice(0, 10);

    const { data: vertraege } = await supabase
      .from("lizenz_vertraege")
      .select("id, lizenz_seriennummer, produkt_name, vertrag_ende, kunde:kunde_id(name)")
      .eq("organisation_id", org.id)
      .not("kunde_id", "is", null)
      .not("vertrag_ende", "is", null)
      .ilike("status", "active")
      .lte("vertrag_ende", grenze)
      .is("erinnerung_gesendet_am", null);

    if (!vertraege || vertraege.length === 0) continue;

    const einzelEmail = emailJeOrg.get(org.id);
    const empfaenger = einzelEmail ? [einzelEmail] : await orgAdminEmails(org.id);

    for (const v of vertraege as unknown as FaelligerVertrag[]) {
      await mailSenden(
        empfaenger,
        `Lizenz-Erinnerung: ${v.produkt_name} läuft bald ab`,
        [
          `Die Lizenz ${v.lizenz_seriennummer} (${v.produkt_name}) von ${v.kunde?.name ?? "unbekanntem Kunden"}`,
          `läuft am ${new Date(v.vertrag_ende).toLocaleDateString("de-DE")} ab.`,
          ``,
          `Dies ist nur ein Hinweis - Verlängerung/Rechnung bitte weiterhin manuell erstellen.`,
          seitenUrl ? `` : "",
          seitenUrl ? `Ticketsystem: ${seitenUrl}` : "",
        ].join("\n"),
      );
      await supabase
        .from("lizenz_vertraege")
        .update({ erinnerung_gesendet_am: new Date().toISOString() })
        .eq("id", v.id);
      erinnertGesamt++;
    }
  }

  return new Response(
    JSON.stringify({ erinnert: erinnertGesamt }),
    { headers: { "Content-Type": "application/json" } },
  );
});
