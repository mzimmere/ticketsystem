type Status = "offen" | "in_bearbeitung" | "wartet_auf_kunde" | "geloest" | "geschlossen";

const STATUS_LABEL: Record<Status, string> = {
  offen: "Offen",
  in_bearbeitung: "In Bearbeitung",
  wartet_auf_kunde: "Wartet auf Kunde",
  geloest: "Gelöst",
  geschlossen: "Geschlossen",
};

const STATUS_FARBEN: Record<Status, { bg: string; text: string }> = {
  offen: { bg: "var(--status-offen-bg)", text: "var(--status-offen-text)" },
  in_bearbeitung: { bg: "var(--status-bearbeitung-bg)", text: "var(--status-bearbeitung-text)" },
  wartet_auf_kunde: { bg: "var(--status-warten-bg)", text: "var(--status-warten-text)" },
  geloest: { bg: "var(--status-geloest-bg)", text: "var(--status-geloest-text)" },
  geschlossen: { bg: "var(--status-geschlossen-bg)", text: "var(--status-geschlossen-text)" },
};

// Status, bei denen gerade "etwas in der Schwebe" ist und ein dezenter
// Puls sinnvoll Aufmerksamkeit lenkt - bewusst nicht bei "Offen"
// (sonst pulsiert die ganze Liste) oder abgeschlossenen Status.
const PULSIERT: Status[] = ["wartet_auf_kunde"];

interface StatusBadgeProps {
  status: Status;
  labelOverride?: string;
}

export default function StatusBadge({ status, labelOverride }: StatusBadgeProps) {
  const farben = STATUS_FARBEN[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: farben.bg, color: farben.text }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${PULSIERT.includes(status) ? "status-dot-puls" : ""}`}
        style={{ background: "currentColor" }}
      />
      {labelOverride ?? STATUS_LABEL[status]}
    </span>
  );
}
