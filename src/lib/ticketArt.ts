export type TicketArt = "service_support" | "software_fehler" | "software_frage" | "schulung";

export const TICKET_ARTEN: TicketArt[] = ["service_support", "software_fehler", "software_frage", "schulung"];

// Zeiten werden bei allen Arten erfasst, aber nur diese Arten fliessen in
// Freiminuten-Abzug und Rechnung ein (NULL = nicht eingeordnet = wie bisher).
export function istAbrechenbar(art: string | null | undefined): boolean {
  return art !== "service_support" && art !== "software_fehler";
}
