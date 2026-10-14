import { useEffect, useState } from "react";
import { usePrefs } from "./prefs.ts";

export function useResolvedTheme(): "light" | "dark" {
  const theme = usePrefs((state) => state.theme);
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      setResolved(theme === "system" ? (media.matches ? "dark" : "light") : theme);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return resolved;
}
