import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface Position {
  label: string;
  betrag_cent: number;
}

interface Rechnung {
  id: string;
  organisation_id: string;
  monat: string;
  rechnungsnummer: string;
  tarif_name: string;
  mitarbeiter_anzahl: number;
  positionen: Position[];
  netto_cent: number;
  mwst_satz: number;
  mwst_cent: number;
  brutto_cent: number;
  status: "entwurf" | "versendet";
  versendet_am: string | null;
}

interface Organisation {
  name: string;
  adresse: string | null;
  email: string | null;
}

interface Absender {
  firmenname: string;
  adresse: string | null;
  email: string | null;
  telefon: string | null;
  ust_id: string | null;
  iban: string | null;
}

function formatEuro(cent: number): string {
  return (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function monatLabel(monatIso: string): string {
  const [jahr, monat] = monatIso.split("-").map(Number);
  return new Date(jahr, monat - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

export default function PlattformRechnungDetail({
  rechnungId,
  onZurueck,
}: {
  rechnungId: string;
  onZurueck: () => void;
}) {
  const [rechnung, setRechnung] = useState<Rechnung | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [absender, setAbsender] = useState<Absender | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [sendetGerade, setSendetGerade] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rechnungId]);

  async function laden() {
    setLaedt(true);
    const { data: r } = await supabase.from("plattform_rechnungen").select("*").eq("id", rechnungId).single();
    if (r) {
      setRechnung(r as unknown as Rechnung);
      const [{ data: org }, { data: abs }] = await Promise.all([
        supabase.from("organisationen").select("name, adresse, email").eq("id", r.organisation_id).single(),
        supabase.from("plattform_einstellungen").select("firmenname, adresse, email, telefon, ust_id, iban").eq("id", true).single(),
      ]);
      setOrganisation(org as Organisation);
      setAbsender(abs as Absender);
    }
    setLaedt(false);
  }

  async function versenden() {
    setSendetGerade(true);
    setHinweis(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sende-plattform-rechnung`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({ rechnungId }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setHinweis(
          json.grund === "keine_email"
            ? "Diese Firma hat keine E-Mail-Adresse hinterlegt."
            : json.grund === "resend_nicht_konfiguriert"
            ? "Mail-Versand ist noch nicht eingerichtet (RESEND_API_KEY/ABSENDER_EMAIL fehlen)."
            : "Versand fehlgeschlagen.",
        );
      } else {
        setHinweis(null);
        laden();
      }
    } catch {
      setHinweis("Versand fehlgeschlagen (Netzwerkfehler).");
    }
    setSendetGerade(false);
  }

  if (laedt) return <p className="text-sm text-[var(--text-faint)]">Lädt…</p>;
  if (!rechnung) return <p className="text-sm text-[var(--text-faint)]">Rechnung nicht gefunden.</p>;

  return (
    <div className="space-y-4">
      <div className="keine-druckansicht flex items-center justify-between">
        <button onClick={onZurueck} className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]">
          ← Zurück
        </button>
        <div className="flex items-center gap-2">
          {rechnung.status === "entwurf" ? (
            <button
              onClick={versenden}
              disabled={sendetGerade}
              className="rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {sendetGerade ? "Sende…" : "Per E-Mail versenden"}
            </button>
          ) : (
            <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              ✓ Versendet {rechnung.versendet_am && new Date(rechnung.versendet_am).toLocaleDateString("de-DE")}
            </span>
          )}
          <button onClick={() => window.print()} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Drucken / Als PDF
          </button>
        </div>
      </div>
      {hinweis && <p className="keine-druckansicht text-xs text-red-600">{hinweis}</p>}

      <div className="druckbereich rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-6 print:border-0 print:p-0">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="font-semibold text-[var(--text-strong)]">{absender?.firmenname}</p>
            {absender?.adresse && <p className="whitespace-pre-line text-xs text-[var(--text-soft)]">{absender.adresse}</p>}
            {(absender?.telefon || absender?.email) && (
              <p className="text-xs text-[var(--text-soft)]">{[absender?.telefon, absender?.email].filter(Boolean).join(" · ")}</p>
            )}
            {absender?.ust_id && <p className="text-xs text-[var(--text-soft)]">USt-IdNr.: {absender.ust_id}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-lg font-semibold text-[var(--text-strong)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Rechnung
            </h2>
            <p className="text-sm text-[var(--text-soft)]">{rechnung.rechnungsnummer}</p>
            <p className="text-sm text-[var(--text-soft)]">{monatLabel(rechnung.monat)}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-[var(--text-faint)]">Firma</p>
          <p className="text-sm font-medium text-[var(--text-strong)]">{organisation?.name}</p>
          {organisation?.adresse && <p className="whitespace-pre-line text-sm text-[var(--text-soft)]">{organisation.adresse}</p>}
        </div>

        <p className="mb-2 text-xs text-[var(--text-faint)]">
          Tarif "{rechnung.tarif_name}" · {rechnung.mitarbeiter_anzahl} aktive Mitarbeiter
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-faint)]">
              <th className="py-1.5 pr-2">Position</th>
              <th className="py-1.5 text-right">Betrag</th>
            </tr>
          </thead>
          <tbody>
            {rechnung.positionen.map((p, i) => (
              <tr key={i} className="border-b border-[var(--border)]">
                <td className="py-1.5 pr-2 align-top text-[var(--text-strong)]">{p.label}</td>
                <td className="py-1.5 align-top text-right font-mono text-[var(--text-strong)]">{formatEuro(p.betrag_cent)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between border-t border-[var(--border)] pt-1 text-[var(--text-soft)]">
              <span>Netto</span>
              <span className="font-mono">{formatEuro(rechnung.netto_cent)}</span>
            </div>
            <div className="flex justify-between text-[var(--text-soft)]">
              <span>MwSt. ({Number(rechnung.mwst_satz).toLocaleString("de-DE")} %)</span>
              <span className="font-mono">{formatEuro(rechnung.mwst_cent)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--border)] pt-1 font-semibold text-[var(--text-strong)]">
              <span>Gesamt (Brutto)</span>
              <span className="font-mono">{formatEuro(rechnung.brutto_cent)}</span>
            </div>
          </div>
        </div>

        {absender?.iban && (
          <div className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-faint)]">
            <p>Bitte überweise den Betrag auf IBAN {absender.iban}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
