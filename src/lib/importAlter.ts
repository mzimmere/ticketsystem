export interface ImportStandEintrag {
  am: string;
  rueckwirkend: boolean;
}

export type ImportStand = Partial<Record<"dongle" | "lizenz", ImportStandEintrag>>;

export type ImportFarbe = "gruen" | "amber" | "rot" | "neutral";

export function alterInTagen(iso: string): number {
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const tag = new Date(iso);
  tag.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((heute.getTime() - tag.getTime()) / 86400000));
}

// bis 14 Tage aktuell, bis 30 Tage etwas aelter, danach veraltet; nie = rot
export function importFarbe(iso: string | undefined): ImportFarbe {
  if (!iso) return "rot";
  const tage = alterInTagen(iso);
  return tage <= 14 ? "gruen" : tage <= 30 ? "amber" : "rot";
}
