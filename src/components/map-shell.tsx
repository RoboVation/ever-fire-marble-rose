import type { ReactNode } from "react";
import { LocateFixed, Moon, Sun } from "lucide-react";
import { AppNav } from "@/components/nav";
import { TransitMap, type MapLine, type MapPoint } from "@/components/transit-map";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useResolvedTheme } from "@/lib/theme";

export function MapShell({
  panel,
  lines,
  stops,
  vehicles,
  user,
  fitKey,
  fitCoordinates,
  onSelectStop,
  onMove,
  onLocate,
  locating,
}: {
  panel: ReactNode;
  lines: MapLine[];
  stops: MapPoint[];
  vehicles: MapPoint[];
  user: { lng: number; lat: number } | null;
  fitKey: string | null;
  fitCoordinates: [number, number][] | null;
  onSelectStop?: (id: string) => void;
  onMove?: (center: { lng: number; lat: number }) => void;
  onLocate?: () => void;
  locating?: boolean;
}) {
  const { t } = useI18n();
  const theme = useResolvedTheme();
  const setTheme = usePrefs((state) => state.setTheme);
  return (
    <div className="flex h-dvh flex-col bg-bg text-fg md:flex-row">
      <div className="relative h-map shrink-0 md:order-2 md:h-auto md:min-h-0 md:flex-1">
        <TransitMap
          theme={theme}
          lines={lines}
          stops={stops}
          vehicles={vehicles}
          user={user}
          fitKey={fitKey}
          fitCoordinates={fitCoordinates}
          onSelectStop={onSelectStop}
          onMove={onMove}
          failedLabel={t("mapFailed")}
        />
        <div className="pointer-events-none absolute top-3 left-3 z-10">
          <span className="pointer-events-auto inline-flex rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted">
            {t("sampleBadge")}
          </span>
        </div>
        <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-2">
          <Button
            variant="secondary"
            size="icon"
            aria-label={theme === "dark" ? t("lightMap") : t("darkMap")}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
          {onLocate ? (
            <Button variant="secondary" size="icon" aria-label={t("locate")} onClick={onLocate} disabled={locating}>
              <LocateFixed className="size-5" />
            </Button>
          ) : null}
        </div>
      </div>
      <section className="flex min-h-0 flex-1 flex-col border-border bg-bg md:order-1 md:h-dvh md:w-panel md:flex-none md:border-r">
        {panel}
        <AppNav />
      </section>
    </div>
  );
}
