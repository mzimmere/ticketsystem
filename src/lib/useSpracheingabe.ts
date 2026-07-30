import { useState, useRef, useCallback, useEffect } from "react";

// Eigene, minimale Typen statt der (in diesem TS-Lib-Target fehlenden)
// DOM-Typen fuer die Web Speech API - deckt nur das ab, was hier
// tatsaechlich genutzt wird.
interface SpracherkennungErgebnis {
  transcript: string;
}
interface SpracherkennungEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<SpracherkennungErgebnis>>;
}
interface SpracherkennungInstanz {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpracherkennungEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpracherkennungConstructor = new () => SpracherkennungInstanz;

function holeKonstruktor(): SpracherkennungConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpracherkennungConstructor;
    webkitSpeechRecognition?: SpracherkennungConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Nur in Chromium-basierten Browsern (Chrome, Edge) zuverlaessig
// unterstuetzt; Firefox kennt die API nicht, Safari nur eingeschraenkt.
export const spracheingabeUnterstuetzt = holeKonstruktor() !== null;

export function useSpracheingabe(onText: (text: string) => void) {
  const [aktiv, setAktiv] = useState(false);
  const erkennungRef = useRef<SpracherkennungInstanz | null>(null);

  const stoppen = useCallback(() => {
    erkennungRef.current?.stop();
    erkennungRef.current = null;
    setAktiv(false);
  }, []);

  const starten = useCallback(() => {
    const Konstruktor = holeKonstruktor();
    if (!Konstruktor) return;
    const erkennung = new Konstruktor();
    erkennung.lang = "de-DE";
    erkennung.continuous = true;
    erkennung.interimResults = false;
    erkennung.onresult = (e) => {
      const text = Array.from(e.results)
        .slice(e.resultIndex)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onText(text);
    };
    erkennung.onerror = () => setAktiv(false);
    erkennung.onend = () => setAktiv(false);
    erkennung.start();
    erkennungRef.current = erkennung;
    setAktiv(true);
  }, [onText]);

  useEffect(() => {
    return () => {
      erkennungRef.current?.stop();
    };
  }, []);

  return { aktiv, starten, stoppen };
}
