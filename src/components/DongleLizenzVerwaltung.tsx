import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import DongleImport from "./DongleImport";

interface KundeKurz {
  id: string;
  name: string | null;
}

interface NichtZugeordneterDongle {
  id: string;
  seriennummer: string;
  software: string;
  gruppe: string | null;
}

interface NichtZugeordneterVertrag {
  id: string;
  lizenz_seriennummer: string;
  produkt_name: string;
  vertrag_ende: string | null;
}

interface AlleDongle {
  id: string;
  seriennummer: string;
  software: string;
  wartungsvertrag: string;
  freiminuten_pro_monat: number;
  kunde: { name: string | null } | null;
}

interface AlleVertrag {
  id: string;
  lizenz_seriennummer: string;
  produkt_name: string;
  vertrag_ende: string | null;
  status: string | null;
  kunde_id: string | null;
  kunde: { name: string | null } | null;
  aktuelle_engine_build: string | null;
  max_erlaubte_engine_build: string | null;
}

const ANZAHL_POOL_SICHTBAR = 5;
const ANZAHL_UEBERSICHT_SICHTBAR = 10;

export default function DongleLizenzVerwaltung({ organisationId }: { organisationId: string }) {
  const { sprache } = useSprache();
  const txt = texte(sprache).dongleLizenzVerwaltung;
  const [kunden, setKunden] = useState<KundeKurz[]>([]);

  const [nichtZugeordnete, setNichtZugeordnete] = useState<NichtZugeordneterDongle[]>([]);
  const [zuweisenAn, setZuweisenAn] = useState<Record<string, string>>({});
  const [filterDongleNummer, setFilterDongleNummer] = useState("");
  const [alleDonglesPoolAnzeigen, setAlleDonglesPoolAnzeigen] = useState(false);

  const [nichtZugeordneteVertraege, setNichtZugeordneteVertraege] = useState<NichtZugeordneterVertrag[]>([]);
  const [zuweisenAnVertrag, setZuweisenAnVertrag] = useState<Record<string, string>>({});
  const [filterVertragNummer, setFilterVertragNummer] = useState("");
  const [alleVertraegePoolAnzeigen, setAlleVertraegePoolAnzeigen] = useState(false);

  const [alleDongles, setAlleDongles] = useState<AlleDongle[]>([]);
  const [dongleUebersichtSuche, setDongleUebersichtSuche] = useState("");
  const [dongleUebersichtAlleAnzeigen, setDongleUebersichtAlleAnzeigen] = useState(false);

  const [alleVertraege, setAlleVertraege] = useState<AlleVertrag[]>([]);
  const [vertragUebersichtSuche, setVertragUebersichtSuche] = useState("");
  const [vertragUebersichtAlleAnzeigen, setVertragUebersichtAlleAnzeigen] = useState(false);
  const [buildFilter, setBuildFilter] = useState("");
  const [einladungLaedt, setEinladungLaedt] = useState(false);
  const [einladungHinweis, setEinladungHinweis] = useState<string | null>(null);

  useEffect(() => {
    alleNeuLaden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId]);

  function alleNeuLaden() {
    ladeKunden();
    ladeNichtZugeordnete();
    ladeNichtZugeordneteVertraege();
    ladeAlleDongles();
    ladeAlleVertraege();
  }

  async function ladeKunden() {
    const { data } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("organisation_id", organisationId)
      .eq("rolle", "kunde")
      .eq("deaktiviert", false)
      .order("name");
    setKunden((data as KundeKurz[]) ?? []);
  }

  async function ladeNichtZugeordnete() {
    const { data } = await supabase
      .from("kunden_dongles")
      .select("id, seriennummer, software, gruppe")
      .eq("organisation_id", organisationId)
      .is("kunde_id", null)
      .order("seriennummer");
    setNichtZugeordnete((data as NichtZugeordneterDongle[]) ?? []);
  }

  async function dongleZuweisen(dongleId: string) {
    const kundeId = zuweisenAn[dongleId];
    if (!kundeId) return;
    await supabase.from("kunden_dongles").update({ kunde_id: kundeId }).eq("id", dongleId);
    setZuweisenAn((z) => {
      const kopie = { ...z };
      delete kopie[dongleId];
      return kopie;
    });
    ladeNichtZugeordnete();
    ladeAlleDongles();
  }

  async function ladeNichtZugeordneteVertraege() {
    const { data } = await supabase
      .from("lizenz_vertraege")
      .select("id, lizenz_seriennummer, produkt_name, vertrag_ende")
      .eq("organisation_id", organisationId)
      .is("kunde_id", null)
      .order("vertrag_ende", { ascending: true, nullsFirst: false });
    setNichtZugeordneteVertraege((data as NichtZugeordneterVertrag[]) ?? []);
  }

  async function vertragZuweisen(vertragId: string) {
    const kundeId = zuweisenAnVertrag[vertragId];
    if (!kundeId) return;
    await supabase.from("lizenz_vertraege").update({ kunde_id: kundeId }).eq("id", vertragId);
    setZuweisenAnVertrag((z) => {
      const kopie = { ...z };
      delete kopie[vertragId];
      return kopie;
    });
    ladeNichtZugeordneteVertraege();
    ladeAlleVertraege();
  }

  async function ladeAlleDongles() {
    const { data } = await supabase
      .from("kunden_dongles")
      .select("id, seriennummer, software, wartungsvertrag, freiminuten_pro_monat, kunde:kunde_id(name)")
      .eq("organisation_id", organisationId)
      .order("seriennummer");
    setAlleDongles((data as unknown as AlleDongle[]) ?? []);
  }

  async function ladeAlleVertraege() {
    const { data } = await supabase
      .from("lizenz_vertraege")
      .select("id, lizenz_seriennummer, produkt_name, vertrag_ende, status, kunde_id, kunde:kunde_id(name), aktuelle_engine_build, max_erlaubte_engine_build")
      .eq("organisation_id", organisationId)
      .order("lizenz_seriennummer");
    setAlleVertraege((data as unknown as AlleVertrag[]) ?? []);
  }

  const gefilterteNichtZugeordnete = nichtZugeordnete.filter((d) =>
    d.seriennummer.toLowerCase().includes(filterDongleNummer.trim().toLowerCase()),
  );
  const dongleSuchtAktiv = filterDongleNummer.trim() !== "";
  const sichtbareNichtZugeordnete =
    dongleSuchtAktiv || alleDonglesPoolAnzeigen
      ? gefilterteNichtZugeordnete
      : gefilterteNichtZugeordnete.slice(0, ANZAHL_POOL_SICHTBAR);

  const gefilterteNichtZugeordneteVertraege = nichtZugeordneteVertraege.filter((v) =>
    v.lizenz_seriennummer.toLowerCase().includes(filterVertragNummer.trim().toLowerCase()),
  );
  const vertragSuchtAktiv = filterVertragNummer.trim() !== "";
  const sichtbareNichtZugeordneteVertraege =
    vertragSuchtAktiv || alleVertraegePoolAnzeigen
      ? gefilterteNichtZugeordneteVertraege
      : gefilterteNichtZugeordneteVertraege.slice(0, ANZAHL_POOL_SICHTBAR);

  const dongleUebersichtGefiltert = alleDongles.filter((d) => {
    const begriff = dongleUebersichtSuche.trim().toLowerCase();
    if (!begriff) return true;
    return (
      d.seriennummer.toLowerCase().includes(begriff) ||
      (d.kunde?.name ?? "").toLowerCase().includes(begriff)
    );
  });
  const dongleUebersichtSuchtAktiv = dongleUebersichtSuche.trim() !== "";
  const sichtbareDongleUebersicht =
    dongleUebersichtSuchtAktiv || dongleUebersichtAlleAnzeigen
      ? dongleUebersichtGefiltert
      : dongleUebersichtGefiltert.slice(0, ANZAHL_UEBERSICHT_SICHTBAR);

  const verfuegbareBuilds = Array.from(
    new Set(alleVertraege.map((v) => v.aktuelle_engine_build).filter((b): b is string => !!b)),
  ).sort();

  const vertragUebersichtGefiltert = alleVertraege.filter((v) => {
    if (buildFilter && v.aktuelle_engine_build !== buildFilter) return false;
    const begriff = vertragUebersichtSuche.trim().toLowerCase();
    if (!begriff) return true;
    return (
      v.lizenz_seriennummer.toLowerCase().includes(begriff) ||
      v.produkt_name.toLowerCase().includes(begriff) ||
      (v.kunde?.name ?? "").toLowerCase().includes(begriff)
    );
  });
  const vertragUebersichtSuchtAktiv = vertragUebersichtSuche.trim() !== "";
  const sichtbareVertragUebersicht =
    vertragUebersichtSuchtAktiv || vertragUebersichtAlleAnzeigen
      ? vertragUebersichtGefiltert
      : vertragUebersichtGefiltert.slice(0, ANZAHL_UEBERSICHT_SICHTBAR);

  const einladbareKunden = Array.from(
    new Set(vertragUebersichtGefiltert.filter((v) => v.kunde_id).map((v) => v.kunde_id!)),
  );

  async function updateEinladungenVersenden() {
    if (einladbareKunden.length === 0) return;
    if (!confirm(txt.updateEinladenConfirmTemplate.replace("{n}", String(einladbareKunden.length)))) return;
    setEinladungLaedt(true);
    setEinladungHinweis(null);
    const { data: authData } = await supabase.auth.getUser();
    let angelegt = 0;
    for (const kundeId of einladbareKunden) {
      const betroffeneVertraege = vertragUebersichtGefiltert.filter((v) => v.kunde_id === kundeId);
      const seriennummern = betroffeneVertraege.map((v) => v.lizenz_seriennummer).join(", ");
      const build = betroffeneVertraege[0]?.aktuelle_engine_build ?? buildFilter;
      const maxBuild = betroffeneVertraege[0]?.max_erlaubte_engine_build;

      const { data: ticket, error: ticketFehler } = await supabase
        .from("tickets")
        .insert({
          organisation_id: organisationId,
          kunde_id: kundeId,
          titel: txt.updateTicketTitelTemplate.replace("{build}", build ?? ""),
          quelle: "manuell",
        })
        .select("id")
        .single();
      if (ticketFehler || !ticket) continue;

      const nachrichtText = maxBuild && maxBuild !== build
        ? txt.updateTicketNachrichtMitMaxTemplate
            .replace("{seriennummern}", seriennummern)
            .replace("{build}", build ?? "")
            .replace("{maxBuild}", maxBuild)
        : txt.updateTicketNachrichtTemplate
            .replace("{seriennummern}", seriennummern)
            .replace("{build}", build ?? "");

      await supabase.from("ticket_nachrichten").insert({
        ticket_id: ticket.id,
        autor_id: authData.user?.id,
        quelle: "portal",
        inhalt: nachrichtText,
      });
      angelegt++;
    }
    setEinladungLaedt(false);
    setEinladungHinweis(txt.updateEinladenErgebnisTemplate.replace("{n}", String(angelegt)));
  }

  return (
    <div className="space-y-4">
      <DongleImport organisationId={organisationId} onImportiert={alleNeuLaden} />

      {nichtZugeordnete.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-dashed border-[var(--border-input)] p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
            {txt.nichtZugeordneteLizenzenTemplate.replace("{gefiltert}", String(gefilterteNichtZugeordnete.length)).replace("{gesamt}", String(nichtZugeordnete.length))}
          </p>
          <input
            type="text"
            value={filterDongleNummer}
            onChange={(e) => setFilterDongleNummer(e.target.value)}
            placeholder={txt.seriennummerFilterPlatzhalter}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-strong)]"
          />
          {gefilterteNichtZugeordnete.length === 0 && (
            <p className="text-xs text-[var(--text-faint)]">{txt.keineTrefferFilter}</p>
          )}
          <div className="space-y-1.5">
            {sichtbareNichtZugeordnete.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5"
              >
                <span className="font-mono text-xs text-[var(--text-strong)]">{d.seriennummer}</span>
                <span className="text-xs text-[var(--text-faint)]">· {d.software}</span>
                {d.gruppe && <span className="text-xs text-[var(--text-faint)]">({d.gruppe})</span>}
                <div className="ml-auto flex items-center gap-1.5">
                  <select
                    value={zuweisenAn[d.id] ?? ""}
                    onChange={(e) => setZuweisenAn((z) => ({ ...z, [d.id]: e.target.value }))}
                    className="rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-strong)]"
                  >
                    <option value="">{txt.kundeWaehlen}</option>
                    {kunden.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name ?? txt.unbenannt}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => dongleZuweisen(d.id)}
                    disabled={!zuweisenAn[d.id]}
                    className="shrink-0 rounded bg-akzent px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {txt.zuweisen}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!dongleSuchtAktiv && gefilterteNichtZugeordnete.length > ANZAHL_POOL_SICHTBAR && (
            <button
              onClick={() => setAlleDonglesPoolAnzeigen((v) => !v)}
              className="w-full rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
            >
              {alleDonglesPoolAnzeigen ? txt.wenigerAnzeigen : txt.alleAnzeigenTemplate.replace("{n}", String(gefilterteNichtZugeordnete.length))}
            </button>
          )}
        </div>
      )}

      {nichtZugeordneteVertraege.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-dashed border-[var(--border-input)] p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
            {txt.nichtZugeordneteVertraegeTemplate.replace("{gefiltert}", String(gefilterteNichtZugeordneteVertraege.length)).replace("{gesamt}", String(nichtZugeordneteVertraege.length))}
          </p>
          <input
            type="text"
            value={filterVertragNummer}
            onChange={(e) => setFilterVertragNummer(e.target.value)}
            placeholder={txt.seriennummerFilterPlatzhalter}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-strong)]"
          />
          {gefilterteNichtZugeordneteVertraege.length === 0 && (
            <p className="text-xs text-[var(--text-faint)]">{txt.keineTrefferFilter}</p>
          )}
          <div className="space-y-1.5">
            {sichtbareNichtZugeordneteVertraege.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5"
              >
                <span className="font-mono text-xs text-[var(--text-strong)]">{v.lizenz_seriennummer}</span>
                <span className="text-xs text-[var(--text-faint)]">· {v.produkt_name}</span>
                {v.vertrag_ende && (
                  <span className="text-xs text-[var(--text-faint)]">
                    ({txt.bisPrefix} {new Date(v.vertrag_ende).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE")})
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  <select
                    value={zuweisenAnVertrag[v.id] ?? ""}
                    onChange={(e) => setZuweisenAnVertrag((z) => ({ ...z, [v.id]: e.target.value }))}
                    className="rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-strong)]"
                  >
                    <option value="">{txt.kundeWaehlen}</option>
                    {kunden.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name ?? txt.unbenannt}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => vertragZuweisen(v.id)}
                    disabled={!zuweisenAnVertrag[v.id]}
                    className="shrink-0 rounded bg-akzent px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {txt.zuweisen}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!vertragSuchtAktiv && gefilterteNichtZugeordneteVertraege.length > ANZAHL_POOL_SICHTBAR && (
            <button
              onClick={() => setAlleVertraegePoolAnzeigen((v) => !v)}
              className="w-full rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
            >
              {alleVertraegePoolAnzeigen ? txt.wenigerAnzeigen : txt.alleAnzeigenTemplate.replace("{n}", String(gefilterteNichtZugeordneteVertraege.length))}
            </button>
          )}
        </div>
      )}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-2">
        <h3 className="text-sm font-medium text-[var(--text-strong)]">
          {txt.alleDonglesTemplate.replace("{n}", String(alleDongles.length))}
        </h3>
        <input
          type="text"
          value={dongleUebersichtSuche}
          onChange={(e) => setDongleUebersichtSuche(e.target.value)}
          placeholder={txt.sucheSeriennummerOderKunde}
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-1.5 text-sm text-[var(--text-strong)]"
        />
        {dongleUebersichtGefiltert.length === 0 ? (
          <p className="text-xs text-[var(--text-faint)]">{txt.keineTreffer}</p>
        ) : (
          <div className="space-y-1">
            {sichtbareDongleUebersicht.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5 text-sm"
              >
                <span className="font-mono text-xs text-[var(--text-strong)]">{d.seriennummer}</span>
                <span className="text-xs text-[var(--text-faint)]">· {d.software}</span>
                <span
                  className={`ml-auto text-xs ${
                    d.kunde?.name ? "text-[var(--text-soft)]" : "italic text-[var(--text-faint)]"
                  }`}
                >
                  {d.kunde?.name ?? txt.nichtZugeordnet}
                </span>
              </div>
            ))}
          </div>
        )}
        {!dongleUebersichtSuchtAktiv && dongleUebersichtGefiltert.length > ANZAHL_UEBERSICHT_SICHTBAR && (
          <button
            onClick={() => setDongleUebersichtAlleAnzeigen((v) => !v)}
            className="w-full rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
          >
            {dongleUebersichtAlleAnzeigen ? txt.wenigerAnzeigen : txt.alleAnzeigenTemplate.replace("{n}", String(dongleUebersichtGefiltert.length))}
          </button>
        )}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-2">
        <h3 className="text-sm font-medium text-[var(--text-strong)]">
          {txt.alleLizenzvertraegeTemplate.replace("{n}", String(alleVertraege.length))}
        </h3>
        <input
          type="text"
          value={vertragUebersichtSuche}
          onChange={(e) => setVertragUebersichtSuche(e.target.value)}
          placeholder={txt.sucheSeriennummerProduktKunde}
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-1.5 text-sm text-[var(--text-strong)]"
        />
        {verfuegbareBuilds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={buildFilter}
              onChange={(e) => setBuildFilter(e.target.value)}
              className="rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-xs text-[var(--text-strong)]"
            >
              <option value="">{txt.buildFilterAlle}</option>
              {verfuegbareBuilds.map((b) => (
                <option key={b} value={b}>
                  {txt.buildFilterLabelTemplate.replace("{build}", b)}
                </option>
              ))}
            </select>
            {buildFilter && einladbareKunden.length > 0 && (
              <button
                onClick={updateEinladungenVersenden}
                disabled={einladungLaedt}
                className="rounded bg-akzent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {einladungLaedt
                  ? txt.updateEinladenLaedt
                  : txt.updateEinladenButtonTemplate.replace("{n}", String(einladbareKunden.length))}
              </button>
            )}
          </div>
        )}
        {einladungHinweis && <p className="text-xs text-[var(--text-soft)]">{einladungHinweis}</p>}
        {vertragUebersichtGefiltert.length === 0 ? (
          <p className="text-xs text-[var(--text-faint)]">{txt.keineTreffer}</p>
        ) : (
          <div className="space-y-1">
            {sichtbareVertragUebersicht.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5 text-sm"
              >
                <span className="font-mono text-xs text-[var(--text-strong)]">{v.lizenz_seriennummer}</span>
                <span className="text-xs text-[var(--text-faint)]">· {v.produkt_name}</span>
                {v.status && <span className="text-xs text-[var(--text-faint)]">({v.status})</span>}
                {v.aktuelle_engine_build && (
                  <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[0.65rem] text-[var(--text-soft)]">
                    {txt.buildLabel} {v.aktuelle_engine_build}
                  </span>
                )}
                {v.vertrag_ende && (
                  <span className="text-xs text-[var(--text-faint)]">
                    {txt.bisPrefix} {new Date(v.vertrag_ende).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE")}
                  </span>
                )}
                <span
                  className={`ml-auto text-xs ${
                    v.kunde?.name ? "text-[var(--text-soft)]" : "italic text-[var(--text-faint)]"
                  }`}
                >
                  {v.kunde?.name ?? txt.nichtZugeordnet}
                </span>
              </div>
            ))}
          </div>
        )}
        {!vertragUebersichtSuchtAktiv && vertragUebersichtGefiltert.length > ANZAHL_UEBERSICHT_SICHTBAR && (
          <button
            onClick={() => setVertragUebersichtAlleAnzeigen((v) => !v)}
            className="w-full rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
          >
            {vertragUebersichtAlleAnzeigen ? txt.wenigerAnzeigen : txt.alleAnzeigenTemplate.replace("{n}", String(vertragUebersichtGefiltert.length))}
          </button>
        )}
      </div>
    </div>
  );
}
