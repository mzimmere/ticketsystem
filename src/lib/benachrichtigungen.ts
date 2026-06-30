// Zentrale Stelle für Kunden-Benachrichtigungen bei Ticket-Ereignissen.
// Ruft die Edge Function "benachrichtige-kunde" auf, die per Resend eine
// E-Mail verschickt. Schlägt der Versand fehl (z.B. weil Resend noch
// nicht eingerichtet ist), wird das nur geloggt - der Kunde sieht den
// neuen Status ohnehin sofort live im Portal (Realtime).

import { supabase } from "./supabaseClient";

export type TicketEreignis = "status_geaendert" | "neue_antwort";

interface BenachrichtigungsKontext {
  ticketId: string;
  ereignis: TicketEreignis;
  neuerStatus?: string;
}

export async function benachrichtigeKunde(kontext: BenachrichtigungsKontext) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/benachrichtige-kunde`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token}`,
      },
      body: JSON.stringify(kontext),
    });
  } catch (err) {
    // Bewusst stillschweigend: Mail-Versand ist ein "nice to have",
    // soll den eigentlichen Workflow (Status ändern etc.) nie blockieren.
    console.debug("[benachrichtigeKunde] fehlgeschlagen:", err);
  }
}
