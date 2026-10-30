import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import DongleLizenzVerwaltung from "./DongleLizenzVerwaltung";
import IntegrationenVerwaltung from "./IntegrationenVerwaltung";
import FirmaTab from "./verwaltung/FirmaTab";
import TeamTab from "./verwaltung/TeamTab";
import KundenTab from "./verwaltung/KundenTab";
import WerkzeugeTab from "./verwaltung/WerkzeugeTab";
import type { Organisation, Rolle, VerwaltungsTab } from "./verwaltung/typen";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface VerwaltungProps {
  rolle: Rolle;
  organisationId: string | null;
  onlineIds?: Set<string>;
  initialTab?: VerwaltungsTab;
}

export default function Verwaltung({ rolle, organisationId, onlineIds, initialTab = "firma" }: VerwaltungProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).verwaltung;
  const [aktiveTab, setAktiveTab] = useState<VerwaltungsTab>(initialTab);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);

  useEffect(() => {
    if (organisationId) {
      ladeOrganisation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId]);

  async function ladeOrganisation() {
    const { data } = await supabase
      .from("organisationen")
      .select(
        "id, name, logo_url, adresse, telefon, email, website, oeffnungszeiten, standard_preis_pro_minute_cent, motto, akzentfarbe, hero_bild_url, slug, datenschutz_url, datenschutz_text, rechnungslogo_breite, sla_stunden",
      )
      .eq("id", organisationId)
      .single();
    if (data) setOrganisation(data);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--text-strong)]">
          {txt.titel}{organisation && rolle === "super_admin" ? ` – ${organisation.name}` : ""}
        </h2>
      </div>

      {/* Tab-Leiste */}
      <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-1">
        {([
          { id: "firma", label: txt.tabFirma },
          { id: "team", label: txt.tabTeam },
          { id: "kunden", label: txt.tabKunden },
          { id: "dongles", label: txt.tabDongles },
          { id: "werkzeuge", label: txt.tabWerkzeuge },
          { id: "integrationen", label: txt.tabIntegrationen },
        ] as { id: VerwaltungsTab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setAktiveTab(t.id)}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
              aktiveTab === t.id
                ? "bg-[var(--bg-surface)] text-[var(--text-strong)] shadow-sm"
                : "text-[var(--text-faint)] hover:text-[var(--text-soft)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Hinweis wenn kein Inhalt */}
      {!organisationId && aktiveTab !== "firma" && (
        <p className="text-sm text-[var(--text-faint)]">{txt.bitteFirmaWaehlen}</p>
      )}

      {aktiveTab === "firma" && organisation && (
        <FirmaTab organisation={organisation} setOrganisation={setOrganisation} />
      )}

      {aktiveTab === "team" && organisationId && (
        <TeamTab organisationId={organisationId} organisation={organisation} rolle={rolle} onlineIds={onlineIds} />
      )}

      {aktiveTab === "kunden" && organisationId && (
        <KundenTab organisationId={organisationId} organisation={organisation} onlineIds={onlineIds} />
      )}

      {aktiveTab === "dongles" && organisationId && (
        <DongleLizenzVerwaltung organisationId={organisationId} />
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <WerkzeugeTab organisationId={organisationId} slug={organisation?.slug} />
      )}

      {aktiveTab === "integrationen" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <IntegrationenVerwaltung organisationId={organisationId} />
        </div>
      )}
    </div>
  );
}
