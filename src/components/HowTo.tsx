import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

interface HowToSchritt {
  titel: string;
  text: string;
}

const INTERN_SCHRITTE: HowToSchritt[] = [
  {
    titel: "Ticketübersicht",
    text: "Alle Anfragen der Firma auf einen Blick. Über die Chips oben filtern (Nur meine, SLA verletzt, Status, Priorität) und über die Suche nach Titel, Kunde, Nr. oder direkt im Nachrichtenverlauf suchen.",
  },
  {
    titel: "Ticket bearbeiten",
    text: "Status ändern, einem Techniker zuweisen, öffentlich (für den Kunden sichtbar) oder intern (nur fürs Team) antworten. Dateien können per Drag & Drop angehängt werden.",
  },
  {
    titel: "Schnelle Antworten",
    text: "Unter Verwaltung → Werkzeuge stehen Vorlagen (fertige Antworttexte) und Makros (mehrere Aktionen auf einmal, z.B. Status + Antwort) bereit.",
  },
  {
    titel: "SLA & Eskalation",
    text: "Ist für die Firma eine SLA-Frist hinterlegt, zeigt das Ticket eine Reaktions- und Lösungsfrist. Wird eine Frist gerissen, erscheint automatisch eine Warnung im Ticket und eine E-Mail geht an den zuständigen Techniker bzw. die Admins.",
  },
  {
    titel: "Dashboard",
    text: "Kennzahlen zu Ticketaufkommen, Reaktionszeiten und SLA-Einhaltung – zu finden über das Balken-Symbol in der linken Leiste.",
  },
];

const KUNDE_SCHRITTE: HowToSchritt[] = [
  {
    titel: "Neue Anfrage stellen",
    text: "Über \"+ Neue Anfrage\" ein Anliegen kurz beschreiben. Das Team meldet sich direkt im Ticket zurück.",
  },
  {
    titel: "Status verfolgen",
    text: "Der Bearbeitungsstand (Offen, In Bearbeitung, Wartet auf dich, Gelöst) ist jederzeit live sichtbar – keine Nachfrage per Telefon nötig.",
  },
  {
    titel: "Antworten & Dateien",
    text: "Auf Rückfragen direkt im Ticket antworten, auch Dateien (z.B. Fotos) lassen sich anhängen.",
  },
  {
    titel: "Häufige Fragen",
    text: "Unter dem FAQ-Bereich stehen Antworten auf die häufigsten Fragen – oft schneller als eine neue Anfrage zu stellen.",
  },
];

interface HowToProps {
  istIntern: boolean;
  autoOeffnen: boolean;
  onGesehen: () => void;
}

export default function HowTo({ istIntern, autoOeffnen, onGesehen }: HowToProps) {
  const [offen, setOffen] = useState(autoOeffnen);
  const schritte = istIntern ? INTERN_SCHRITTE : KUNDE_SCHRITTE;

  function schliessen() {
    setOffen(false);
    if (autoOeffnen) onGesehen();
  }

  return (
    <>
      <button
        onClick={() => setOffen(true)}
        title="Anleitung: So funktioniert das Ticketsystem"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-bold text-[var(--text-faint)] transition-colors hover:border-[var(--akzent)] hover:text-[var(--akzent)]"
      >
        ?
      </button>

      {offen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={schliessen}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <h3 className="text-sm font-semibold text-[var(--text-strong)]">
                So funktioniert das Ticketsystem
              </h3>
              <button
                onClick={schliessen}
                className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--bg-muted)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              {schritte.map((s, i) => (
                <div key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-xs font-bold text-[var(--text-strong)]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-[var(--text-strong)]">{s.titel}</p>
                    <p className="text-xs leading-relaxed text-[var(--text-soft)]">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--border)] px-5 py-3">
              <button
                onClick={schliessen}
                className="w-full rounded-lg bg-akzent py-2 text-sm font-medium text-white"
              >
                Verstanden
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export async function howToAlsGesehenMarkieren(profilId: string) {
  await supabase.from("profiles").update({ howto_gesehen: true }).eq("id", profilId);
}
