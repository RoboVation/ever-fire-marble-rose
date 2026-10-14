import type { Lang } from "./transit/types.ts";

export function localeFor(lang: Lang): string {
  if (lang === "si") return "si-LK";
  if (lang === "ta") return "ta-LK";
  return "en-LK";
}

export function formatClock(epoch: number, lang: Lang): string {
  return new Intl.DateTimeFormat(localeFor(lang), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Colombo",
  }).format(new Date(epoch));
}

export function formatLkr(amount: number, lang: Lang): string {
  return new Intl.NumberFormat(localeFor(lang), {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatWhen(iso: string | null, lang: Lang): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(localeFor(lang), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  }).format(date);
}
