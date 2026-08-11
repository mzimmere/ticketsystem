import { createClient } from "jsr:@supabase/supabase-js@2";

// Wird alle 5 Minuten per pg_cron aufgerufen (Muster: sla-eskalation-pruefen).
// Fragt fuer jede Firma mit konfiguriertem Support-Postfach
// (organisationen.inbound_email_adresse + organisation_smtp_konfiguration
// mit imap_host) ueber die Vercel-Relay-Function api/check-mail.ts das
// Postfach per IMAP nach neuen Mails ab (Supabase Edge Functions koennen
// selbst kein IMAP/SMTP - siehe api/send-mail.ts fuer den Hintergrund).
//
// Fuer jede neue Mail: zuerst gegen die Absender-Domain-Sperrliste der
// Firma pruefen (email_sperrliste, Verwaltung -> Integrationen), danach
// generisch (firmenunabhaengig) pruefen ob es sich um eine automatische
// Unzustellbarkeits-/Bounce-Mail handelt (istBounceNachricht - Absender
// postmaster@/mailer-daemon@ oder typischer Bounce-Betreff). Beides
// wichtig gegen Bounce-Schleifen, wenn eine Kunden-Benachrichtigung an
// eine ungueltige Adresse bounct (oder - wie bei novadent.de am
// 2026-08-11 - eine fremde Mail-Journal-Regel einen Loop ausloest) und
// die Rueckmeldung im eigenen Support-Postfach landet. Danach: Kunde per
// Absenderadresse finden oder anlegen, bestehendes Ticket per
// "#<Nummer>" im Betreff finden oder neues Ticket anlegen, Nachricht +
// Anhaenge speichern. Dedupe zusaetzlich ueber den unique index auf
// ticket_nachrichten.email_message_id (Mails koennten sonst durch
// Retries/Ueberschneidungen doppelt landen).
//
// Auth: verify_jwt=false, stattdessen Pruefung gegen dasselbe Shared
// Secret aus Supabase Vault wie bei den anderen Cron-Functions.

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function sichererDateiname(name: string): string {
  const punkt = name.lastIndexOf(".");
  const hatEndung = punkt > 0 && punkt < name.length - 1;
  const basis = hatEndung ? name.slice(0, punkt) : name;
  const endung = hatEndung ? name.slice(punkt + 1) : "";

  const sicherBasis = basis
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  const sichereEndung = endung.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  if (!sicherBasis) return sichereEndung ? `datei.${sichereEndung}` : "datei";
  return sichereEndung ? `${sicherBasis}.${sichereEndung}` : sicherBasis;
}

interface OrgMitPostfach {
  organisation_id: string;
  smtp_user: string;
  smtp_password: string;
  imap_host: string;
  imap_port: number;
}

interface MailAnhang {
  filename: string;
  contentType: string;
  contentBase64: string;
}

interface AbgerufeneMail {
  messageId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  text: string;
  anhaenge: MailAnhang[];
}

