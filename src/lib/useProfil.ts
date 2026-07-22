import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

export type Rolle = "super_admin" | "org_admin" | "techniker" | "kunde";

export interface Profil {
  id: string;
  organisation_id: string | null;
  rolle: Rolle;
  name: string | null;
  deaktiviert: boolean;
  howto_gesehen: boolean;
}

export interface Mitgliedschaft {
  organisation_id: string;
  organisation_name: string;
  rolle: "techniker" | "org_admin";
}

export function useProfil() {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [mitgliedschaften, setMitgliedschaften] = useState<Mitgliedschaft[]>([]);
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
      setMitgliedschaften([]);
      setLaedt(false);
      return;
    }

    aktuelleUserId.current = authData.user.id;
    setEingeloggt(true);
    const [{ data }, { data: mitgliedDaten }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, organisation_id, rolle, name, deaktiviert, howto_gesehen")
        .eq("id", authData.user.id)
        .single(),
      supabase
        .from("firmen_mitgliedschaften")
        .select("organisation_id, rolle, organisation:organisation_id(name)")
        .eq("profil_id", authData.user.id)
        .eq("deaktiviert", false),
    ]);
    setProfil((data as Profil) ?? null);
    setMitgliedschaften(
      ((mitgliedDaten ?? []) as unknown as Array<{ organisation_id: string; rolle: "techniker" | "org_admin"; organisation: { name: string } | null }>)
        .map((m) => ({ organisation_id: m.organisation_id, rolle: m.rolle, organisation_name: m.organisation?.name ?? "Unbenannt" }))
        .sort((a, b) => a.organisation_name.localeCompare(b.organisation_name)),
    );
    setLaedt(false);
  }

  return { profil, mitgliedschaften, eingeloggt, laedt, neuLaden: () => ladeProfil(false) };
}
