import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "./transit/types.ts";

export type SavedJourney = {
  id: string;
  title: string;
  json: string;
  savedAt: number;
};

export type CachedTicket = {
  id: string;
  status: string;
  amountLkr: number;
  summary: string;
  updatedAt: number;
};

type Prefs = {
  lang: Lang;
  theme: "light" | "dark" | "system";
  textSize: "normal" | "large";
  notifyApproach: boolean;
  bannerDismissed: boolean;
  recentKeys: string[];
  homeKey: string | null;
  workKey: string | null;
  favoriteKeys: string[];
  savedJourneys: SavedJourney[];
  ticketCache: CachedTicket[];
  setLang: (lang: Lang) => void;
  setTheme: (theme: Prefs["theme"]) => void;
  setTextSize: (textSize: Prefs["textSize"]) => void;
  setNotify: (notifyApproach: boolean) => void;
  dismissBanner: () => void;
  remember: (key: string) => void;
  setHome: (key: string | null) => void;
  setWork: (key: string | null) => void;
  toggleFavorite: (key: string) => void;
  saveJourney: (journey: SavedJourney) => void;
  removeJourney: (id: string) => void;
  cacheTicket: (ticket: CachedTicket) => void;
  clearPersonal: () => void;
};

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      lang: "en",
      theme: "system",
      textSize: "normal",
      notifyApproach: false,
      bannerDismissed: false,
      recentKeys: [],
      homeKey: null,
      workKey: null,
      favoriteKeys: [],
      savedJourneys: [],
      ticketCache: [],
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      setTextSize: (textSize) => set({ textSize }),
      setNotify: (notifyApproach) => set({ notifyApproach }),
      dismissBanner: () => set({ bannerDismissed: true }),
      remember: (key) =>
        set((state) => ({
          recentKeys: [key, ...state.recentKeys.filter((item) => item !== key)].slice(0, 8),
        })),
      setHome: (homeKey) => set({ homeKey }),
      setWork: (workKey) => set({ workKey }),
      toggleFavorite: (key) =>
        set((state) => ({
          favoriteKeys: state.favoriteKeys.includes(key)
            ? state.favoriteKeys.filter((item) => item !== key)
            : [...state.favoriteKeys, key].slice(0, 12),
        })),
      saveJourney: (journey) =>
        set((state) => ({
          savedJourneys: [journey, ...state.savedJourneys.filter((item) => item.id !== journey.id)].slice(0, 12),
        })),
      removeJourney: (id) =>
        set((state) => ({ savedJourneys: state.savedJourneys.filter((item) => item.id !== id) })),
      cacheTicket: (ticket) =>
        set((state) => ({
          ticketCache: [ticket, ...state.ticketCache.filter((item) => item.id !== ticket.id)].slice(0, 20),
        })),
      clearPersonal: () =>
        set({
          recentKeys: [],
          homeKey: null,
          workKey: null,
          favoriteKeys: [],
          savedJourneys: [],
          ticketCache: [],
        }),
    }),
    { name: "gaman-prefs" },
  ),
);
