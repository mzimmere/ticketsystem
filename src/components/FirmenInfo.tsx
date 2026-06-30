import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import Avatar from "./Avatar";

interface Organisation {
  name: string;
  logo_url: string | null;
  adresse: string | null;
  telefon: string | null;
  email: string | null;
  website: string | null;
  oeffnungszeiten: string | null;
}

interface Mitglied {
  id: string;
  name: string | null;
  avatar_url: string | null;
  rolle: "techniker" | "org_admin" | "super_admin";
  verfuegbarkeit: string;
}

const ROLLE_LABEL: Record<string, string> = {
  techniker: "Techniker",
  org_admin: "Admin",
  super_admin: "Admin",
};

interface FirmenInfoProps {
  organisationId: string;
}

export default function FirmenInfo({ organisationId }: FirmenInfoProps) {
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [team, setTeam] = useState<Mitglied[]>([]);

  useEffect(() => {
    supabase
      .from("organisationen")
      .select("name, logo_url, adresse, telefon, email, website, oeffnungszeiten")
      .eq("id", organisationId)
      .single()
      .then(({ data }) => setOrganisation(data));

    supabase
      .from("profiles")
      .select("id, name, avatar_url, rolle, verfuegbarkeit")
      .eq("organisation_id", organisationId)
      .in("rolle", ["techniker", "org_admin"])
      .order("rolle")
      .then(({ data }) => setTeam((data as Mitglied[]) ?? []));
  }, [organisationId]);

  if (!organisation) return <p className="text-sm text-[var(--text-faint)]">Lädt…</p>;

  const website = organisation.website
    ? organisation.website.startsWith("http")
      ? organisation.website
      : `https://${organisation.website}`
    : null;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <div className="flex items-center gap-3">
          {organisation.logo_url && (
            <img src={organisation.logo_url} alt={organisation.name} className="h-12 w-12 shrink-0 rounded bg-[var(--bg-muted)] object-contain p-0.5" />
          )}
          <h2
            className="text-lg font-semibold text-[var(--text-strong)]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {organisation.name}
          </h2>
        </div>

        {(organisation.adresse ||
          organisation.telefon ||
          organisation.email ||
          website ||
          organisation.oeffnungszeiten) && (
          <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-sm">
            {organisation.adresse && (
              <p className="whitespace-pre-line text-[var(--text-soft)]">
                {organisation.adresse}
              </p>
            )}
            {organisation.telefon && (
              <p>
                <a href={`tel:${organisation.telefon.replace(/\s/g, "")}`} className="text-amber-600 hover:underline">
                  {organisation.telefon}
                </a>
              </p>
            )}
            {organisation.email && (
              <p>
                <a href={`mailto:${organisation.email}`} className="text-amber-600 hover:underline">
                  {organisation.email}
                </a>
              </p>
            )}
            {website && (
              <p>
                <a href={website} target="_blank" rel="noreferrer" className="text-amber-600 hover:underline">
                  {organisation.website}
                </a>
              </p>
            )}
            {organisation.oeffnungszeiten && (
              <p className="text-[var(--text-soft)]">{organisation.oeffnungszeiten}</p>
            )}
          </div>
        )}
      </div>

      {team.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h3 className="mb-3 text-sm font-medium text-[var(--text-strong)]">Unser Team</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {team.map((m) => (
              <div key={m.id} className="flex flex-col items-center gap-1.5 text-center">
                <Avatar name={m.name} avatarUrl={m.avatar_url} groesse="lg" />
                <p className="text-sm text-[var(--text-strong)]">{m.name ?? "Unbenannt"}</p>
                <p className="text-xs text-[var(--text-faint)]">{ROLLE_LABEL[m.rolle]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
