import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface Nachricht {
  id: string;
  betreff: string;
  inhalt: string;
  gelesen: boolean;
  antwort: string | null;
  beantwortet_am: string | null;
  erstellt_am: string;
  organisation_id: string;
  organisation?: { name: string } | null;
}

interface AdminPostfachProps {
  rolle: "super_admin" | "org_admin" | "techniker" | "kunde";
  organisationId: string | null;
}

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPostfach({ rolle, organisationId }: AdminPostfachProps) {
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([]);
  const [betreff, setBetreff] = useState("");
  const [inhalt, setInhalt] = useState("");
  const [antwortEntwurf, setAntwortEntwurf] = useState<Record<string, string>>({});
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  const istSuperAdmin = rolle === "super_admin";

  useEffect(() => {
    ladeNachrichten();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId]);

  async function ladeNachrichten() {
    let query = supabase
      .from("admin_nachrichten")
      .select(
        istSuperAdmin
          ? "id, betreff, inhalt, gelesen, antwort, beantwortet_am, erstellt_am, organisation_id, organisation:organisation_id(name)"
          : "id, betreff, inhalt, gelesen, antwort, beantwortet_am, erstellt_am, organisation_id",
      )
      .order("erstellt_am", { ascending: false });

    if (!istSuperAdmin && organisationId) {
      query = query.eq("organisation_id", organisationId);
    }

    const { data } = await query;
    setNachrichten((data as unknown as Nachricht[]) ?? []);

    if (istSuperAdmin) {
      const ungelesenIds = ((data as unknown as Nachricht[]) ?? [])
        .filter((n) => !n.gelesen)
        .map((n) => n.id);
      if (ungelesenIds.length > 0) {
        await supabase.from("admin_nachrichten").update({ gelesen: true }).in("id", ungelesenIds);
      }
    }
  }

  async function nachrichtSenden() {
    if (!betreff.trim() || !inhalt.trim() || !organisationId) return;
    setLaedt(true);
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase.from("admin_nachrichten").insert({
      organisation_id: organisationId,
      von_id: authData.user?.id,
      betreff: betreff.trim(),
      inhalt: inhalt.trim(),
    });
    setLaedt(false);
    if (error) {
      console.error(error);
      setHinweis("Senden fehlgeschlagen.");
      return;
    }
    setBetreff("");
    setInhalt("");
    setHinweis("Nachricht gesendet.");
    ladeNachrichten();
  }

  async function antworten(id: string) {
    const text = antwortEntwurf[id]?.trim();
    if (!text) return;
    const { error } = await supabase
      .from("admin_nachrichten")
      .update({ antwort: text, beantwortet_am: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error(error);
      setHinweis("Antwort fehlgeschlagen.");
      return;
    }
    setAntwortEntwurf((e) => ({ ...e, [id]: "" }));
    ladeNachrichten();
  }

  return (
    <div className="space-y-4">
      <h2
        className="text-lg font-semibold text-[var(--text-strong)]"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {istSuperAdmin ? "Nachrichten von Firmen" : "Nachricht an Super-Admin"}
      </h2>

      {!istSuperAdmin && (
        <div className="space-y-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <input
            type="text"
            value={betreff}
            onChange={(e) => setBetreff(e.target.value)}
            placeholder="Betreff"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          />
          <textarea
            value={inhalt}
            onChange={(e) => setInhalt(e.target.value)}
            rows={4}
            placeholder="Worum geht's?"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          />
          <button
            onClick={nachrichtSenden}
            disabled={laedt}
            className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {laedt ? "Wird gesendet…" : "Senden"}
          </button>
          {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}
        </div>
      )}

      {nachrichten.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">
          {istSuperAdmin ? "Keine Nachrichten vorhanden." : "Noch keine Nachrichten gesendet."}
        </p>
      ) : (
        <div className="space-y-2">
          {nachrichten.map((n) => (
            <div
              key={n.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--text-strong)]">{n.betreff}</p>
                {!n.gelesen && istSuperAdmin && (
                  <span className="shrink-0 rounded-full bg-akzent px-2 py-0.5 text-[0.65rem] font-medium text-white">
                    Neu
                  </span>
                )}
              </div>
              {istSuperAdmin && n.organisation?.name && (
                <p className="text-xs text-[var(--text-faint)]">Von: {n.organisation.name}</p>
              )}
              <p className="text-sm text-[var(--text-soft)]">{n.inhalt}</p>
              <p className="font-mono text-xs text-[var(--text-faint)]">
                {formatDatum(n.erstellt_am)}
              </p>

              {n.antwort && (
                <div className="rounded bg-[var(--bg-muted)] p-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                    Antwort
                  </p>
                  <p className="text-sm text-[var(--text-strong)]">{n.antwort}</p>
                  {n.beantwortet_am && (
                    <p className="mt-1 font-mono text-xs text-[var(--text-faint)]">
                      {formatDatum(n.beantwortet_am)}
                    </p>
                  )}
                </div>
              )}

              {istSuperAdmin && !n.antwort && (
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={antwortEntwurf[n.id] ?? ""}
                    onChange={(e) =>
                      setAntwortEntwurf((s) => ({ ...s, [n.id]: e.target.value }))
                    }
                    placeholder="Antworten…"
                    className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                  />
                  <button
                    onClick={() => antworten(n.id)}
                    className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                  >
                    Antworten
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
