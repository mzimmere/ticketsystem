import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabaseClient";

export type Sprache = "de" | "en";

interface SpracheContextWert {
  sprache: Sprache;
  setSprache: (neu: Sprache) => void;
}

const SpracheContext = createContext<SpracheContextWert>({
  sprache: "de",
  setSprache: () => {},
});

export function useSprache() {
  return useContext(SpracheContext);
}

function istGueltigeSprache(wert: unknown): wert is Sprache {
  return wert === "de" || wert === "en";
}

// Sprachwahl gilt geraeteuebergreifend (profiles.sprache), damit sie beim
// Login auf einem anderen Geraet erhalten bleibt. Vor dem Login (Login.tsx
// selbst hat ja noch keinen eingeloggten Nutzer) dient localStorage als
// Zwischenspeicher, damit die Umschaltung auch dort schon funktioniert;
// sobald ein Profil geladen ist, gewinnt dessen gespeicherter Wert.
export function SpracheProvider({ children }: { children: ReactNode }) {
  const [sprache, setSpracheState] = useState<Sprache>(() => {
    const gespeichert = localStorage.getItem("sprache");
    return istGueltigeSprache(gespeichert) ? gespeichert : "de";
  });

  useEffect(() => {
    document.documentElement.lang = sprache;
  }, [sprache]);

  useEffect(() => {
    let abgebrochen = false;

    async function vomProfilLaden() {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) return;
      const { data } = await supabase.from("profiles").select("sprache").eq("id", userId).maybeSingle();
      if (!abgebrochen && istGueltigeSprache(data?.sprache)) {
        setSpracheState(data.sprache);
        localStorage.setItem("sprache", data.sprache);
      }
    }

    vomProfilLaden();
    const { data: listener } = supabase.auth.onAuthStateChange(() => vomProfilLaden());
    return () => {
      abgebrochen = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function setSprache(neu: Sprache) {
    setSpracheState(neu);
    localStorage.setItem("sprache", neu);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (userId) {
      await supabase.from("profiles").update({ sprache: neu }).eq("id", userId);
    }
  }

  return <SpracheContext.Provider value={{ sprache, setSprache }}>{children}</SpracheContext.Provider>;
}
