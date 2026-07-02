import { useEffect } from "react";

/**
 * Zeigt die Browser-Warnung "Änderungen verwerfen?" wenn die Seite
 * geschlossen oder neu geladen wird, während ungespeicherte Daten vorliegen.
 */
export function useUngespeichertWarnung(hatUngespeicherteDaten: boolean) {
  useEffect(() => {
    if (!hatUngespeicherteDaten) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome verlangt returnValue
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hatUngespeicherteDaten]);
}
