import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

export type Rolle = "super_admin" | "org_admin" | "techniker" | "kunde";

export interface Profil {
  id: string;
  organisation_id: string | null;
  rolle: Rolle;
  name: string | null;
  deaktiviert: boolean;
}

export function useProfil() {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [eingeloggt, setEingeloggt] = useState<boolean | null>(null);
  const [laedt, setLaedt] = useState(true);
  const aktuelleUserId = useRef<string | null>(null);

  useEffect(() => {
    ladeProfil(true);

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED feuert bei jedem Tab-Fokus - das darf die App
      // NICHT neu laden, sonst gehen ungespeicherte Formulardaten verloren.
      if (event === "TOKEN_REFRESHED") return;

      // Nur reagieren, wenn sich der Nutzer tatsächlich geändert hat
      // (Login, Logout, Nutzerwechsel) - nicht bei erneutem SIGNED_IN
      // desselben Nutzers nach Tab-Wechsel.
      const neueUserId = session?.user?.id ?? null;
      if (neueUserId === aktuelleUserId.current) return;

      ladeProfil(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function ladeProfil(mitLadezustand = false) {
    if (mitLadezustand) setLaedt(true);
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      aktuelleUserId.current = null;
      setEingeloggt(false);
      setProfil(null);
      setLaedt(false);
      return;
    }

    aktuelleUserId.current = authData.user.id;
    setEingeloggt(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, organisation_id, rolle, name, deaktiviert")
      .eq("id", authData.user.id)
      .single();
    setProfil((data as Profil) ?? null);
    setLaedt(false);
  }

  return { profil, eingeloggt, laedt, neuLaden: () => ladeProfil(false) };
}
