import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import Avatar from "./Avatar";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface Organisation {
  id: string;
  name: string;
  logo_url: string | null;
}

interface AdminEintrag {
  id: string;
  name: string | null;
  avatar_url: string | null;
  rolle: "org_admin" | "super_admin";
}

interface SuperAdminUebersichtProps {
  onFirmaOeffnen: (organisationId: string) => void;
}

export default function SuperAdminUebersicht({ onFirmaOeffnen }: SuperAdminUebersichtProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).superAdminUebersicht;
  const [organisationen, setOrganisationen] = useState<Organisation[]>([]);
  const [adminsProOrg, setAdminsProOrg] = useState<Record<string, AdminEintrag[]>>({});
  const [neueOrgName, setNeueOrgName] = useState("");
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [neueOrgLandingpage, setNeueOrgLandingpage] = useState<string | null>(null);
  const [landingpageKopiert, setLandingpageKopiert] = useState(false);

  useEffect(() => {
    ladeAlles();
  }, []);

  async function ladeAlles() {
    const { data: orgDaten } = await supabase
      .from("organisationen")
      .select("id, name, logo_url")
      .order("name");
    setOrganisationen(orgDaten ?? []);

    const { data: adminDaten } = await supabase
      .from("profiles")
      .select("id, name, avatar_url, rolle, organisation_id")
      .in("rolle", ["org_admin", "super_admin"])
      .eq("deaktiviert", false);

    const gruppiert: Record<string, AdminEintrag[]> = {};
    for (const a of (adminDaten ?? []) as Array<AdminEintrag & { organisation_id: string | null }>) {
      if (!a.organisation_id) continue;
      if (!gruppiert[a.organisation_id]) gruppiert[a.organisation_id] = [];
      gruppiert[a.organisation_id].push(a);
    }
    setAdminsProOrg(gruppiert);
  }

  async function neueOrganisationAnlegen() {
    if (!neueOrgName.trim()) return;
    setLaedt(true);
    const { data, error } = await supabase
      .from("organisationen")
      .insert({ name: neueOrgName.trim() })
      .select("slug")
      .single();
    setLaedt(false);
    if (error || !data) {
      setHinweis(txt.fehlerAnlegen);
      return;
    }
    setNeueOrgName("");
    setNeueOrgLandingpage(data.slug ? `${window.location.origin}/?neukunde=${data.slug}` : null);
    setHinweis(txt.erfolgAngelegt);
    ladeAlles();
  }

  return (
    <div className="space-y-4">
      <h2
        className="text-lg font-semibold text-[var(--text-strong)]"
      >
        {txt.titel}
      </h2>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-2.5">
        <h3 className="text-sm font-medium text-[var(--text-strong)]">{txt.neueFirmaAnlegen}</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={neueOrgName}
            onChange={(e) => setNeueOrgName(e.target.value)}
            placeholder={txt.firmaNamePlatzhalter}
            className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          />
          <button
            onClick={neueOrganisationAnlegen}
            disabled={laedt}
            className="rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {txt.anlegen}
          </button>
        </div>
        {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}
        {neueOrgLandingpage && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-muted)] p-2.5">
            <code className="flex-1 truncate text-xs font-mono text-[var(--text-strong)]">
              {neueOrgLandingpage}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(neueOrgLandingpage);
                setLandingpageKopiert(true);
                setTimeout(() => setLandingpageKopiert(false), 2000);
              }}
              className="shrink-0 rounded border border-[var(--border-input)] px-2 py-1 text-xs text-[var(--text-faint)] hover:bg-[var(--bg-surface)]"
            >
              {landingpageKopiert ? txt.kopiert : txt.kopieren}
            </button>
          </div>
        )}
        <p className="text-xs text-[var(--text-faint)]">
          {txt.anleitungAdminAnlegen}
        </p>
      </div>

      <div className="space-y-2">
        {organisationen.map((org) => (
          <button
            key={org.id}
            onClick={() => onFirmaOeffnen(org.id)}
            className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-left hover:bg-[var(--bg-muted)]"
          >
            {org.logo_url && <img src={org.logo_url} alt="" className="h-8 w-8 shrink-0 rounded bg-[var(--bg-muted)] object-contain p-0.5" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text-strong)]">{org.name}</p>
              <div className="mt-1 flex items-center gap-1.5">
                {(adminsProOrg[org.id] ?? []).length === 0 ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {txt.keinAdminZugewiesen}
                  </span>
                ) : (
                  (adminsProOrg[org.id] ?? []).map((a) => (
                    <span key={a.id} className="flex items-center gap-1">
                      <Avatar name={a.name} avatarUrl={a.avatar_url} groesse="sm" />
                      <span className="text-xs text-[var(--text-soft)]">{a.name ?? txt.unbenannt}</span>
                    </span>
                  ))
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
