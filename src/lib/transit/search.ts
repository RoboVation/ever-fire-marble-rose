import { LANDMARKS, STOPS, stopById } from "./network.ts";
import type { PlaceRef } from "./types.ts";

function fromStop(id: string): PlaceRef | null {
  const stop = stopById(id);
  if (!stop) return null;
  return {
    key: `stop:${stop.id}`,
    name: stop.name,
    lat: stop.lat,
    lng: stop.lng,
    stopId: stop.id,
    kind: "stop",
  };
}

export function allPlaces(): PlaceRef[] {
  const stops = STOPS.flatMap((stop) => {
    const place = fromStop(stop.id);
    return place ? [place] : [];
  });
  const landmarks: PlaceRef[] = LANDMARKS.flatMap((landmark) => {
    const nearest = stopById(landmark.nearestStopId);
    if (!nearest) return [];
    return [
      {
        key: `landmark:${landmark.id}`,
        name: landmark.name,
        lat: landmark.lat,
        lng: landmark.lng,
        stopId: nearest.id,
        kind: "landmark",
      },
    ];
  });
  return [...landmarks, ...stops];
}

export function resolvePlace(key: string): PlaceRef | null {
  return allPlaces().find((place) => place.key === key) ?? null;
}

export function searchPlaces(query: string, limit = 8): PlaceRef[] {
  const q = query.trim().toLowerCase();
  const places = allPlaces();
  if (!q) return places.filter((place) => place.kind === "landmark").slice(0, limit);
  const ranked = places
    .map((place) => {
      const names = [place.name.en, place.name.si, place.name.ta].map((name) => name.toLowerCase());
      const score = names.some((name) => name.startsWith(q))
        ? 0
        : names.some((name) => name.includes(q))
          ? 1
          : 9;
      return { place, score };
    })
    .filter((item) => item.score < 9)
    .sort((a, b) => a.score - b.score || a.place.name.en.localeCompare(b.place.name.en));
  return ranked.slice(0, limit).map((item) => item.place);
}

export const FALLBACK_ALERT = {
  id: "seed-demo-alert",
  severity: "info" as const,
  routeId: null as string | null,
  title: {
    en: "Sample network only",
    si: "නියැදි ජාලය පමණි",
    ta: "மாதிரி வலையமைப்பு மட்டும்",
  },
  body: {
    en: "This notice is seeded demonstration copy. It is not a live operator disruption. Routes, times, and vehicle positions in Gaman are sample data.",
    si: "මෙය නියැදි දැනුම්දීමකි. සජීවී මෙහෙයුම් බාධාවක් නොවේ. ගමන් මාර්ග, වේලාවන් සහ වාහන ස්ථාන නියැදි දත්තයි.",
    ta: "இது ஒரு மாதிரி அறிவிப்பு. நேரடி இயக்குநர் இடையூறு அல்ல. வழிகள், நேரங்கள், வண்டி நிலைகள் மாதிரி தரவு.",
  },
};
