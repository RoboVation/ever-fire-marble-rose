import { useI18n } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { Lang } from "@/lib/transit/types";
import { cn } from "@/lib/utils";

const options: { id: Lang; label: string }[] = [
  { id: "en", label: "EN" },
  { id: "si", label: "සිං" },
  { id: "ta", label: "த" },
];

export function LanguageSwitch() {
  const { t, lang } = useI18n();
  const setLang = usePrefs((state) => state.setLang);
  return (
    <div role="radiogroup" aria-label={t("language")} className="flex rounded-md border border-border p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={lang === option.id}
          onClick={() => setLang(option.id)}
          className={cn(
            "h-9 min-w-10 rounded-sm px-2 text-sm",
            lang === option.id ? "bg-primary text-primary-fg" : "text-muted",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
