import { useState, useEffect } from "react";

export function useTheme() {
  const [dunkel, setDunkel] = useState<boolean>(() => {
    const gespeichert = localStorage.getItem("theme");
    if (gespeichert) return gespeichert === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dunkel);
    localStorage.setItem("theme", dunkel ? "dark" : "light");
  }, [dunkel]);

  return { dunkel, umschalten: () => setDunkel((d) => !d) };
}
