import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { berechneFreiminutenAbzug, type DongleFreiminuten } from "../lib/freiminuten";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface ZeitEintrag {
  id: string;
  erstellt_am: string;
  minuten: number;
  preis_pro_minute_cent_snapshot: number;
  beschreibung: string | null;
  dongle_id: string | null;
}

interface Anpassung {
  id: string;
  betrag_cent: number;
  beschreibung: string;
  erstellt_am: string;
  menge: number | null;
  einzelpreis_cent: number | null;
  art: string | null;
}

interface Produkt {
  id: string;
  bezeichnung: string;
  einzelpreis_cent: number;
  einheit: string;
}

interface Kunde {
  name: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  land: string | null;
  mwst_satz: number | null;
  ust_id: string | null;
  telefonnummer: string | null;
}

interface Organisation {
  name: string;
  logo_url: string | null;
  adresse: string | null;
  telefon: string | null;
  email: string | null;
  rechnungslogo_breite: number | null;
}

interface RechnungDetailProps {
  organisationId: string;
  kundeId: string;
  jahr: number;
  monat: number; // 1-12
  onZurueck: () => void;
}

function formatEuro(cent: number): string {
  return (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDatum(iso: string, sprache: "de" | "en"): string {
  return new Date(iso).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE");
}

export default function RechnungDetail({
  organisationId,
  kundeId,
  jahr,
  monat,
  onZurueck,
}: RechnungDetailProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).rechnungDetail;
  const [kunde, setKunde] = useState<Kunde | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [eintraege, setEintraege] = useState<ZeitEintrag[]>([]);
  const [dongles, setDongles] = useState<DongleFreiminuten[]>([]);
  const [anpassungen, setAnpassungen] = useState<Anpassung[]>([]);
  const [neueBeschreibung, setNeueBeschreibung] = useState("");
  const [neuerBetragEuro, setNeuerBetragEuro] = useState("");
  const [produkte, setProdukte] = useState<Produkt[]>([]);
  const [posProduktId, setPosProduktId] = useState("");
  const [posBezeichnung, setPosBezeichnung] = useState("");
  const [posMenge, setPosMenge] = useState("1");
  const [posEinzelpreisEuro, setPosEinzelpreisEuro] = useState("");
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);

  const monatsErster = useMemo(
    () => `${jahr}-${String(monat).padStart(2, "0")}-01`,
    [jahr, monat],
  );
  const naechsterMonatErster = useMemo(() => {
    const naechsterMonat = monat === 12 ? 1 : monat + 1;
    const naechstesJahr = monat === 12 ? jahr + 1 : jahr;
    return `${naechstesJahr}-${String(naechsterMonat).padStart(2, "0")}-01`;
  }, [jahr, monat]);

  const monatLabel = useMemo(
    () => new Date(jahr, monat - 1, 1).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE", { month: "long", year: "numeric" }),
    [jahr, monat, sprache],
  );

  useEffect(() => {
    ladeAlles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, kundeId, jahr, monat]);

  async function ladeAlles() {
    setLaedt(true);
    const [{ data: kundeDaten }, { data: orgDaten }, { data: zeitDaten }, { data: anpassungDaten }, { data: dongleDaten }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("name, strasse, hausnummer, plz, ort, land, mwst_satz, ust_id, telefonnummer")
          .eq("id", kundeId)
          .single(),
        supabase
          .from("organisationen")
          .select("name, logo_url, adresse, telefon, email, rechnungslogo_breite")
          .eq("id", organisationId)
          .single(),
        supabase
          .from("zeiteintraege")
          .select("id, erstellt_am, minuten, preis_pro_minute_cent_snapshot, beschreibung, ticket:ticket_id(dongle_id)")
          .eq("kunde_id", kundeId)
          .eq("organisation_id", organisationId)
          .gte("erstellt_am", monatsErster)
          .lt("erstellt_am", naechsterMonatErster)
          .not("minuten", "is", null)
          .order("erstellt_am", { ascending: true }),
        supabase
          .from("rechnungsanpassungen")
          .select("id, betrag_cent, beschreibung, erstellt_am, menge, einzelpreis_cent, art")
          .eq("kunde_id", kundeId)
          .eq("monat", monatsErster)
          .order("erstellt_am", { ascending: true }),
        supabase
          .from("kunden_dongles")
          .select("id, seriennummer, freiminuten_pro_monat")
          .eq("kunde_id", kundeId)
          .eq("organisation_id", organisationId),
      ]);

    setKunde(kundeDaten);
    setOrganisation(orgDaten);
    const zeitRoh = (zeitDaten as unknown as Array<{
      id: string;
      erstellt_am: string;
      minuten: number;
      preis_pro_minute_cent_snapshot: number;
      beschreibung: string | null;
      ticket: { dongle_id: string | null } | null;
    }>) ?? [];
    setEintraege(
      zeitRoh.map((e) => ({
        id: e.id,
        erstellt_am: e.erstellt_am,
        minuten: e.minuten,
        preis_pro_minute_cent_snapshot: e.preis_pro_minute_cent_snapshot,
        beschreibung: e.beschreibung,
        dongle_id: e.ticket?.dongle_id ?? null,
      })),
    );
    setAnpassungen((anpassungDaten as Anpassung[]) ?? []);
    setDongles((dongleDaten as DongleFreiminuten[]) ?? []);
    setLaedt(false);

    // Produkte des aktuellen Nutzers laden
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      const { data: produktDaten } = await supabase
        .from("produkte")
        .select("id, bezeichnung, einzelpreis_cent, einheit")
        .eq("ersteller_id", authData.user.id)
        .eq("aktiv", true)
        .order("bezeichnung");
      setProdukte(produktDaten ?? []);
    }
  }

  async function anpassungHinzufuegen() {
    if (!neueBeschreibung.trim() || !neuerBetragEuro.trim()) return;
    const wert = parseFloat(neuerBetragEuro.trim().replace(",", "."));
    if (isNaN(wert)) {
      setHinweis(txt.fehlerUngueltigerBetrag);
      return;
    }
    const { error } = await supabase.from("rechnungsanpassungen").insert({
      organisation_id: organisationId,
      kunde_id: kundeId,
      monat: monatsErster,
      betrag_cent: Math.round(wert * 100),
      beschreibung: neueBeschreibung.trim(),
    });
    if (error) {
      console.error(error);
      setHinweis(txt.fehlerHinzufuegen);
      return;
    }
    setNeueBeschreibung("");
    setNeuerBetragEuro("");
    setHinweis(null);
    ladeAlles();
  }

  async function anpassungLoeschen(id: string) {
    await supabase.from("rechnungsanpassungen").delete().eq("id", id);
    ladeAlles();
  }

  function produktGewaehlt(id: string) {
    setPosProduktId(id);
    const p = produkte.find((p) => p.id === id);
    if (p) {
      setPosBezeichnung(p.bezeichnung);
      setPosEinzelpreisEuro((p.einzelpreis_cent / 100).toFixed(2).replace(".", ","));
    }
  }

  async function positionHinzufuegen() {
    if (!posBezeichnung.trim()) { setHinweis(txt.fehlerBezeichnungErforderlich); return; }
    const menge = parseFloat(posMenge.replace(",", ".")) || 1;
    const einzel = Math.round(parseFloat(posEinzelpreisEuro.replace(",", ".")) * 100);
    if (isNaN(einzel)) { setHinweis(txt.fehlerUngueltigerEinzelpreis); return; }

    const gesamt = Math.round(menge * einzel);
    const { error } = await supabase.from("rechnungsanpassungen").insert({
      organisation_id: organisationId,
      kunde_id: kundeId,
      monat: monatsErster,
      betrag_cent: gesamt,
      beschreibung: posBezeichnung.trim(),
      menge,
      einzelpreis_cent: einzel,
      produkt_id: posProduktId || null,
      art: "position",
    });
    if (error) { console.error(error); setHinweis(txt.fehlerPositionFehlgeschlagen); return; }
    setPosProduktId(""); setPosBezeichnung(""); setPosMenge("1"); setPosEinzelpreisEuro("");
    setHinweis(null);
    ladeAlles();
  }

  const freiminuten = berechneFreiminutenAbzug(eintraege, dongles);
  const { gesamtMinuten, zwischensummeOhneAbzug, abzugCent, zwischensummeNachAbzug, abzuegeJeDongle } = freiminuten;
  const anpassungenSumme = anpassungen.reduce((sum, a) => sum + a.betrag_cent, 0);
  const nettosumme = zwischensummeNachAbzug + anpassungenSumme;
  const istInnergemeinschaftlich = !!kunde?.ust_id?.trim();
  const mwstSatz = istInnergemeinschaftlich ? 0 : kunde?.mwst_satz ?? 0;
  const mwstBetrag = Math.round(nettosumme * (mwstSatz / 100));
  const bruttosumme = nettosumme + mwstBetrag;

  if (laedt) return <p className="text-sm text-[var(--text-faint)]">{txt.laedt}</p>;

  return (
    <div className="space-y-4">
      <div className="keine-druckansicht flex items-center justify-between">
        <button
          onClick={onZurueck}
          className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
        >
          {txt.zurueckZurAbrechnung}
        </button>
        <button
          onClick={() => window.print()}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          {txt.druckenSpeichern}
        </button>
      </div>

      <div className="druckbereich rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-6 print:border-0 print:p-0">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-2">
            {organisation?.logo_url && (
              <img
                src={organisation.logo_url}
                alt=""
                style={{ width: `${organisation.rechnungslogo_breite ?? 80}px` }}
                className="h-auto shrink-0 rounded bg-[var(--bg-muted)] object-contain p-0.5"
              />
            )}
            <div>
              <p className="font-semibold text-[var(--text-strong)]">{organisation?.name}</p>
              {organisation?.adresse && (
                <p className="whitespace-pre-line text-xs text-[var(--text-soft)]">
                  {organisation.adresse}
                </p>
              )}
              {(organisation?.telefon || organisation?.email) && (
                <p className="text-xs text-[var(--text-soft)]">
                  {[organisation?.telefon, organisation?.email].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <h2
              className="text-lg font-semibold text-[var(--text-strong)]"
            >
              {txt.titel}
            </h2>
            <p className="text-sm text-[var(--text-soft)]">{monatLabel}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-[var(--text-faint)]">{txt.kunde}</p>
          <p className="text-sm font-medium text-[var(--text-strong)]">{kunde?.name ?? txt.unbenannt}</p>
          {(kunde?.strasse || kunde?.ort) && (
            <p className="text-sm text-[var(--text-soft)]">
              {[kunde?.strasse, kunde?.hausnummer].filter(Boolean).join(" ")}
              {(kunde?.strasse || kunde?.hausnummer) && (kunde?.plz || kunde?.ort) && <br />}
              {[kunde?.plz, kunde?.ort].filter(Boolean).join(" ")}
              {kunde?.land && kunde.land !== "Deutschland" && (
                <>
                  <br />
                  {kunde.land}
                </>
              )}
            </p>
          )}
          {kunde?.telefonnummer && (
            <p className="text-sm text-[var(--text-soft)]">{kunde.telefonnummer}</p>
          )}
          {kunde?.ust_id && (
            <p className="text-sm text-[var(--text-soft)]">{txt.ustIdLabel} {kunde.ust_id}</p>
          )}
        </div>

        {eintraege.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">{txt.keineZeit}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-faint)]">
                <th className="py-1.5 pr-2">{txt.spalteDatum}</th>
                <th className="py-1.5 pr-2">{txt.spalteBeschreibung}</th>
                <th className="py-1.5 pr-2 text-right">{txt.spalteMin}</th>
                <th className="py-1.5 pr-2 text-right">{txt.spaltePreisMin}</th>
                <th className="py-1.5 text-right">{txt.spalteBetrag}</th>
              </tr>
            </thead>
            <tbody>
              {eintraege.map((e) => (
                <tr key={e.id} className="border-b border-[var(--border)]">
                  <td className="py-1.5 pr-2 align-top font-mono text-xs text-[var(--text-soft)]">
                    {formatDatum(e.erstellt_am, sprache)}
                  </td>
                  <td className="py-1.5 pr-2 align-top text-[var(--text-strong)]">
                    {e.beschreibung || "–"}
                  </td>
                  <td className="py-1.5 pr-2 align-top text-right font-mono text-[var(--text-soft)]">
                    {e.minuten}
                  </td>
                  <td className="py-1.5 pr-2 align-top text-right font-mono text-[var(--text-soft)]">
                    {formatEuro(e.preis_pro_minute_cent_snapshot)}
                  </td>
                  <td className="py-1.5 align-top text-right font-mono text-[var(--text-strong)]">
                    {formatEuro(e.minuten * e.preis_pro_minute_cent_snapshot)}
                  </td>
                </tr>
              ))}
              {anpassungen.filter((a) => a.art === "position").map((a) => (
                <tr key={a.id} className="border-b border-[var(--border)]">
                  <td className="py-1.5 pr-2 align-top font-mono text-xs text-[var(--text-soft)]">
                    {formatDatum(a.erstellt_am, sprache)}
                  </td>
                  <td className="py-1.5 pr-2 align-top text-[var(--text-strong)]">
                    {a.beschreibung}
                  </td>
                  <td className="py-1.5 pr-2 align-top text-right font-mono text-[var(--text-soft)]">
                    {a.menge ?? 1}×
                  </td>
                  <td className="py-1.5 pr-2 align-top text-right font-mono text-[var(--text-soft)]">
                    {a.einzelpreis_cent != null ? formatEuro(a.einzelpreis_cent) : "–"}
                  </td>
                  <td className="py-1.5 align-top text-right font-mono text-[var(--text-strong)]">
                    <span className="flex items-center justify-end gap-1.5">
                      {formatEuro(a.betrag_cent)}
                      <button
                        onClick={() => anpassungLoeschen(a.id)}
                        className="keine-druckansicht text-[var(--text-faint)] hover:text-red-600"
                        title={txt.entfernenTitle}
                      >
                        ×
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-3 flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between text-[var(--text-soft)]">
              <span>{txt.gesamtzeitOhneAbzug}</span>
              <span className="font-mono">{gesamtMinuten} {txt.spalteMin} / {formatEuro(zwischensummeOhneAbzug)}</span>
            </div>

            {abzuegeJeDongle.map((d) => (
              <div key={d.dongleId} className="flex justify-between text-[var(--text-soft)]">
                <span className="truncate pr-2">
                  {txt.freiminutenTemplate.replace("{n}", String(d.freieMinuten)).replace("{seriennummer}", d.seriennummer)}
                </span>
                <span className="font-mono">− {formatEuro(d.abzugCent)}</span>
              </div>
            ))}

            {abzugCent > 0 && (
              <div className="flex justify-between border-t border-[var(--border)] pt-1 text-[var(--text-soft)]">
                <span>{txt.berechneteZeit}</span>
                <span className="font-mono">{formatEuro(zwischensummeNachAbzug)}</span>
              </div>
            )}

            {anpassungen.filter((a) => a.art !== "position").map((a) => (
              <div key={a.id} className="flex items-center justify-between text-[var(--text-soft)]">
                <span className="truncate pr-2">{a.beschreibung}</span>
                <span className="flex items-center gap-1.5 font-mono">
                  {formatEuro(a.betrag_cent)}
                  <button
                    onClick={() => anpassungLoeschen(a.id)}
                    className="keine-druckansicht text-[var(--text-faint)] hover:text-red-600"
                    title={txt.entfernenTitle}
                  >
                    ×
                  </button>
                </span>
              </div>
            ))}

            <div className="flex justify-between border-t border-[var(--border)] pt-1 text-[var(--text-soft)]">
              <span>{txt.netto}</span>
              <span className="font-mono">{formatEuro(nettosumme)}</span>
            </div>
            <div className="flex justify-between text-[var(--text-soft)]">
              <span>{txt.mwstTemplate.replace("{prozent}", mwstSatz.toLocaleString(sprache === "en" ? "en-US" : "de-DE"))}</span>
              <span className="font-mono">{formatEuro(mwstBetrag)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--border)] pt-1 font-semibold text-[var(--text-strong)]">
              <span>{txt.gesamtBrutto}</span>
              <span className="font-mono">{formatEuro(bruttosumme)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-1 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-faint)]">
          {istInnergemeinschaftlich && (
            <p>
              {txt.steuerfreiHinweis}
            </p>
          )}
          <p>{txt.rechnungsdatumHinweis}</p>
        </div>
      </div>

      <div className="keine-druckansicht rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-2.5">
        <h3 className="text-sm font-medium text-[var(--text-strong)]">
          {txt.positionHinzufuegenTitel}
        </h3>
        <p className="text-xs text-[var(--text-faint)]">
          {txt.positionHinzufuegenBeschreibung}
        </p>

        {produkte.length > 0 && (
          <select
            value={posProduktId}
            onChange={(e) => produktGewaehlt(e.target.value)}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-soft)]"
          >
            <option value="">{txt.produktAuswaehlen}</option>
            {produkte.map((p) => (
              <option key={p.id} value={p.id}>
                {p.bezeichnung} – {formatEuro(p.einzelpreis_cent)} / {p.einheit}
              </option>
            ))}
          </select>
        )}

        <input
          type="text"
          value={posBezeichnung}
          onChange={(e) => setPosBezeichnung(e.target.value)}
          placeholder={txt.bezeichnungPlatzhalter}
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <div className="w-20">
            <label className="mb-1 block text-xs text-[var(--text-faint)]">{txt.mengeLabel}</label>
            <input
              type="text" inputMode="decimal"
              value={posMenge}
              onChange={(e) => setPosMenge(e.target.value)}
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-[var(--text-faint)]">{txt.einzelpreisLabel}</label>
            <input
              type="text" inputMode="decimal"
              value={posEinzelpreisEuro}
              onChange={(e) => setPosEinzelpreisEuro(e.target.value)}
              placeholder="0,00"
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={positionHinzufuegen}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              {txt.positionButton}
            </button>
          </div>
        </div>
        {posMenge && posEinzelpreisEuro && (
          <p className="text-right text-xs text-[var(--text-faint)]">
            {txt.gesamtLabel} {formatEuro(Math.round((parseFloat(posMenge.replace(",", ".")) || 0) * (parseFloat(posEinzelpreisEuro.replace(",", ".")) || 0) * 100))}
          </p>
        )}
      </div>

      <div className="keine-druckansicht rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-2.5">
        <h3 className="text-sm font-medium text-[var(--text-strong)]">
          {txt.rabattTitel}
        </h3>
        <p className="text-xs text-[var(--text-faint)]">
          {txt.rabattBeschreibung}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={neueBeschreibung}
            onChange={(e) => setNeueBeschreibung(e.target.value)}
            placeholder={txt.beschreibungRabattPlatzhalter}
            className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          />
          <input
            type="text"
            inputMode="decimal"
            value={neuerBetragEuro}
            onChange={(e) => setNeuerBetragEuro(e.target.value)}
            placeholder="-5,00"
            className="w-28 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          />
          <button
            onClick={anpassungHinzufuegen}
            className="rounded bg-akzent px-4 py-2 text-sm font-medium text-white"
          >
            {txt.hinzufuegenButton}
          </button>
        </div>
        {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}
      </div>
    </div>
  );
}
