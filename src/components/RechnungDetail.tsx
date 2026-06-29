import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";

interface ZeitEintrag {
  id: string;
  erstellt_am: string;
  minuten: number;
  preis_pro_minute_cent_snapshot: number;
  beschreibung: string | null;
}

interface Anpassung {
  id: string;
  betrag_cent: number;
  beschreibung: string;
  erstellt_am: string;
}

interface Kunde {
  name: string | null;
  adresse: string | null;
  telefonnummer: string | null;
}

interface Organisation {
  name: string;
  logo_url: string | null;
  adresse: string | null;
  telefon: string | null;
  email: string | null;
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

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

export default function RechnungDetail({
  organisationId,
  kundeId,
  jahr,
  monat,
  onZurueck,
}: RechnungDetailProps) {
  const [kunde, setKunde] = useState<Kunde | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [eintraege, setEintraege] = useState<ZeitEintrag[]>([]);
  const [anpassungen, setAnpassungen] = useState<Anpassung[]>([]);
  const [neueBeschreibung, setNeueBeschreibung] = useState("");
  const [neuerBetragEuro, setNeuerBetragEuro] = useState("");
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
    () => new Date(jahr, monat - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" }),
    [jahr, monat],
  );

  useEffect(() => {
    ladeAlles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, kundeId, jahr, monat]);

  async function ladeAlles() {
    setLaedt(true);
    const [{ data: kundeDaten }, { data: orgDaten }, { data: zeitDaten }, { data: anpassungDaten }] =
      await Promise.all([
        supabase.from("profiles").select("name, adresse, telefonnummer").eq("id", kundeId).single(),
        supabase
          .from("organisationen")
          .select("name, logo_url, adresse, telefon, email")
          .eq("id", organisationId)
          .single(),
        supabase
          .from("zeiteintraege")
          .select("id, erstellt_am, minuten, preis_pro_minute_cent_snapshot, beschreibung")
          .eq("kunde_id", kundeId)
          .eq("organisation_id", organisationId)
          .gte("erstellt_am", monatsErster)
          .lt("erstellt_am", naechsterMonatErster)
          .not("minuten", "is", null)
          .order("erstellt_am", { ascending: true }),
        supabase
          .from("rechnungsanpassungen")
          .select("id, betrag_cent, beschreibung, erstellt_am")
          .eq("kunde_id", kundeId)
          .eq("monat", monatsErster)
          .order("erstellt_am", { ascending: true }),
      ]);

    setKunde(kundeDaten);
    setOrganisation(orgDaten);
    setEintraege((zeitDaten as ZeitEintrag[]) ?? []);
    setAnpassungen((anpassungDaten as Anpassung[]) ?? []);
    setLaedt(false);
  }

  async function anpassungHinzufuegen() {
    if (!neueBeschreibung.trim() || !neuerBetragEuro.trim()) return;
    const wert = parseFloat(neuerBetragEuro.trim().replace(",", "."));
    if (isNaN(wert)) {
      setHinweis("Ungültiger Betrag.");
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
      setHinweis("Hinzufügen fehlgeschlagen.");
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

  const zwischensumme = eintraege.reduce(
    (sum, e) => sum + e.minuten * e.preis_pro_minute_cent_snapshot,
    0,
  );
  const gesamtMinuten = eintraege.reduce((sum, e) => sum + e.minuten, 0);
  const anpassungenSumme = anpassungen.reduce((sum, a) => sum + a.betrag_cent, 0);
  const gesamtsumme = zwischensumme + anpassungenSumme;

  if (laedt) return <p className="text-sm text-[var(--text-faint)]">Lädt…</p>;

  return (
    <div className="space-y-4">
      <div className="keine-druckansicht flex items-center justify-between">
        <button
          onClick={onZurueck}
          className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
        >
          ← Zurück zur Abrechnung
        </button>
        <button
          onClick={() => window.print()}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Drucken / Als PDF speichern
        </button>
      </div>

      <div className="druckbereich rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-6 print:border-0 print:p-0">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-2">
            {organisation?.logo_url && (
              <img src={organisation.logo_url} alt="" className="h-10 w-10 rounded" />
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
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Abrechnung
            </h2>
            <p className="text-sm text-[var(--text-soft)]">{monatLabel}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-[var(--text-faint)]">Kunde</p>
          <p className="text-sm font-medium text-[var(--text-strong)]">{kunde?.name ?? "Unbenannt"}</p>
          {kunde?.adresse && (
            <p className="whitespace-pre-line text-sm text-[var(--text-soft)]">{kunde.adresse}</p>
          )}
          {kunde?.telefonnummer && (
            <p className="text-sm text-[var(--text-soft)]">{kunde.telefonnummer}</p>
          )}
        </div>

        {eintraege.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">Keine erfasste Zeit in diesem Monat.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-faint)]">
                <th className="py-1.5 pr-2">Datum</th>
                <th className="py-1.5 pr-2">Beschreibung</th>
                <th className="py-1.5 pr-2 text-right">Min.</th>
                <th className="py-1.5 pr-2 text-right">Preis/Min.</th>
                <th className="py-1.5 text-right">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {eintraege.map((e) => (
                <tr key={e.id} className="border-b border-[var(--border)]">
                  <td className="py-1.5 pr-2 align-top font-mono text-xs text-[var(--text-soft)]">
                    {formatDatum(e.erstellt_am)}
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
            </tbody>
          </table>
        )}

        <div className="mt-3 flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between text-[var(--text-soft)]">
              <span>Zwischensumme ({gesamtMinuten} Min.)</span>
              <span className="font-mono">{formatEuro(zwischensumme)}</span>
            </div>

            {anpassungen.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-[var(--text-soft)]">
                <span className="truncate pr-2">{a.beschreibung}</span>
                <span className="flex items-center gap-1.5 font-mono">
                  {formatEuro(a.betrag_cent)}
                  <button
                    onClick={() => anpassungLoeschen(a.id)}
                    className="keine-druckansicht text-[var(--text-faint)] hover:text-red-600"
                    title="Entfernen"
                  >
                    ×
                  </button>
                </span>
              </div>
            ))}

            <div className="flex justify-between border-t border-[var(--border)] pt-1 font-semibold text-[var(--text-strong)]">
              <span>Gesamt</span>
              <span className="font-mono">{formatEuro(gesamtsumme)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="keine-druckansicht rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-2.5">
        <h3 className="text-sm font-medium text-[var(--text-strong)]">
          Rabatt / Gutschrift / Zuschlag hinzufügen
        </h3>
        <p className="text-xs text-[var(--text-faint)]">
          Negativer Betrag = Rabatt/Gutschrift, positiver Betrag = zusätzliche Position.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={neueBeschreibung}
            onChange={(e) => setNeueBeschreibung(e.target.value)}
            placeholder="Beschreibung, z.B. Treuerabatt"
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
            className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white"
          >
            Hinzufügen
          </button>
        </div>
        {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}
      </div>
    </div>
  );
}
