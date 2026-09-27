import { createClient } from "jsr:@supabase/supabase-js@2";

// Wird einmal monatlich per pg_cron aufgerufen (Muster:
// lizenz-erinnerung-pruefen, aber als EIN Sammelbericht statt einer
// Einzel-Mail pro Lizenz). Im Unterschied zu lizenz-erinnerung-pruefen
// (taeglich, pro Firma konfigurierbare Frist, eine Mail PRO faelliger
// Lizenz) fasst diese Function ALLE Lizenzvertraege mit Vertragsende im
// laufenden Kalendermonat in EINER Mail pro Firma zusammen - ist bewusst
// opt-in (lizenz_konfiguration.monatsbericht_aktiv), da nicht jede Firma
// zusaetzlich zu den taeglichen Einzel-Erinnerungen auch noch einen
// Sammelbericht will.
//
// Empfaenger: lizenz_konfiguration.erinnerung_email falls gesetzt, sonst
// alle Org-Admins der Firma (gleiches Muster wie lizenz-erinnerung-pruefen).
// Kunden werden nie kontaktiert. Erstellt/verschickt KEINE Rechnung.
//
// Auth: verify_jwt=false, Pruefung gegen dasselbe Shared Secret aus
// Supabase Vault wie die anderen Cron-Functions.
//
// Projektpfad: supabase/functions/lizenz-monatsbericht/index.ts
// Deploy: supabase functions deploy lizenz-monatsbericht --no-verify-jwt

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface Vertrag {
  lizenz_seriennummer: string;
  produkt_name: string;
  vertrag_ende: string;
  status: string | null;
  kunde: { name: string | null } | null;
  dongle: { seriennummer: string | null } | null;
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

async function smtpKonfigLaden(organisationId: string) {
  const { data } = await supabase
    .from("organisation_smtp_konfiguration")
    .select("smtp_host, smtp_port, smtp_user, smtp_password, absender_email")
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (data?.smtp_host && data.smtp_user && data.smtp_password && data.absender_email) {
    return { host: data.smtp_host, port: data.smtp_port ?? 587, user: data.smtp_user, passwort: data.smtp_password, absender: data.absender_email };
  }

  const host = Deno.env.get("SMTP_HOST");
  const user = Deno.env.get("SMTP_USER");
  const passwort = Deno.env.get("SMTP_PASSWORD");
  const absender = Deno.env.get("ABSENDER_EMAIL") ?? user;
  if (!host || !user || !passwort || !absender) return null;
  return { host, port: Number(Deno.env.get("SMTP_PORT") ?? "587"), user, passwort, absender };
}

async function mailSenden(organisationId: string, empfaenger: string[], betreff: string, text: string) {
  if (empfaenger.length === 0) return;
  const konfig = await smtpKonfigLaden(organisationId);
  if (!konfig) return;

  const relayUrl = Deno.env.get("MAIL_RELAY_URL");
  const relaySecret = Deno.env.get("MAIL_RELAY_SECRET");
  if (!relayUrl || !relaySecret) return;

  try {
    const relayRes = await fetch(relayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Relay-Secret": relaySecret },
      body: JSON.stringify({
        host: konfig.host, port: konfig.port, user: konfig.user, password: konfig.passwort,
        from: `Ticketsystem <${konfig.absender}>`, to: empfaenger, subject: betreff, text,
      }),
    });
    const relayJson = await relayRes.json().catch(() => ({}));
    if (!relayRes.ok || !relayJson.ok) console.error("Relay-Fehler:", relayJson);
  } catch (err) {
    console.error("Relay-Fehler:", err);
  }
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const { data: cronSecret } = await supabase.rpc("get_cron_secret");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const seitenUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "";
  const heute = new Date();
  const monatsStart = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const monatsEnde = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const monatsName = heute.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  const { data: konfigs } = await supabase
    .from("lizenz_konfiguration")
    .select("organisation_id, erinnerung_email")
    .eq("monatsbericht_aktiv", true);

  let berichteVersendet = 0;

  for (const konfig of konfigs ?? []) {
    const { data: vertraege } = await supabase
      .from("lizenz_vertraege")
      .select("lizenz_seriennummer, produkt_name, vertrag_ende, status, kunde:kunde_id(name), dongle:dongle_id(seriennummer)")
      .eq("organisation_id", konfig.organisation_id)
      .not("kunde_id", "is", null)
      .not("vertrag_ende", "is", null)
      .gte("vertrag_ende", monatsStart)
      .lte("vertrag_ende", monatsEnde)
      .order("vertrag_ende");

    const empfaenger = konfig.erinnerung_email
      ? [konfig.erinnerung_email]
      : await orgAdminEmails(konfig.organisation_id);
    if (empfaenger.length === 0) continue;

    const liste = (vertraege ?? []) as unknown as Vertrag[];
    const zeilen = liste.length === 0
      ? [`Keine Lizenz-Verlängerungen in diesem Monat.`]
      : liste.map((v) =>
          `- ${new Date(v.vertrag_ende).toLocaleDateString("de-DE")}: ${v.kunde?.name ?? "Unbekannter Kunde"} – ${v.produkt_name} (${v.lizenz_seriennummer})${v.dongle?.seriennummer ? `, Dongle ${v.dongle.seriennummer}` : ""}${v.status ? ` [${v.status}]` : ""}`,
        );

    await mailSenden(
      konfig.organisation_id,
      empfaenger,
      `Lizenz-Verlängerungen ${monatsName} (${liste.length})`,
      [
        `Übersicht der Lizenz-Verlängerungen für ${monatsName}:`,
        ``,
        ...zeilen,
        ``,
        `Dies ist nur ein Hinweis - Verlängerung/Rechnung bitte weiterhin manuell erstellen.`,
        seitenUrl ? `` : "",
        seitenUrl ? `Ticketsystem: ${seitenUrl}` : "",
      ].join("\n"),
    );
    berichteVersendet++;
  }

  return new Response(
    JSON.stringify({ berichte_versendet: berichteVersendet }),
    { headers: { "Content-Type": "application/json" } },
  );
});
