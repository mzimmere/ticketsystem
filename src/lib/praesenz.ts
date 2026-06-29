import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

// Nutzt Supabase Realtime "Presence": jeder eingeloggte Nutzer trackt sich
// selbst auf einem gemeinsamen Kanal pro Organisation. Alle, die denselben
// Kanal abonniert haben, sehen automatisch, wer aktuell online ist - ganz
// ohne eigene Tabelle/Polling.
export function useOnlinePraesenz(
  organisationId: string | null | undefined,
  eigeneId: string | null | undefined,
) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!organisationId || !eigeneId) return;

    const channel = supabase.channel(`praesenz-${organisationId}`, {
      config: { presence: { key: eigeneId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setOnlineIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organisationId, eigeneId]);

  return onlineIds;
}
