// Wie nah ist das Vertragsende? rot = abgelaufen, amber = in <= 30 Tagen.
export function ablaufInfo(ende: string): { tage: number; farbe: "rot" | "amber" | "neutral" } {
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const tage = Math.round((new Date(ende).getTime() - heute.getTime()) / 86400000);
  return { tage, farbe: tage < 0 ? "rot" : tage <= 30 ? "amber" : "neutral" };
}
