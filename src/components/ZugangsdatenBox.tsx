import { useState } from "react";

interface ZugangsdatenBoxProps {
  email: string;
  passwort?: string;
  link?: string;
  telefon?: string;
  onSchliessen: () => void;
}

export default function ZugangsdatenBox({
  email,
  passwort,
  link,
  telefon,
  onSchliessen,
}: ZugangsdatenBoxProps) {
  const [kopiert, setKopiert] = useState(false);

  const text = passwort
    ? `Zugangsdaten für dein Login:\nE-Mail: ${email}\nPasswort: ${passwort}`
    : `Hier ist dein Link, um dein Konto einzurichten:\n${link}`;

  async function kopieren() {
    await navigator.clipboard.writeText(text);
    setKopiert(true);
    setTimeout(() => setKopiert(false), 2000);
  }

  function perWhatsapp() {
    const nummer = telefon?.replace(/[^0-9]/g, "");
    const url = nummer
      ? `https://wa.me/${nummer}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  function perMail() {
    const betreff = encodeURIComponent("Dein Zugang zum Ticketsystem");
    window.open(`mailto:${email}?subject=${betreff}&body=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-500/10">
      <p className="mb-2 font-medium text-[var(--text-strong)]">
        {passwort ? "Account angelegt – Zugangsdaten weitergeben:" : "Link erzeugt – weitergeben:"}
      </p>

      <p className="mb-1 font-mono text-xs text-[var(--text-strong)]">{email}</p>
      {passwort && <p className="mb-1 font-mono text-xs text-[var(--text-strong)]">{passwort}</p>}
      {link && (
        <p className="mb-2 break-all font-mono text-xs text-[var(--text-soft)]">{link}</p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={perWhatsapp}
          className="rounded bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          Per WhatsApp senden
        </button>
        <button
          onClick={perMail}
          className="rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
        >
          Per E-Mail senden
        </button>
        <button
          onClick={kopieren}
          className="rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
        >
          {kopiert ? "Kopiert ✓" : "Kopieren"}
        </button>
        <button
          onClick={onSchliessen}
          className="ml-auto text-xs text-[var(--text-faint)] hover:underline"
        >
          Ausblenden
        </button>
      </div>

      {!telefon && (
        <p className="mt-2 text-xs text-[var(--text-faint)]">
          Keine Telefonnummer hinterlegt – WhatsApp öffnet sich ohne vorausgewählten Empfänger,
          Nummer dann manuell eintragen.
        </p>
      )}
    </div>
  );
}
