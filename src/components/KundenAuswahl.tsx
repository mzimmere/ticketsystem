import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ZugangsdatenBox from "./ZugangsdatenBox";

interface Kunde {
  id: string;
  name: string | null;
}

interface KundenAuswahlProps {
  organisationId: string;
  value: string;
  onChange: (kundeId: string) => void;
}

export default function KundenAuswahl({ organisationId, value, onChange }: KundenAuswahlProps) {
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState("");
  const [zeigeNeuerKunde, setZeigeNeuerKunde] = useState(false);
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zugangsdaten, setZugangsdaten] = useState<{ email: string; link?: string; telefon?: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ladeKunden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOffen(false);
        setZeigeNeuerKunde(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function ladeKunden() {
    const { data } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("organisation_id", organisationId)
      .eq("rolle", "kunde")
      .eq("deaktiviert", false)
      .order("name");
    setKunden((data as Kunde[]) ?? []);
  }

  const ausgewaehlterName = kunden.find((k) => k.id === value)?.name ?? null;

  const gefiltert = useMemo(() => {
    const begriff = suche.trim().toLowerCase();
    if (!begriff) return kunden;
    return kunden.filter((k) => (k.name ?? "").toLowerCase().includes(begriff));
  }, [kunden, suche]);

  function auswaehlen(id: string) {
    onChange(id);
    setOffen(false);
    setSuche("");
  }

  async function neuenKundenAnlegen() {
    if (!vorname.trim() || !email.trim()) {
      setFehler("Bitte mindestens Vorname und E-Mail angeben.");
      return;
    }
    setFehler(null);
    setLaedt(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-kunde`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          vorname: vorname.trim(),
          nachname: nachname.trim() || null,
          organisationId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Anlegen fehlgeschlagen");

      if (telefon.trim() && json.userId) {
        await supabase.from("profiles").update({ telefonnummer: telefon.trim() }).eq("id", json.userId);
      }

      await ladeKunden();
      if (json.userId) auswaehlen(json.userId);
      setZugangsdaten({ email: email.trim(), link: json.link, telefon: telefon.trim() || undefined });

      setVorname("");
      setNachname("");
      setEmail("");
      setTelefon("");
      setZeigeNeuerKunde(false);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : String(err));
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOffen(!offen)}
          className="flex w-full items-center justify-between rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-left text-sm"
        >
          <span className={`truncate ${ausgewaehlterName ? "text-[var(--text-strong)]" : "text-[var(--text-faint)]"}`}>
            {ausgewaehlterName ?? "Kunde wählen…"}
          </span>
          <ChevronDown size={14} className="shrink-0 text-[var(--text-faint)]" />
        </button>

        {offen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2 shadow-lg">
            {!zeigeNeuerKunde ? (
              <>
                <input
                  type="text"
                  autoFocus
                  value={suche}
                  onChange={(e) => setSuche(e.target.value)}
                  placeholder="Kunde suchen…"
                  className="mb-2 w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-xs text-[var(--text-strong)]"
                />
                <div className="max-h-56 space-y-0.5 overflow-y-auto">
                  {gefiltert.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => auswaehlen(k.id)}
                      className={`block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-[var(--bg-muted)] ${
                        value === k.id ? "font-semibold text-akzent" : "text-[var(--text-strong)]"
                      }`}
                    >
                      {k.name ?? "Unbenannt"}
                    </button>
                  ))}
                  {gefiltert.length === 0 && (
                    <p className="px-2 py-1 text-xs text-[var(--text-faint)]">Keine Treffer.</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setZeigeNeuerKunde(true)}
                  className="mt-2 w-full rounded border border-dashed border-[var(--border-input)] px-2 py-1.5 text-xs font-medium text-akzent hover:bg-akzent/10"
                >
                  + Neuer Kunde
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--text-soft)]">Neuen Kunden anlegen</p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={vorname}
                    onChange={(e) => setVorname(e.target.value)}
                    placeholder="Vorname*"
                    className="w-1/2 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-xs text-[var(--text-strong)]"
                  />
                  <input
                    type="text"
                    value={nachname}
                    onChange={(e) => setNachname(e.target.value)}
                    placeholder="Nachname"
                    className="w-1/2 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-xs text-[var(--text-strong)]"
                  />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-Mail*"
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-xs text-[var(--text-strong)]"
                />
                <input
                  type="text"
                  value={telefon}
                  onChange={(e) => setTelefon(e.target.value)}
                  placeholder="Telefon (optional)"
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-xs text-[var(--text-strong)]"
                />
                {fehler && <p className="text-xs text-red-600">{fehler}</p>}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={neuenKundenAnlegen}
                    disabled={laedt}
                    className="flex-1 rounded bg-akzent px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {laedt ? "Wird angelegt…" : "Anlegen & auswählen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZeigeNeuerKunde(false);
                      setFehler(null);
                    }}
                    className="rounded border border-[var(--border-input)] px-2 py-1.5 text-xs text-[var(--text-soft)]"
                  >
                    Zurück
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {kunden.length === 0 && !offen && (
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          Noch keine Kunden vorhanden – über "Kunde wählen" → "+ Neuer Kunde" direkt anlegen.
        </p>
      )}

      {zugangsdaten && (
        <div className="mt-2">
          <ZugangsdatenBox
            email={zugangsdaten.email}
            link={zugangsdaten.link}
            telefon={zugangsdaten.telefon}
            onSchliessen={() => setZugangsdaten(null)}
          />
        </div>
      )}
    </div>
  );
}
