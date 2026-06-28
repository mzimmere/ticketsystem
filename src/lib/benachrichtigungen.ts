// Zentrale Stelle für Kunden-Benachrichtigungen bei Ticket-Ereignissen.
//
// Aktuell bewusst inaktiv (Punkt 2 aus der Planung: erstmal nur live im
// Portal sichtbar). Sobald WhatsApp eingerichtet ist, kommt hier der Aufruf
// der "sende-whatsapp-nachricht"-Logik rein (siehe supabase/functions/whatsapp-webhook)
// – dann reicht eine Änderung an GENAU DIESER Datei, der Rest des Codes
// (TicketDetail.tsx etc.) muss nicht mehr angefasst werden.

export type TicketEreignis = "status_geaendert" | "neue_antwort";

interface BenachrichtigungsKontext {
  ticketId: string;
  ereignis: TicketEreignis;
  neuerStatus?: string;
}

export async function benachrichtigeKunde(kontext: BenachrichtigungsKontext) {
  // TODO sobald WhatsApp aktiv ist:
  // 1) Kunde + dessen Telefonnummer zum Ticket laden
  // 2) Passende Template-Nachricht wählen (z.B. "status_update")
  // 3) An die Meta Graph API senden (gleiche Logik wie im Webhook,
  //    sendeWhatsAppNachricht-Funktion wiederverwenden/auslagern)
  //
  // Bis dahin: kein Versand. Der Kunde sieht den neuen Status trotzdem
  // sofort im Portal (Realtime-Abo in MeinTicketDetail.tsx).
  console.debug("[benachrichtigeKunde] noch inaktiv:", kontext);
}
