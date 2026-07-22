import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { berechneTarifpreis, type TarifStaffel } from "../lib/tarifBerechnung";
import TarifVerwaltung from "./TarifVerwaltung";
import PlattformRechnungDetail from "./PlattformRechnungDetail";

interface Tarif {
  id: string;
  name: string;
  grundpreis_cent: number;
  inklusive_mitarbeiter: number;
  mwst_satz: number;
  aktiv: boolean;
}

interface OrgZeile {
  id: string;
  name: string;
  tarif_id: string | null;
  mitarbeiter_anzahl: number;
  rechnung: { id: string; status: "entwurf" | "versendet"; brutto_cent: number } | null;
}

function formatEuro(cent: number): string {
  return (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function monatLabel(jahr: number, monat: number): string {
  return new Date(jahr, monat - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

type Tab = "rechnungen" | "tarife" | "absender" | "login";

export default function PlattformAbrechnung() {
  const heute = new Date();
  const [tab, setTab] = useState<Tab>("rechnungen");
  const [jahr, setJahr] = useState(heute.getFullYear());
  const [monat, setMonat] = useState(heute.getMonth() + 1);
  const [orgZeilen, setOrgZeilen] = useState<OrgZeile[]>([]);
  const [tarife, setTarife] = useState<Tarif[]>([]);
  const [staffelnNachTarif, setStaffelnNachTarif] = useState<Record<string, TarifStaffel[]>>({});
  const [laedt, setLaedt] = useState(true);
  const [erstellenLaeuft, setErstellenLaeuft] = useState<string | null>(null);
  const [offeneRechnung, setOffeneRechnung] = useState<string | null>(null);
  const [absender, setAbsender] = useState({
    firmenname: "", adresse: "", email: "", telefon: "", ust_id: "", steuernummer: "", iban: "",
    zahlungsziel_tage: "14", rechtlicher_hinweis: "Rechnungsdatum ist Lieferdatum.", freitext: "",
  });
  const [absenderGespeichert, setAbsenderGespeichert] = useState(false);
  const [branding, setBranding] = useState({ login_titel: "", login_spruch: "" });
  const [brandingGespeichert, setBrandingGespeichert] = useState(false);

  const monatsErster = useMemo(() => `${jahr}-${String(monat).padStart(2, "0")}-01`, [jahr, monat]);

  useEffect(() => {
    if (tab === "rechnungen") laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, monatsErster]);

  useEffect(() => {
    if (tab === "absender") ladeAbsender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === "login") ladeBranding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function laden() {
    setLaedt(true);
    const [{ data: orgDaten }, { data: tarifDaten }, { data: staffelDaten }, { data: rechnungDaten }] = await Promise.all([
      supabase.from("organisationen").select("id, name, tarif_id").order("name"),
      supabase.from("tarife").select("id, name, grundpreis_cent, inklusive_mitarbeiter, mwst_satz, aktiv").order("grundpreis_cent"),
      supabase.from("tarif_staffeln").select("id, tarif_id, von_mitarbeiter, bis_mitarbeiter, preis_pro_mitarbeiter_cent"),
      supabase.from("plattform_rechnungen").select("id, organisation_id, status, brutto_cent").eq("monat", monatsErster),
    ]);

    setTarife((tarifDaten ?? []) as Tarif[]);
    const staffelMap: Record<string, TarifStaffel[]> = {};
    for (const s of staffelDaten ?? []) {
      (staffelMap[s.tarif_id] ??= []).push(s);
    }
    setStaffelnNachTarif(staffelMap);

    const zeilen: OrgZeile[] = await Promise.all(
      (orgDaten ?? []).map(async (org) => {
        // firmen_mitgliedschaften statt profiles: erfasst auch Mitarbeiter,
        // die nur per Mehrfach-Mitgliedschaft mit dieser Firma verknuepft
        // sind (rolle ist dort ohnehin auf techniker/org_admin beschraenkt).
        const { count } = await supabase
          .from("firmen_mitgliedschaften")
          .select("id", { count: "exact", head: true })
          .eq("organisation_id", org.id)
          .eq("deaktiviert", false);
        const rechnung = (rechnungDaten ?? []).find((r) => r.organisation_id === org.id) ?? null;
        return {
          id: org.id,
          name: org.name,
          tarif_id: org.tarif_id,
          mitarbeiter_anzahl: count ?? 0,
          rechnung: rechnung ? { id: rechnung.id, status: rechnung.status, brutto_cent: rechnung.brutto_cent } : null,
        };
      }),
    );
    setOrgZeilen(zeilen);
    setLaedt(false);
  }

  async function ladeAbsender() {
    const { data } = await supabase
      .from("plattform_einstellungen")
      .select("firmenname, adresse, email, telefon, ust_id, steuernummer, iban, zahlungsziel_tage, rechtlicher_hinweis, freitext")
      .eq("id", true)
      .single();
    if (data) {
      setAbsender({
        firmenname: data.firmenname ?? "",
        adresse: data.adresse ?? "",
        email: data.email ?? "",
        telefon: data.telefon ?? "",
        ust_id: data.ust_id ?? "",
        steuernummer: data.steuernummer ?? "",
        iban: data.iban ?? "",
        zahlungsziel_tage: String(data.zahlungsziel_tage ?? 14),
        rechtlicher_hinweis: data.rechtlicher_hinweis ?? "",
        freitext: data.freitext ?? "",
      });
    }
  }

  async function absenderSpeichern() {
    await supabase.from("plattform_einstellungen").update({
      ...absender,
      zahlungsziel_tage: parseInt(absender.zahlungsziel_tage, 10) || 0,
    }).eq("id", true);
    setAbsenderGespeichert(true);
    setTimeout(() => setAbsenderGespeichert(false), 2000);
  }

  async function ladeBranding() {
    const { data } = await supabase
      .from("app_branding")
      .select("login_titel, login_spruch")
      .eq("id", true)
      .single();
    if (data) setBranding(data);
  }

  async function brandingSpeichern() {
    await supabase.from("app_branding").update(branding).eq("id", true);
    setBrandingGespeichert(true);
    setTimeout(() => setBrandingGespeichert(false), 2000);
  }

  async function tarifZuweisen(orgId: string, tarifId: string) {
    await supabase.from("organisationen").update({ tarif_id: tarifId || null }).eq("id", orgId);
    laden();
  }

  function monatWechseln(delta: number) {
    let neuerMonat = monat + delta;
    let neuesJahr = jahr;
    if (neuerMonat > 12) { neuerMonat = 1; neuesJahr += 1; }
    else if (neuerMonat < 1) { neuerMonat = 12; neuesJahr -= 1; }
    setMonat(neuerMonat);
    setJahr(neuesJahr);
  }

  async function naechsteRechnungsnummer(): Promise<string> {
    const { count } = await supabase
      .from("plattform_rechnungen")
      .select("id", { count: "exact", head: true })
      .like("rechnungsnummer", `PR-${jahr}-%`);
    return `PR-${jahr}-${String((count ?? 0) + 1).padStart(3, "0")}`;
  }

  async function rechnungErstellen(zeile: OrgZeile) {
    const tarif = tarife.find((t) => t.id === zeile.tarif_id);
    if (!tarif) return;
    setErstellenLaeuft(zeile.id);
    const staffeln = staffelnNachTarif[tarif.id] ?? [];
    const berechnung = berechneTarifpreis(tarif, staffeln, zeile.mitarbeiter_anzahl);
    const rechnungsnummer = await naechsteRechnungsnummer();

    const { data: einstellungen } = await supabase
      .from("plattform_einstellungen")
      .select("zahlungsziel_tage, rechtlicher_hinweis, freitext")
      .eq("id", true)
      .single();
    const zahlungszielTage = einstellungen?.zahlungsziel_tage ?? 14;
    const heute = new Date();
    const faelligAm = new Date(heute);
    faelligAm.setDate(faelligAm.getDate() + zahlungszielTage);

    const { data, error } = await supabase.from("plattform_rechnungen").insert({
      organisation_id: zeile.id,
      monat: monatsErster,
      rechnungsnummer,
      tarif_name: tarif.name,
      mitarbeiter_anzahl: zeile.mitarbeiter_anzahl,
      grundpreis_cent: tarif.grundpreis_cent,
      staffel_betrag_cent: berechnung.staffelBetragCent,
      positionen: berechnung.positionen,
      netto_cent: berechnung.nettoCent,
      mwst_satz: tarif.mwst_satz,
      mwst_cent: berechnung.mwstCent,
      brutto_cent: berechnung.bruttoCent,
      rechnungsdatum: heute.toISOString().slice(0, 10),
      faellig_am: faelligAm.toISOString().slice(0, 10),
      zahlungsziel_tage: zahlungszielTage,
      rechtlicher_hinweis: einstellungen?.rechtlicher_hinweis ?? null,
      freitext: einstellungen?.freitext ?? null,
    }).select("id").single();

    setErstellenLaeuft(null);
    if (error || !data) return;
    setOffeneRechnung(data.id);
  }

  if (offeneRechnung) {
    return <PlattformRechnungDetail rechnungId={offeneRechnung} onZurueck={() => { setOffeneRechnung(null); laden(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text-strong)]" style={{ fontFamily: "Roboto, sans-serif" }}>
          Plattform-Abrechnung
        </h2>
      </div>

      <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-0.5 w-fit">
        {([["rechnungen", "Rechnungen"], ["tarife", "Tarife"], ["absender", "Absender"], ["login", "Anmeldeseite"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${tab === k ? "bg-[var(--bg-surface)] text-[var(--text-strong)] shadow-sm" : "text-[var(--text-faint)] hover:text-[var(--text-soft)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "tarife" && <TarifVerwaltung />}

      {tab === "absender" && (
        <div className="max-w-md space-y-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-xs text-[var(--text-faint)]">Diese Angaben erscheinen als Absender auf den Rechnungen an die Firmen.</p>
          {([
            ["firmenname", "Firmenname"],
            ["adresse", "Adresse"],
            ["email", "E-Mail"],
            ["telefon", "Telefon"],
            ["ust_id", "USt-IdNr."],
            ["steuernummer", "Steuernummer (falls keine USt-IdNr. vorhanden)"],
            ["iban", "IBAN"],
          ] as const).map(([feld, label]) => (
            <div key={feld}>
              <label className="mb-1 block text-xs text-[var(--text-faint)]">{label}</label>
              <input
                type="text"
                value={absender[feld]}
                onChange={(e) => setAbsender({ ...absender, [feld]: e.target.value })}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm"
              />
            </div>
          ))}

          <div className="border-t border-[var(--border)] pt-2.5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">Rechnungsangaben</p>

            <label className="mb-1 block text-xs text-[var(--text-faint)]">Zahlungsziel (Tage)</label>
            <input
              type="number" min={0}
              value={absender.zahlungsziel_tage}
              onChange={(e) => setAbsender({ ...absender, zahlungsziel_tage: e.target.value })}
              className="w-24 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm"
            />

            <label className="mb-1 mt-2.5 block text-xs text-[var(--text-faint)]">Rechtlicher Hinweis (z.B. "Rechnungsdatum ist Lieferdatum")</label>
            <textarea
              value={absender.rechtlicher_hinweis}
              onChange={(e) => setAbsender({ ...absender, rechtlicher_hinweis: e.target.value })}
              rows={2}
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm"
            />

            <label className="mb-1 mt-2.5 block text-xs text-[var(--text-faint)]">Freitext / Wunschtext (optional, z.B. Gruß oder Skonto-Hinweis)</label>
            <textarea
              value={absender.freitext}
              onChange={(e) => setAbsender({ ...absender, freitext: e.target.value })}
              rows={2}
              placeholder="Vielen Dank für die gute Zusammenarbeit!"
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm"
            />
          </div>

          <button onClick={absenderSpeichern} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            {absenderGespeichert ? "Gespeichert ✓" : "Speichern"}
          </button>
        </div>
      )}

      {tab === "login" && (
        <div className="max-w-md space-y-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-xs text-[var(--text-faint)]">Titel und Spruch, die auf der Anmeldeseite (vor dem Login) angezeigt werden.</p>

          <label className="mb-1 block text-xs text-[var(--text-faint)]">Titel</label>
          <input
            type="text"
            value={branding.login_titel}
            onChange={(e) => setBranding({ ...branding, login_titel: e.target.value })}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm"
          />

          <label className="mb-1 mt-2.5 block text-xs text-[var(--text-faint)]">Spruch</label>
          <textarea
            value={branding.login_spruch}
            onChange={(e) => setBranding({ ...branding, login_spruch: e.target.value })}
            rows={2}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm"
          />

          <button onClick={brandingSpeichern} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            {brandingGespeichert ? "Gespeichert ✓" : "Speichern"}
          </button>
        </div>
      )}

      {tab === "rechnungen" && (
        <>
          <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5">
            <button onClick={() => monatWechseln(-1)} className="rounded px-2 py-1 text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">←</button>
            <span className="text-sm font-medium text-[var(--text-strong)]">{monatLabel(jahr, monat)}</span>
            <button onClick={() => monatWechseln(1)} className="rounded px-2 py-1 text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">→</button>
          </div>

          {laedt ? (
            <p className="text-sm text-[var(--text-faint)]">Lädt…</p>
          ) : orgZeilen.length === 0 ? (
            <p className="text-sm text-[var(--text-faint)]">Noch keine Firmen angelegt.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--border)]">
              <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-muted)] px-4 py-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-[var(--text-faint)]">
                <span className="flex-1">Firma</span>
                <span className="w-40">Tarif</span>
                <span className="w-16 text-right">MA</span>
                <span className="w-24 text-right">Betrag</span>
                <span className="w-40 text-right">Aktion</span>
              </div>
              {orgZeilen.map((z) => {
                const tarif = tarife.find((t) => t.id === z.tarif_id);
                const staffeln = tarif ? staffelnNachTarif[tarif.id] ?? [] : [];
                const berechnung = tarif ? berechneTarifpreis(tarif, staffeln, z.mitarbeiter_anzahl) : null;
                return (
                  <div key={z.id} className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm last:border-b-0">
                    <span className="flex-1 truncate text-[var(--text-strong)]">{z.name}</span>
                    <select
                      value={z.tarif_id ?? ""}
                      onChange={(e) => tarifZuweisen(z.id, e.target.value)}
                      disabled={!!z.rechnung}
                      className="w-40 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-1 text-xs disabled:opacity-50"
                    >
                      <option value="">– kein Tarif –</option>
                      {tarife.filter((t) => t.aktiv || t.id === z.tarif_id).map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <span className="w-16 text-right font-mono text-xs text-[var(--text-soft)]">{z.mitarbeiter_anzahl}</span>
                    <span className="w-24 text-right font-mono text-xs text-[var(--text-strong)]">
                      {z.rechnung ? formatEuro(z.rechnung.brutto_cent) : berechnung ? formatEuro(berechnung.bruttoCent) : "–"}
                    </span>
                    <span className="w-40 text-right">
                      {z.rechnung ? (
                        <button
                          onClick={() => setOffeneRechnung(z.rechnung!.id)}
                          className={`rounded px-2.5 py-1 text-xs font-medium ${z.rechnung.status === "versendet" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-[var(--bg-muted)] text-[var(--text-soft)]"}`}
                        >
                          {z.rechnung.status === "versendet" ? "✓ Versendet" : "Entwurf ansehen"}
                        </button>
                      ) : tarif ? (
                        <button
                          onClick={() => rechnungErstellen(z)}
                          disabled={erstellenLaeuft === z.id}
                          className="rounded bg-akzent px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {erstellenLaeuft === z.id ? "…" : "Rechnung erstellen"}
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--text-faint)]">Kein Tarif zugewiesen</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
