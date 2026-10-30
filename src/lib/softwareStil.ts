import type { CSSProperties } from "react";

// Einheitliche Farbe je Softwaretyp (nur vorhandene Design-Tokens).
export function softwareStil(software: string): CSSProperties {
  if (software === "exocad") return { background: "var(--badge-mittel-bg)", color: "var(--badge-mittel-text)" };
  if (software === "exoplan") return { background: "var(--status-geloest-bg)", color: "var(--status-geloest-text)" };
  return { background: "var(--bg-surface)", color: "var(--text-soft)" };
}
