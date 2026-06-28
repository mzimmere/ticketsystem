import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export type Rolle = "super_admin" | "org_admin" | "techniker" | "kunde";

export interface Profil {
  id: string;
  organisation_id: string | null;
  rolle: Rolle;
  name: string | null;
}

export function useProfil() {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [eingeloggt, setEingeloggt] = useState<boolean | null>(null);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    ladeProfil();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      ladeProfil();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function ladeProfil() {
    setLaedt(true);
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      setEingeloggt(false);
      setProfil(null);
      setLaedt(false);
      return;
    }

    setEingeloggt(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, organisation_id, rolle, name")
      .eq("id", authData.user.id)
      .single();
    setProfil((data as Profil) ?? null);
    setLaedt(false);
  }

  return { profil, eingeloggt, laedt, neuLaden: ladeProfil };
}
