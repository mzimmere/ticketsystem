import { createClient } from "jsr:@supabase/supabase-js@2";

// Wird alle 15 Minuten per pg_cron aufgerufen.
// Findet Tickets, deren Reaktions- oder Lösungsfrist (siehe SLA-Trigger in
// schema.sql, Abschnitt 42/43) gerissen ist, markiert sie als eskaliert
// (damit nicht bei jedem Lauf erneut benachrichtigt wird) und schickt eine
// Mail an den zugewiesenen Techniker - bzw. an alle Org-Admins der Firma,
// falls niemand zugewiesen ist.
//
// Auth: verify_jwt=false, stattdessen Pruefung gegen dasselbe Shared
// Secret aus Supabase Vault wie auto-schliessen (siehe dort fuer den
// Hintergrund - bewusst nicht im Quellcode hartkodiert, oeffentliches Repo).

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface TicketZeile {
  id: string;
  ticket_nr: number;
  titel: string;
  organisation_id: string;
  zugewiesen_an: string | null;
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

async function empfaengerEmails(ticket: TicketZeile): Promise<string[]> {
  if (ticket.zugewiesen_an) {
    const { data } = await supabase.auth.admin.getUserById(ticket.zugewiesen_an);
    if (data.user?.email) return [data.user.email];
  }
  return orgAdminEmails(ticket.organisation_id);
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

  const jetzt = new Date().toISOString();
  const seitenUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "";
  let eskaliertGesamt = 0;

  // ── Reaktionsfrist gerissen (noch keine Mitarbeiter-Antwort) ──
  const { data: reaktionTickets } = await supabase
    .from("tickets")
    .select("id, ticket_nr, titel, organisation_id, zugewiesen_an")
    .not("status", "in", '("geloest","geschlossen")')
    .lt("reaktion_faellig_am", jetzt)
    .is("erste_antwort_am", null)
    .eq("reaktion_eskaliert", false);

  for (const ticket of (reaktionTickets ?? []) as TicketZeile[]) {
    await supabase.from("tickets").update({ reaktion_eskaliert: true }).eq("id", ticket.id);
    await supabase.from("ticket_nachrichten").insert({
      ticket_id: ticket.id,
      quelle: "intern",
      inhalt: "⚠️ SLA-Eskalation: Reaktionsfrist überschritten, noch keine Antwort.",
    });
    const empfaenger = await empfaengerEmails(ticket);
    await mailSenden(
      empfaenger,
      `SLA-Warnung: Ticket #${ticket.ticket_nr} wartet auf erste Antwort`,
      [
        `Die Reaktionsfrist für Ticket "${ticket.titel}" (#${ticket.ticket_nr}) ist überschritten,`,
        `es gibt noch keine Antwort.`,
        ``,
        `Ticket ansehen: ${seitenUrl}`,
      ].join("\n"),
    );
    eskaliertGesamt++;
  }

  // ── Lösungsfrist gerissen ──
  const { data: loesungTickets } = await supabase
    .from("tickets")
    .select("id, ticket_nr, titel, organisation_id, zugewiesen_an")
    .not("status", "in", '("geloest","geschlossen")')
    .lt("loesung_faellig_am", jetzt)
    .eq("loesung_eskaliert", false);

  for (const ticket of (loesungTickets ?? []) as TicketZeile[]) {
    await supabase.from("tickets").update({ loesung_eskaliert: true }).eq("id", ticket.id);
    await supabase.from("ticket_nachrichten").insert({
      ticket_id: ticket.id,
      quelle: "intern",
      inhalt: "⚠️ SLA-Eskalation: Lösungsfrist überschritten.",
    });
    const empfaenger = await empfaengerEmails(ticket);
    await mailSenden(
      empfaenger,
      `SLA-Warnung: Ticket #${ticket.ticket_nr} überschreitet Lösungsfrist`,
      [
        `Die Lösungsfrist für Ticket "${ticket.titel}" (#${ticket.ticket_nr}) ist überschritten.`,
        ``,
        `Ticket ansehen: ${seitenUrl}`,
      ].join("\n"),
    );
    eskaliertGesamt++;
  }

  return new Response(
    JSON.stringify({ eskaliert: eskaliertGesamt }),
    { headers: { "Content-Type": "application/json" } },
  );
});
