import { supabase } from "./supabaseClient";
import { ladeSeiten } from "./ladeSeiten";
import type { ExportKunde } from "./kundenExport";

// Alle Kunden einer Firma (optional inkl. archivierter) fuer den Excel-Export.
export function alleKundenLaden(organisationId: string, mitArchiv: boolean): Promise<ExportKunde[]> {
  return ladeSeiten<ExportKunde>((von, bis) => {
    let abfrage = supabase
      .from("profiles")
      .select(
        "id, name, vorname, nachname, firmenname, telefonnummer, strasse, hausnummer, plz, ort, land, mwst_satz, ust_id, notizen, deaktiviert, wartungsvertrag_stufe_id, subreseller_id",
      )
      .eq("organisation_id", organisationId)
      .eq("rolle", "kunde");
    if (!mitArchiv) abfrage = abfrage.eq("deaktiviert", false);
    return abfrage.order("name").range(von, bis);
  });
}
