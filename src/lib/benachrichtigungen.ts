// Zentrale Stelle für Kunden-/Mitarbeiter-Benachrichtigungen bei
// Ticket-Ereignissen. Ruft die Edge Functions "benachrichtige-kunde" bzw.
// "benachrichtige-mitarbeiter" auf, die per SMTP eine E-Mail verschicken.
// Schlägt der Versand fehl (z.B. weil SMTP noch nicht eingerichtet ist),
// wird das nur geloggt - der eigentliche Workflow (Status ändern etc.)
// darf davon nie blockiert werden.

import { supabase } from "./supabaseClient";

export type TicketEreignis = "status_geaendert" | "neue_antwort";
export type MitarbeiterEreignis = "zugewiesen" | "status_geaendert" | "neue_kundenantwort";

interface BenachrichtigungsKontext {
  ticketId: string;
  ereignis: TicketEreignis;
  neuerStatus?: string;
}

interface MitarbeiterBenachrichtigungsKontext {
  ticketId: string;
  ereignis: MitarbeiterEreignis;
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
    console.debug("[benachrichtigeKunde] fehlgeschlagen:", err);
  }
}

// Benachrichtigt den zugewiesenen Techniker - aber nur, wenn eine ANDERE
// Person die Aktion ausgeloest hat (Server prueft das anhand des
// mitgeschickten Auth-Tokens, nicht der Client). Wer sich selbst ein
// Ticket zuweist oder den Status im eigenen Ticket aendert, bekommt keine
// Mail ueber die eigene Aktion.
export async function benachrichtigeMitarbeiter(kontext: MitarbeiterBenachrichtigungsKontext) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/benachrichtige-mitarbeiter`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token}`,
      },
      body: JSON.stringify(kontext),
    });
  } catch (err) {
    console.debug("[benachrichtigeMitarbeiter] fehlgeschlagen:", err);
  }
}