async function mailsAbrufen(konfig: OrgMitPostfach): Promise<AbgerufeneMail[]> {
  const relayUrl = Deno.env.get("MAIL_RELAY_URL");
  const relaySecret = Deno.env.get("MAIL_RELAY_SECRET");
  if (!relayUrl || !relaySecret) return [];

  const checkMailUrl = relayUrl.replace(/\/send-mail$/, "/check-mail");
  const res = await fetch(checkMailUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Relay-Secret": relaySecret },
    body: JSON.stringify({
      host: konfig.imap_host,
      port: konfig.imap_port,
      user: konfig.smtp_user,
      password: konfig.smtp_password,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    console.error("IMAP-Relay-Fehler fuer Firma", konfig.organisation_id, ":", json);
    return [];
  }
  return (json.mails as AbgerufeneMail[]) ?? [];
}

// Findet den Kunden-Kontakt fuer eine eingehende Mail. Reihenfolge:
// 1. Bereits als Kunde DIESER Firma bekannt?
// 2. Gehoert die Adresse schon IRGENDEINEM Account (Mitarbeiter, Kunde
//    einer anderen Firma)? auth.admin.createUser() wuerde sonst mit
//    "already registered" fehlschlagen und die Mail wuerde stillschweigend
//    uebersprungen - stattdessen diesen bestehenden Account als Kontakt
//    des Tickets verwenden.
// 3. Sonst: neuen Kunden-Account anlegen.
async function kundeFindenOderAnlegen(organisationId: string, email: string, name: string | null): Promise<string | null> {
  const { data: bestehenderKunde } = await supabase.rpc("get_kunde_id_by_email", {
    p_organisation_id: organisationId,
    p_email: email,
  });
  if (bestehenderKunde) return bestehenderKunde as string;

  const { data: bestehenderNutzer } = await supabase.rpc("get_user_id_by_email", { p_email: email });
  if (bestehenderNutzer) return bestehenderNutzer as string;

  const teile = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const vorname = teile.length > 0 ? teile[0] : null;
  const nachname = teile.length > 1 ? teile.slice(1).join(" ") : null;

  const { data: neuerNutzer, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { organisation_id: organisationId, rolle: "kunde", vorname, nachname },
  });
  if (error || !neuerNutzer.user) {
    console.error("Kunde-Anlegen-Fehler fuer", email, ":", error);
    return null;
  }
  return neuerNutzer.user.id;
}

function domainAusAdresse(email: string): string {
  return (email.split("@")[1] ?? "").trim().toLowerCase();
}

async function gesperrteDomains(organisationId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("email_sperrliste")
    .select("domain")
    .eq("organisation_id", organisationId);
  return new Set((data ?? []).map((d) => d.domain.toLowerCase()));
}

// Erkennt automatisch generierte Unzustellbarkeits-/Bounce-Mails (NDRs),
// unabhaengig von der Absender-Domain - im Unterschied zur manuellen
// Sperrliste (Abschnitt 67) greift das bei JEDER Firma sofort, ohne dass
// erst eine konkrete Domain eingetragen werden muss. Faelle wie am
// 2026-08-11 (novadent.de: eigene Exchange-Journal-Regel loest bei 1&1
// einen "Mail loop suspected"-Fehler aus, novadents Exchange schickt die
// NDR an unser Postfach zurueck) sind so schon beim allerersten Auftreten
// abgedeckt, nicht erst nachdem manuell eine Domain gesperrt wurde.
const BOUNCE_ABSENDER = /^(postmaster|mailer-daemon|mail-daemon|mailmaster)$/i;
const BOUNCE_BETREFF =
  /^(unzustellbar|undeliverable|undelivered|nichtzustellbar|mail delivery (failed|subsystem)|delivery status notification|returned mail|automatisch generierte nachricht)/i;

function istBounceNachricht(fromEmail: string, subject: string): boolean {
  const lokalerTeil = fromEmail.split("@")[0] ?? "";
  if (BOUNCE_ABSENDER.test(lokalerTeil)) return true;
  if (BOUNCE_BETREFF.test(subject.trim())) return true;
  return false;
}

async function ticketFindenOderAnlegen(organisationId: string, kundeId: string, betreff: string): Promise<string> {
  const nummerMatch = betreff.match(/#(\d+)/);
  if (nummerMatch) {
    const { data: bestehendesTicket } = await supabase
      .from("tickets")
      .select("id")
      .eq("organisation_id", organisationId)
      .eq("kunde_id", kundeId)
      .eq("ticket_nr", Number(nummerMatch[1]))
      .maybeSingle();
    if (bestehendesTicket) return bestehendesTicket.id;
  }

  const { data: neuesTicket, error } = await supabase
    .from("tickets")
    .insert({
      organisation_id: organisationId,
      kunde_id: kundeId,
      titel: betreff.trim().slice(0, 80) || "E-Mail ohne Betreff",
      quelle: "email",
    })
    .select("id")
    .single();
  if (error || !neuesTicket) throw error ?? new Error("Ticket konnte nicht angelegt werden");
  return neuesTicket.id;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const { data: cronSecret } = await supabase.rpc("get_cron_secret");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let importiertGesamt = 0;

  const { data: organisationen } = await supabase
    .from("organisationen")
    .select("id, inbound_email_adresse")
    .not("inbound_email_adresse", "is", null);

  for (const org of organisationen ?? []) {
    const { data: smtpKonfig } = await supabase
      .from("organisation_smtp_konfiguration")
      .select("smtp_user, smtp_password, imap_host, imap_port")
      .eq("organisation_id", org.id)
      .maybeSingle();

    if (!smtpKonfig?.smtp_user || !smtpKonfig.smtp_password || !smtpKonfig.imap_host) continue;

    const mails = await mailsAbrufen({
      organisation_id: org.id,
      smtp_user: smtpKonfig.smtp_user,
      smtp_password: smtpKonfig.smtp_password,
      imap_host: smtpKonfig.imap_host,
      imap_port: smtpKonfig.imap_port,
    });
    const sperrliste = mails.length > 0 ? await gesperrteDomains(org.id) : new Set<string>();

    for (const mail of mails) {
      try {
        if (!mail.fromEmail) continue;
        if (sperrliste.has(domainAusAdresse(mail.fromEmail))) continue;
        if (istBounceNachricht(mail.fromEmail, mail.subject)) continue;

        const kundeId = await kundeFindenOderAnlegen(org.id, mail.fromEmail, mail.fromName);
        if (!kundeId) continue;

        const ticketId = await ticketFindenOderAnlegen(org.id, kundeId, mail.subject);

        const { data: nachricht, error: nachrichtFehler } = await supabase
          .from("ticket_nachrichten")
          .insert({
            ticket_id: ticketId,
            quelle: "email",
            inhalt: mail.text.trim() || null,
            email_message_id: mail.messageId,
          })
          .select("id")
          .single();

        if (nachrichtFehler) {
          if (nachrichtFehler.code === "23505") continue; // schon verarbeitet
          throw nachrichtFehler;
        }

        for (const anhang of mail.anhaenge) {
          const pfad = `${ticketId}/${Date.now()}-${sichererDateiname(anhang.filename)}`;
          const bytes = Uint8Array.from(atob(anhang.contentBase64), (c) => c.charCodeAt(0));
          const { error: uploadFehler } = await supabase.storage
            .from("anhaenge")
            .upload(pfad, bytes, { contentType: anhang.contentType });
          if (uploadFehler) {
            console.error("Anhang-Upload-Fehler:", uploadFehler);
            continue;
          }
          await supabase.from("anhaenge").insert({
            nachricht_id: nachricht!.id,
            storage_path: pfad,
            dateityp: anhang.contentType,
          });
        }

        importiertGesamt++;
      } catch (err) {
        console.error("Fehler beim Verarbeiten einer Mail fuer Firma", org.id, ":", err);
      }
    }
  }

  return new Response(
    JSON.stringify({ importiert: importiertGesamt }),
    { headers: { "Content-Type": "application/json" } },
  );
});
