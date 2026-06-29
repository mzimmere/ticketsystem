import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import Avatar from "./Avatar";

type Verfuegbarkeit = "verfuegbar" | "abwesend" | "urlaub";

interface Kollege {
  id: string;
  name: string | null;
}

const VERFUEGBARKEIT_LABEL: Record<Verfuegbarkeit, string> = {
  verfuegbar: "Verfügbar",
  abwesend: "Abwesend",
  urlaub: "Urlaub",
};

interface MeinProfilProps {
  profilId: string;
  organisationId: string | null;
  istIntern: boolean;
}

export default function MeinProfil({ profilId, organisationId, istIntern }: MeinProfilProps) {
  const [name, setName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [verfuegbarkeit, setVerfuegbarkeit] = useState<Verfuegbarkeit>("verfuegbar");
  const [kollegen, setKollegen] = useState<Kollege[]>([]);
  const [uebergabeAn, setUebergabeAn] = useState("");
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    ladeProfil();
    if (istIntern && organisationId) ladeKollegen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ladeProfil() {
    const { data } = await supabase
      .from("profiles")
      .select("name, avatar_url, verfuegbarkeit")
      .eq("id", profilId)
      .single();
    if (data) {
      setName(data.name);
      setAvatarUrl(data.avatar_url);
      setVerfuegbarkeit((data.verfuegbarkeit as Verfuegbarkeit) ?? "verfuegbar");
    }
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
    </div>
  );
}
