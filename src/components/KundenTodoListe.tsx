import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface Todo {
  id: string;
  text: string;
  erledigt: boolean;
}

interface KundenTodoListeProps {
  kundeId: string;
  organisationId: string;
  modus?: "voll" | "kompakt";
}

const KOMPAKT_MAX = 5;

export default function KundenTodoListe({ kundeId, organisationId, modus = "voll" }: KundenTodoListeProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [neuesTodo, setNeuesTodo] = useState("");
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => {
    ladeTodos();
    setNeuesTodo("");
    setHinweis(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kundeId]);

  async function ladeTodos() {
    if (!kundeId) {
      setTodos([]);
      return;
    }
    const { data } = await supabase
      .from("kunden_todos")
      .select("id, text, erledigt")
      .eq("kunde_id", kundeId)
      .order("erledigt", { ascending: true })
      .order("reihenfolge", { ascending: true })
      .order("erstellt_am", { ascending: true });
    setTodos((data as Todo[]) ?? []);
  }

  async function todoHinzufuegen() {
    if (!neuesTodo.trim()) return;
    const { error } = await supabase.from("kunden_todos").insert({
      organisation_id: organisationId,
      kunde_id: kundeId,
      text: neuesTodo.trim(),
    });
    if (error) {
      console.error(error);
      setHinweis("Todo konnte nicht hinzugefügt werden.");
      return;
    }
    setNeuesTodo("");
    ladeTodos();
  }

  async function todoAbhaken(todoId: string, erledigt: boolean) {
    await supabase
      .from("kunden_todos")
      .update({ erledigt, erledigt_am: erledigt ? new Date().toISOString() : null })
      .eq("id", todoId);
    ladeTodos();
  }

  async function todoLoeschen(todoId: string) {
    await supabase.from("kunden_todos").delete().eq("id", todoId);
    ladeTodos();
  }

  if (!kundeId) return null;

  if (modus === "kompakt") {
    const offene = todos.filter((t) => !t.erledigt);
    if (offene.length === 0) return null;
    return (
      <div className="space-y-1.5 rounded-lg border border-dashed border-[var(--border-input)] p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
          Offene Todos dieses Kunden ({offene.length})
        </p>
        <ul className="space-y-0.5">
          {offene.slice(0, KOMPAKT_MAX).map((t) => (
            <li key={t.id} className="text-sm text-[var(--text-strong)]">
              • {t.text}
            </li>
          ))}
        </ul>
        {offene.length > KOMPAKT_MAX && (
          <p className="text-xs text-[var(--text-faint)]">
            +{offene.length - KOMPAKT_MAX} weitere…
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {todos.length > 0 && (
        <div className="space-y-1">
          {todos.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5"
            >
              <input
                type="checkbox"
                checked={t.erledigt}
                onChange={(e) => todoAbhaken(t.id, e.target.checked)}
                className="accent-akzent"
              />
              <span
                className={`flex-1 text-sm ${
                  t.erledigt
                    ? "text-[var(--text-faint)] line-through"
                    : "text-[var(--text-strong)]"
                }`}
              >
                {t.text}
              </span>
              <button
                onClick={() => todoLoeschen(t.id)}
                className="shrink-0 text-xs text-[var(--text-faint)] hover:text-red-600"
              >
                Löschen
              </button>
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={neuesTodo}
          onChange={(e) => setNeuesTodo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && todoHinzufuegen()}
          placeholder="Neues Todo…"
          className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
        />
        <button
          onClick={todoHinzufuegen}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          +
        </button>
      </div>

      {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}
    </div>
  );
}
