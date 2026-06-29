import { useState } from "react";

interface ZugangsdatenBoxProps {
  email: string;
  passwort?: string;
  link?: string;
  telefon?: string;
  firmenName?: string | null;
  firmenAdresse?: string | null;
  logoUrl?: string | null;
  onSchliessen: () => void;
}

export default function ZugangsdatenBox({
  email,
  passwort,
  link,
  telefon,
  firmenName,
  firmenAdresse,
  logoUrl,
  onSchliessen,
}: ZugangsdatenBoxProps) {
  const [kopiert, setKopiert] = useState(false);
  const seitenUrl = window.location.origin;
  const absender = firmenName ? firmenName : "dein IT-Team";
  const signaturZeilen = [``, `—`, firmenName ?? "", firmenAdresse ?? ""].filter(
    (z) => z !== "",
  );
  const signatur = signaturZeilen.join("\n");

  const text = passwort
    ? [
        `Hallo! ${absender} hat dir einen Zugang zum Ticketsystem eingerichtet.`,
        ``,
        `So loggst du dich ein:`,
        `1. Öffne ${seitenUrl}`,
        `2. Melde dich mit folgenden Daten an:`,
        `   E-Mail: ${email}`,
        `   Passwort: ${passwort}`,
        ``,
        `Dort siehst du deine Anfragen und kannst neue stellen.`,
        signatur,
      ].join("\n")
    : [
        `Hallo! ${absender} hat dir einen Zugang zum Ticketsystem eingerichtet.`,
        ``,
        `So richtest du dein Konto ein:`,
        `1. Klick auf diesen Link: ${link}`,
        `2. Lege dort dein eigenes Passwort fest`,
        `3. Danach kannst du dich jederzeit unter ${seitenUrl} mit deiner E-Mail und diesem Passwort einloggen.`,
        ``,
        `Hinweis: Der Link ist nur 24 Stunden gültig. Falls er nicht mehr funktioniert, sag kurz Bescheid - du bekommst dann einfach einen neuen.`,
        signatur,
      ].join("\n");

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
    const betreff = encodeURIComponent(
      firmenName ? `Dein Zugang zum Ticketsystem von ${firmenName}` : "Dein Zugang zum Ticketsystem",
    );
    window.open(`mailto:${email}?subject=${betreff}&body=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-500/10">
      <div className="mb-2 flex items-center gap-2">
        {logoUrl && <img src={logoUrl} alt={firmenName ?? ""} className="h-6 w-6 rounded" />}
        <p className="font-medium text-[var(--text-strong)]">
          {passwort ? "Account angelegt – Zugangsdaten weitergeben:" : "Link erzeugt – weitergeben:"}
        </p>
      </div>

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
