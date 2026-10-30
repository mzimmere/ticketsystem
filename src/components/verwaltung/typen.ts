export type Rolle = "super_admin" | "org_admin" | "techniker" | "kunde";

export interface OrganisationKurz {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface Organisation extends OrganisationKurz {
  adresse: string | null;
  telefon: string | null;
  email: string | null;
  website: string | null;
  oeffnungszeiten: string | null;
  standard_preis_pro_minute_cent: number | null;
  motto: string | null;
  akzentfarbe: string | null;
  hero_bild_url: string | null;
  slug: string | null;
  datenschutz_url: string | null;
  datenschutz_text: string | null;
  rechnungslogo_breite: number | null;
  sla_stunden: number | null;
}

export type VerwaltungsTab = "firma" | "team" | "kunden" | "dongles" | "werkzeuge" | "integrationen";
