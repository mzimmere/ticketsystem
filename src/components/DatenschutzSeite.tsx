import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface OrgDatenschutz {
  name: string;
  datenschutz_text: string | null;
}

interface DatenschutzSeiteProps {
  slug: string;
}

export default function DatenschutzSeite({ slug }: DatenschutzSeiteProps) {
  const [organisation, setOrganisation] = useState<OrgDatenschutz | null>(null);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    supabase
      .rpc("get_organisation_by_slug", { p_slug: slug })
      .then(({ data }) => {
        setOrganisation(data && data.length > 0 ? data[0] : null);
        setLaedt(false);
      });
  }, [slug]);

  if (laedt) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-muted)] p-6">
      <div className="mx-auto max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <h1 className="mb-4 text-lg font-semibold text-[var(--text-strong)]">
          Datenschutzerklärung{organisation ? ` – ${organisation.name}` : ""}
        </h1>
        {organisation?.datenschutz_text ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-soft)]">
            {organisation.datenschutz_text}
          </p>
        ) : (
          <p className="text-sm text-[var(--text-faint)]">
            Für diese Firma wurde noch keine Datenschutzerklärung hinterlegt.
          </p>
        )}
      </div>
    </div>
  );
}
