import { useEffect } from "react";
import { supabase } from "./supabaseClient";

let letzterErfassterTag: string | null = null;

// Zaehlt pro Browser-Sitzung und Kalendertag einen Besuch (Tabelle
// nutzer_besuche, Abschnitt 84). Ein Neuladen der Seite zaehlt nicht, ein
// neuer Tab/Browser oder ein neuer Tag schon. Fehler blockieren nie die App.
export function useBesuchErfassung(nutzerId: string | undefined) {
  useEffect(() => {
    if (!nutzerId) return;

    function erfassen() {
      const heute = new Date().toLocaleDateString("sv-SE");
      let bereitsGezaehlt = letzterErfassterTag === heute;
      try {
        bereitsGezaehlt = bereitsGezaehlt || sessionStorage.getItem("besuch-tag") === heute;
        if (!bereitsGezaehlt) sessionStorage.setItem("besuch-tag", heute);
      } catch {
        // sessionStorage nicht verfuegbar - dann reicht der Merker im Speicher
      }
      if (bereitsGezaehlt) return;
      letzterErfassterTag = heute;
      supabase.rpc("besuch_erfassen").then(({ error }) => {
        if (error) console.debug("[besuch_erfassen] fehlgeschlagen:", error.message);
      });
    }

    erfassen();
    const beiSichtbar = () => {
      if (document.visibilityState === "visible") erfassen();
    };
    document.addEventListener("visibilitychange", beiSichtbar);
    return () => document.removeEventListener("visibilitychange", beiSichtbar);
  }, [nutzerId]);
}
