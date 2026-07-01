import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import Avatar from "./Avatar";

type Verfuegbarkeit = "verfuegbar" | "abwesend" | "urlaub";

interface Kollege {
  id: string;
  name: string | null;
}

interface NutzungsMonat {
  monat: string;
  gesamt_minuten: number;
  gesamt_cent: number;
}

const VERFUEGBARKEIT_LABEL: Record<Verfuegbarkeit, string> = {
  verfuegbar: "Verfügbar",
  abwesend: "Abwesend",
  urlaub: "Urlaub",
};

function formatEuro(cent: number): string {
  return (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function monatLabelKurz(isoDatum: string): string {
  const [j, m] = isoDatum.split("-");
  return new Date(Number(j), Number(m) - 1, 1).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });
}

interface MeinProfilProps {
  profilId: string;
  organisationId: string | null;
  istIntern: boolean;
}

export default function MeinProfil({ profilId, organisationId, istIntern }: MeinProfilProps) {
  const [name, setName] = useState<string | null>(null);
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [telefon, setTelefon] = useState("");
  const [strasse, setStrasse] = useState("");
  const [hausnummer, setHausnummer] = useState("");
  const [plz, setPlz] = useState("");
  const [ort, setOrt] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [verfuegbarkeit, setVerfuegbarkeit] = useState<Verfuegbarkeit>("verfuegbar");
  const [kollegen, setKollegen] = useState<Kollege[]>([]);
  const [uebergabeAn, setUebergabeAn] = useState("");
  const [nutzung, setNutzung] = useState<NutzungsMonat[]>([]);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    ladeProfil();
    if (istIntern && organisationId) ladeKollegen();
    if (!istIntern) ladeNutzung();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ladeNutzung() {
    const { data } = await supabase
      .from("kunde_monatsabrechnung")
      .select("monat, gesamt_minuten, gesamt_cent")
      .eq("kunde_id", profilId)
      .order("monat", { ascending: false })
      .limit(6);
    setNutzung((data as NutzungsMonat[]) ?? []);
  }

  async function ladeProfil() {
    const { data } = await supabase
      .from("profiles")
      .select("name, vorname, nachname, avatar_url, verfuegbarkeit, telefonnummer, strasse, hausnummer, plz, ort")
      .eq("id", profilId)
      .single();
    if (data) {
      setName(data.name);
      setVorname(data.vorname ?? "");
      setNachname(data.nachname ?? "");
      setAvatarUrl(data.avatar_url);
      setVerfuegbarkeit((data.verfuegbarkeit as Verfuegbarkeit) ?? "verfuegbar");
      setTelefon(data.telefonnummer ?? "");
      setStrasse(data.strasse ?? "");
      setHausnummer(data.hausnummer ?? "");
      setPlz(data.plz ?? "");
      setOrt(data.ort ?? "");
    }
  }

  async function kundenProfilSpeichern() {
    if (!vorname.trim()) { setHinweis("Vorname ist erforderlich."); return; }
    setLaedt(true);
    const { error } = await supabase.from("profiles").update({
      vorname: vorname.trim(),
      nachname: nachname.trim() || null,
      telefonnummer: telefon.trim() || null,
      strasse: strasse.trim() || null,
      hausnummer: hausnummer.trim() || null,
      plz: plz.trim() || null,
      ort: ort.trim() || null,
    }).eq("id", profilId);
    setLaedt(false);
    setHinweis(error ? "Fehler beim Speichern." : "Profil gespeichert.");
    if (!error) ladeProfil();
  }

  async function ladeKollegen() {
    const { data } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("organisation_id", organisationId)
      .in("rolle", ["techniker", "org_admin"])
      .neq("id", profilId);
    setKollegen((data as Kollege[]) ?? []);
  }

  async function avatarHochladen(datei: File) {
    setLaedt(true);
    setHinweis(null);
    try {
      const pfad = `${profilId}/${Date.now()}-${sichererDateiname(datei.name)}`;
      const { error: uploadFehler } = await supabase.storage
        .from("avatare")
        .upload(pfad, datei, { upsert: true });
      if (uploadFehler) throw uploadFehler;

      const { data: oeffentlich } = supabase.storage.from("avatare").getPublicUrl(pfad);
      const { error: updateFehler } = await supabase
        .from("profiles")
        .update({ avatar_url: oeffentlich.publicUrl })
        .eq("id", profilId);
      if (updateFehler) throw updateFehler;

      setAvatarUrl(oeffentlich.publicUrl);
      setHinweis("Profilbild aktualisiert.");
    } catch (err) {
      console.error(err);
      setHinweis("Hochladen fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }

  async function verfuegbarkeitAendern(wert: Verfuegbarkeit) {
    const { error } = await supabase
      .from("profiles")
      .update({ verfuegbarkeit: wert })
      .eq("id", profilId);
    if (error) {
      console.error(error);
      setHinweis("Speichern fehlgeschlagen.");
      return;
    }
    setVerfuegbarkeit(wert);
  }

  async function ticketsUebergeben() {
    if (!uebergabeAn) return;
    setLaedt(true);
    setHinweis(null);
    const { data, error } = await supabase.rpc("tickets_uebertragen", {
      von_techniker_id: profilId,
      an_techniker_id: uebergabeAn,
    });
    setLaedt(false);
    if (error) {
      setHinweis("Übergabe fehlgeschlagen.");
    } else {
      setHinweis(`${data ?? 0} Ticket(s) übertragen.`);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-4">
        <h2 className="text-base font-semibold text-[var(--text-strong)]">Mein Profil</h2>

        <div className="flex items-center gap-4">
          <Avatar name={name} avatarUrl={avatarUrl} groesse="lg" />
          <div>
            <label className="inline-block cursor-pointer rounded border border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-strong)] px-3 py-1.5 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">
              Bild ändern
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && avatarHochladen(e.target.files[0])}
              />
            </label>
          </div>
        </div>

        {istIntern && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              Verfügbarkeit
            </label>
            <select
              value={verfuegbarkeit}
              onChange={(e) => verfuegbarkeitAendern(e.target.value as Verfuegbarkeit)}
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            >
              {Object.entries(VERFUEGBARKEIT_LABEL).map(([wert, label]) => (
                <option key={wert} value={wert}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}

        {hinweis && <p className="text-sm text-[var(--text-soft)]">{hinweis}</p>}
      </div>

      {istIntern && kollegen.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <h3 className="text-sm font-medium text-[var(--text-strong)]">
            Offene Tickets übergeben
          </h3>
          <p className="text-xs text-[var(--text-soft)]">
            Übergibt alle dir zugewiesenen, noch offenen Tickets an eine Kollegin/einen Kollegen –
            z.B. bei Urlaub oder Abwesenheit.
          </p>
          <div className="flex gap-2">
            <select
              value={uebergabeAn}
              onChange={(e) => setUebergabeAn(e.target.value)}
              className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            >
              <option value="">Kollege wählen…</option>
              {kollegen.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name ?? "Unbenannt"}
                </option>
              ))}
            </select>
            <button
              onClick={ticketsUebergeben}
              disabled={!uebergabeAn || laedt}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Übergeben
            </button>
          </div>
        </div>
      )}
      {!istIntern && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <h3 className="text-sm font-medium text-[var(--text-strong)]">Meine Kontaktdaten</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Vorname *</label>
              <input type="text" value={vorname} onChange={(e) => setVorname(e.target.value)}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Nachname</label>
              <input type="text" value={nachname} onChange={(e) => setNachname(e.target.value)}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Telefon / WhatsApp</label>
            <input type="text" value={telefon} onChange={(e) => setTelefon(e.target.value)}
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <input type="text" value={strasse} onChange={(e) => setStrasse(e.target.value)}
              placeholder="Straße" className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
            <input type="text" value={hausnummer} onChange={(e) => setHausnummer(e.target.value)}
              placeholder="Nr." className="w-16 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <input type="text" value={plz} onChange={(e) => setPlz(e.target.value)}
              placeholder="PLZ" className="w-24 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
            <input type="text" value={ort} onChange={(e) => setOrt(e.target.value)}
              placeholder="Ort" className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
          </div>
          {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}
          <button onClick={kundenProfilSpeichern} disabled={laedt}
            className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {laedt ? "Speichert…" : "Speichern"}
          </button>
        </div>
      )}

      {!istIntern && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <h3 className="text-sm font-medium text-[var(--text-strong)]">Meine Nutzung</h3>
          {nutzung.length === 0 ? (
            <p className="text-xs text-[var(--text-faint)]">
              Noch keine erfasste Zeit – hier siehst du, sobald Arbeit an deinen Tickets erfasst
              wurde, wie viele Minuten und Kosten das pro Monat ausmacht.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {nutzung.map((n, i) => (
                <div key={n.monat} className="flex items-center justify-between py-2 text-sm">
                  <span className={i === 0 ? "font-medium text-[var(--text-strong)]" : "text-[var(--text-soft)]"}>
                    {monatLabelKurz(n.monat)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-xs text-[var(--text-faint)]">
                      {n.gesamt_minuten} Min.
                    </span>
                    <span className="font-mono text-sm text-[var(--text-strong)]">
                      {formatEuro(n.gesamt_cent)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
