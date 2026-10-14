import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, Bus, TrainFront } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { MapShell } from "@/components/map-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createShare, createTicket, listAlerts, listOverrides, reportCount, sendArrivalReport } from "@/lib/api";
import { formatClock, formatDistance, formatLkr } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { walkMeters } from "@/lib/transit/geo";
import { LANDMARKS, routeById, routeLines, STOPS, stopById } from "@/lib/transit/network";
import { planJourneys, type Journey, type SortMode } from "@/lib/transit/planner";
import { FALLBACK_ALERT, resolvePlace, searchPlaces } from "@/lib/transit/search";
import type { Localized } from "@/lib/transit/types";
import { arrivalsAt, sampleVehicles } from "@/lib/transit/vehicles";
import { useResolvedTheme } from "@/lib/theme";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { AlertView, OverrideView } from "@/lib/ticket-types";
import { cn } from "@/lib/utils";

const HERE: Localized = { en: "Your location", si: "ඔබේ ස්ථානය", ta: "உங்கள் இடம்" };
const SORTS: SortMode[] = ["fastest", "fare", "transfers", "walk"];

export function MapExperience({ fromKey, toKey }: { fromKey?: string; toKey?: string }) {
  const { t, n, lang } = useI18n();
  const navigate = useNavigate();
  const theme = useResolvedTheme();
  const { user, isPending } = useCurrentUserState();
  const remember = usePrefs((state) => state.remember);
  const recentKeys = usePrefs((state) => state.recentKeys);
  const homeKey = usePrefs((state) => state.homeKey);
  const workKey = usePrefs((state) => state.workKey);
  const favoriteKeys = usePrefs((state) => state.favoriteKeys);
  const setHome = usePrefs((state) => state.setHome);
  const setWork = usePrefs((state) => state.setWork);
  const toggleFavorite = usePrefs((state) => state.toggleFavorite);
  const saveLocalJourney = usePrefs((state) => state.saveJourney);
  const bannerDismissed = usePrefs((state) => state.bannerDismissed);
  const dismissBanner = usePrefs((state) => state.dismissBanner);
  const [query, setQuery] = useState("");
  const [field, setField] = useState<"to" | "from">("to");
  const [sort, setSort] = useState<SortMode>("fastest");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusStop, setFocusStop] = useState<string | null>(null);
  const [center, setCenter] = useState({ lat: 6.9271, lng: 79.8612 });
  const [clock, setClock] = useState(() => Date.now());
  const [departAt, setDepartAt] = useState(() => Date.now());
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<"idle" | "locating" | "denied" | "unsupported">("idle");
  const [alerts, setAlerts] = useState<AlertView[]>([FALLBACK_ALERT]);
  const [overrides, setOverrides] = useState<OverrideView[]>([]);
  const [overrideError, setOverrideError] = useState(false);
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 4000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setDepartAt(Date.now() + offset * 60_000);
  }, [offset, fromKey, toKey]);

  useEffect(() => {
    let dead = false;
    listAlerts()
      .then((rows) => {
        if (!dead && rows.length) setAlerts(rows);
      })
      .catch(() => {
        if (!dead) setAlerts([FALLBACK_ALERT]);
      });
    listOverrides()
      .then((rows) => {
        if (!dead) setOverrides(rows);
      })
      .catch(() => {
        if (!dead) setOverrideError(true);
      });
    return () => {
      dead = true;
    };
  }, []);

  useEffect(() => {
    if (!focusStop) return;
    let dead = false;
    reportCount({ data: { stopId: focusStop } })
      .then((row) => {
        if (!dead) setReports(row.unverified);
      })
      .catch(() => {
        if (!dead) setReports(0);
      });
    return () => {
      dead = true;
    };
  }, [focusStop]);

  const inactive = overrides.filter((item) => !item.active).map((item) => item.routeId);
  const headwayByRoute = Object.fromEntries(
    overrides.flatMap((item) => (item.headwayMin ? [[item.routeId, item.headwayMin] as const] : [])),
  );
  const toPlace = toKey === "here" && loc
    ? { key: "here", name: HERE, lat: loc.lat, lng: loc.lng, kind: "stop" as const, stopId: undefined }
    : toKey
      ? resolvePlace(toKey)
      : null;
  const fromPlace =
    fromKey === "here" && loc
      ? { key: "here", name: HERE, lat: loc.lat, lng: loc.lng, kind: "stop" as const, stopId: undefined }
      : fromKey
        ? resolvePlace(fromKey)
        : null;

  const journeys = useMemo(() => {
    if (!toPlace || !fromPlace) return [];
    return planJourneys({
      origin: { lat: fromPlace.lat, lng: fromPlace.lng, stopId: fromPlace.stopId },
      destination: { lat: toPlace.lat, lng: toPlace.lng, stopId: toPlace.stopId },
      departAt,
      sort,
      inactiveRouteIds: inactive,
      headwayByRoute,
    });
  }, [toPlace, fromPlace, departAt, sort, inactive.join("|"), JSON.stringify(headwayByRoute)]);

  const selected = journeys.find((journey) => journey.id === selectedId) ?? journeys[0] ?? null;
  const results = query.trim() ? searchPlaces(query, 8) : [];
  const nearby = useMemo(
    () =>
      STOPS.map((stop) => ({ stop, distance: walkMeters(center, stop) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 6),
    [center],
  );

  function go(next: { to?: string; from?: string }) {
    void navigate({ to: "/", search: { to: next.to ?? toKey, from: next.from ?? fromKey } });
  }

  function choose(key: string) {
    remember(key);
    setQuery("");
    setFocusStop(null);
    if (!toKey || field === "to") {
      go({ to: key, from: fromKey });
      setField("from");
      return;
    }
    go({ to: toKey, from: key });
  }

  function locate() {
    if (!navigator.geolocation) {
      setLocStatus("unsupported");
      return;
    }
    setLocStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLoc({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocStatus("idle");
        setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
        if (toKey) go({ to: toKey, from: "here" });
      },
      () => setLocStatus("denied"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 20000 },
    );
  }

  async function buy(journey: Journey) {
    const rides = journey.legs.flatMap((leg) =>
      leg.kind === "ride" ? [{ routeId: leg.routeId, boardId: leg.board.id, alightId: leg.alight.id }] : [],
    );
    const first = rides[0];
    const last = rides[rides.length - 1];
    if (!first || !last) return;
    const board = stopById(first.boardId);
    const alight = stopById(last.alightId);
    if (!board || !alight) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await createTicket({
        data: {
          idempotencyKey: crypto.randomUUID(),
          summary: {
            board: board.name,
            alight: alight.name,
            transfers: journey.transfers,
            routes: rides.flatMap((ride) => {
              const route = routeById(ride.routeId);
              return route ? [{ id: route.id, code: route.code, mode: route.mode, name: route.name }] : [];
            }),
          },
          rides,
        },
      });
      if (!result.ok || !("ticket" in result)) {
        setNotice(t("error"));
        return;
      }
      void navigate({ to: "/tickets/$id", params: { id: result.ticket.id } });
    } catch {
      setNotice(t("error"));
    } finally {
      setBusy(false);
    }
  }

  async function share(journey: Journey) {
    if (!consent) {
      setNotice(t("consentRequired"));
      return;
    }
    setBusy(true);
    try {
      const result = await createShare({ data: { consent: true, journeyJson: JSON.stringify(journey) } });
      if (!result.ok) {
        setNotice(t("error"));
        return;
      }
      const url = `${window.location.origin}/share/${result.id}`;
      await navigator.clipboard.writeText(url);
      setNotice(t("shareReady"));
    } catch {
      setNotice(t("error"));
    } finally {
      setBusy(false);
    }
  }

  const lineColor = theme === "dark" ? "#f4f1ea" : "#1c1917";
  const lines = useMemo(() => {
    const base = routeLines()
      .filter((line) => !inactive.includes(line.routeId))
      .map((line) => ({ id: line.routeId, color: line.color, width: selected ? 2 : 4, coordinates: line.coordinates }));
    if (!selected) return base;
    const overlay = selected.legs.map((leg, index) =>
      leg.kind === "ride"
        ? { id: `ride-${index}`, color: lineColor, width: 6, coordinates: leg.geometry }
        : {
            id: `walk-${index}`,
            color: "#6f685e",
            width: 2,
            coordinates: [
              [leg.from.lng, leg.from.lat],
              [leg.to.lng, leg.to.lat],
            ] as [number, number][],
          },
    );
    return [...base, ...overlay];
  }, [inactive.join("|"), selected, lineColor]);

  const fit = selected
    ? selected.legs.flatMap((leg) =>
        leg.kind === "ride" ? leg.geometry : ([[leg.from.lng, leg.from.lat], [leg.to.lng, leg.to.lat]] as [number, number][]),
      )
    : null;

  const vehicles = sampleVehicles(clock, inactive, headwayByRoute).map((vehicle) => ({
    id: vehicle.id,
    lng: vehicle.lng,
    lat: vehicle.lat,
    title: n(vehicle.headsign),
    subtitle: `${vehicle.routeCode} · ${t("sampleMovement")}`,
    detail: `${t("nextStop")}: ${n(vehicle.nextStopName)} · ${vehicle.etaNextMin} ${t("min")}. ${t("notLive")}. ${t("delayUnknown")}`,
  }));

  const focus = focusStop ? stopById(focusStop) : null;
  const focusArrivals = focus ? arrivalsAt(focus.id, clock, inactive, headwayByRoute) : [];

  const panel = (
    <>
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
        <Link to="/" className="font-display text-2xl tracking-tight">
          Gaman
        </Link>
        <LanguageSwitch />
      </header>
      <div id="main" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
        <OfflineNote />
        {!bannerDismissed ? (
          <p className="rounded-xl border border-border bg-surface px-3 py-3 text-sm">
            {t("sampleBanner")}
            <button type="button" className="mt-2 block font-medium underline" onClick={dismissBanner}>
              {t("dismiss")}
            </button>
          </p>
        ) : null}
        {overrideError ? <p className="text-sm text-muted">{t("operatorUpdates")}</p> : null}
        <label className="grid gap-1 text-sm font-medium">
          {toKey ? (field === "from" ? t("origin") : t("destination")) : t("whereTo")}
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
          />
        </label>
        {query.trim() ? (
          <ul className="grid gap-1">
            {results.length === 0 ? <li className="text-sm text-muted">{t("noResults")}</li> : null}
            {results.map((place) => (
              <li key={place.key}>
                <button type="button" className="flex min-h-11 w-full items-center justify-between rounded-md px-2 text-left hover:bg-surface-2" onClick={() => choose(place.key)}>
                  <span>{n(place.name)}</span>
                  <span className="text-xs text-muted">{place.kind === "landmark" ? t("places") : place.key.includes("rail") ? t("train") : t("bus")}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {toPlace ? (
          <div className="grid gap-2 rounded-xl border border-border bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted">{t("destination")}</p>
                <p className="font-medium">{n(toPlace.name)}</p>
              </div>
              <button type="button" className="text-sm underline" onClick={() => { setField("to"); setQuery(""); }}>
                {t("change")}
              </button>
            </div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted">{t("origin")}</p>
                <p className="font-medium">{fromPlace ? n(fromPlace.name) : t("emptyOrigin")}</p>
              </div>
              <button type="button" className="text-sm underline" onClick={() => setField("from")}>
                {t("change")}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={locate} disabled={locStatus === "locating"}>
                {locStatus === "locating" ? t("locating") : t("useLocation")}
              </Button>
              {homeKey ? (
                <Button size="sm" variant="secondary" onClick={() => go({ from: homeKey })}>{t("home")}</Button>
              ) : null}
              {workKey ? (
                <Button size="sm" variant="secondary" onClick={() => go({ from: workKey })}>{t("work")}</Button>
              ) : null}
              {fromPlace && toPlace ? (
                <Button size="icon" variant="secondary" aria-label={t("swap")} onClick={() => go({ from: toPlace.key, to: fromPlace.key })}>
                  <ArrowLeftRight className="size-4" />
                </Button>
              ) : null}
            </div>
            {locStatus === "denied" ? <p className="text-sm text-muted">{t("locationDenied")}</p> : null}
            {locStatus === "unsupported" ? <p className="text-sm text-muted">{t("locationUnsupported")}</p> : null}
          </div>
        ) : null}

        {!toPlace && !query.trim() ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={locate}>{t("useLocation")}</Button>
            </div>
            {alerts.slice(0, 2).map((alert) => (
              <article key={alert.id} className="rounded-xl border border-border px-3 py-3">
                <p className="text-xs text-muted">{alert.id === "seed-demo-alert" ? t("noticeSeed") : t("noticeStaff")}</p>
                <h2 className="font-medium">{n(alert.title)}</h2>
                <p className="text-sm text-muted">{n(alert.body)}</p>
              </article>
            ))}
            {focus ? (
              <section className="grid gap-2">
                <button type="button" className="text-left text-sm underline" onClick={() => setFocusStop(null)}>{t("back")}</button>
                <h2 className="font-display text-xl">{n(focus.name)}</h2>
                <p className="text-sm text-muted">{t("accessNote")}</p>
                <p className="text-sm">{t("unverifiedReports")}: <span className="tabular-nums">{reports}</span></p>
                <h3 className="text-sm font-medium">{t("arrivals")}</h3>
                {focusArrivals.length === 0 ? <p className="text-sm text-muted">{t("noVehicle")}</p> : null}
                <ul className="grid gap-2">
                  {focusArrivals.slice(0, 4).map((arrival) => (
                    <li key={arrival.directionId} className="rounded-md border border-border px-3 py-2">
                      <p className="text-sm font-medium">{arrival.routeCode} · {n(arrival.headsign)}</p>
                      <p className="text-sm tabular-nums">{arrival.etaMin} {t("min")} · {formatClock(arrival.boardAt, lang)}</p>
                      <p className="text-xs text-muted">{t("sampleMovement")} · {t("notLive")} · {t("delayUnknown")}</p>
                      <p className="text-xs text-muted">{t("nextStops")}: {arrival.nextStops.map((name) => n(name)).join(", ") || "—"}</p>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => choose(`stop:${focus.id}`)}>{t("planFromHere")}</Button>
                  {user && focusArrivals[0] ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const routeId = focusArrivals[0]?.routeId;
                        if (!routeId) return;
                        void sendArrivalReport({ data: { stopId: focus.id, routeId } })
                          .then(() => setNotice(t("reportSent")))
                          .catch(() => setNotice(t("error")));
                      }}
                    >
                      {t("reportArrival")}
                    </Button>
                  ) : (
                    <p className="text-sm text-muted">{isPending ? t("loading") : t("reportNeedSignIn")}</p>
                  )}
                </div>
                <p className="text-xs text-muted">{t("arrivalNote")}</p>
              </section>
            ) : (
              <section className="grid gap-2">
                <h2 className="text-sm font-medium">{t("nearby")}</h2>
                <p className="text-sm text-muted">{loc ? t("useLocation") : t("aroundMap")}</p>
                <ul className="grid gap-1">
                  {nearby.map(({ stop, distance }) => (
                    <li key={stop.id}>
                      <button type="button" className="flex min-h-11 w-full items-center justify-between rounded-md px-2 text-left hover:bg-surface-2" onClick={() => setFocusStop(stop.id)}>
                        <span>{n(stop.name)}</span>
                        <span className="text-xs text-muted tabular-nums">{formatDistance(distance)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <h2 className="pt-2 text-sm font-medium">{t("reachBy")}</h2>
                <ul className="grid gap-2">
                  {LANDMARKS.slice(0, 3).map((landmark) => (
                    <li key={landmark.id}>
                      <button type="button" className="w-full rounded-xl border border-border px-3 py-3 text-left" onClick={() => choose(`landmark:${landmark.id}`)}>
                        <span className="font-medium">{n(landmark.name)}</span>
                        <span className="mt-1 block text-sm text-muted">{n(landmark.blurb)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : null}

        {toPlace && !fromPlace && !query.trim() ? <p className="text-sm text-muted">{t("setOrigin")}</p> : null}

        {fromPlace && toPlace ? (
          <section className="grid gap-3" aria-live="polite">
            <div className="flex gap-2 overflow-x-auto">
              {SORTS.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSort(mode)}
                  className={cn(
                    "h-10 shrink-0 rounded-full px-3 text-sm",
                    sort === mode ? "bg-primary text-primary-fg" : "border border-border bg-surface",
                  )}
                >
                  {t(mode === "fare" ? "lowestFare" : mode === "transfers" ? "fewestTransfers" : mode === "walk" ? "leastWalking" : "fastest")}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {[0, 30, 60].map((minutes) => (
                <button key={minutes} type="button" onClick={() => setOffset(minutes)} className={cn("h-10 rounded-md px-3 text-sm", offset === minutes ? "bg-primary text-primary-fg" : "border border-border")}>
                  {minutes === 0 ? t("leaveNow") : minutes === 30 ? t("in30") : t("in60")}
                </button>
              ))}
            </div>
            <h2 className="text-sm font-medium">{t("results")}</h2>
            {journeys.length === 0 ? (
              <p className="rounded-xl border border-border px-3 py-4 text-sm">
                {t("noJourneys")} {t("coverageNote")}
              </p>
            ) : null}
            {journeys.map((journey) => (
              <article key={journey.id} className={cn("grid gap-2 rounded-xl border p-3", selected?.id === journey.id ? "border-fg bg-surface" : "border-border")}>
                <button type="button" className="grid gap-1 text-left" onClick={() => setSelectedId(journey.id)}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-2xl tabular-nums">{Math.max(1, Math.round(journey.durationMin))} {t("min")}</span>
                    <span className="text-sm tabular-nums">{journey.fare.modelId === "no-fare" ? t("walk") : formatLkr(journey.fare.amountLkr, lang)}</span>
                  </div>
                  <p className="text-xs text-muted">
                    {journey.fare.modelId === "no-fare" ? t("walk") : `${t("fareSample")} · ${t("lowConfidence")} · ${t("perBoarding")}`}
                  </p>
                  <p className="text-sm">{formatClock(journey.departAt, lang)} – {formatClock(journey.arriveAt, lang)}</p>
                  <p className="text-sm text-muted">
                    {t("walk")} {formatDistance(journey.walkM)} · {journey.transfers} {t("transfers")}
                  </p>
                </button>
                <ol className="grid gap-2 text-sm">
                  {journey.legs.map((leg, index) =>
                    leg.kind === "walk" ? (
                      <li key={`${journey.id}-w-${index}`}>{t("walk")} · {Math.max(1, Math.round(leg.durationMin))} {t("min")}</li>
                    ) : (
                      <li key={`${journey.id}-r-${index}`} className="grid gap-0.5">
                        <span className="inline-flex items-center gap-2 font-medium">
                          {leg.mode === "rail" ? <TrainFront className="size-4" aria-hidden="true" /> : <Bus className="size-4" aria-hidden="true" />}
                          {leg.routeCode} · {n(leg.routeName)}
                        </span>
                        <span>{t("board")} {n(leg.board.name)} · {t("alight")} {n(leg.alight.name)}</span>
                        <span className="text-muted">{n(leg.headsign)} · {t("wait")} {Math.round(leg.waitMin)} {t("min")} · {t("notLive")}</span>
                        <span className="text-xs text-muted">{n(routeById(leg.routeId)?.disclaimer ?? { en: "", si: "", ta: "" })}</span>
                      </li>
                    ),
                  )}
                </ol>
                {alerts.filter((alert) => alert.severity === "disruption" && journey.legs.some((leg) => leg.kind === "ride" && leg.routeId === alert.routeId)).map((alert) => (
                  <p key={alert.id} className="text-sm text-warn">{n(alert.title)}</p>
                ))}
                <p className="text-xs text-muted">{t("reliability")}: {t("unknown")} · {t("freshness")}: {t("sampleDataset")}</p>
                <p className="text-xs text-muted">{t("geometryNote")}</p>
                <p className="text-xs text-muted">
                  {t("officialFares")}{" "}
                  <a className="underline" href="https://www.ntc.gov.lk/Bus_info/bus_fare.php" target="_blank" rel="noreferrer">NTC</a>
                  {" · "}
                  <a className="underline" href="https://www.sltb.lk/notice/busFees" target="_blank" rel="noreferrer">SLTB</a>
                </p>
                {selected?.id === journey.id ? (
                  <div className="grid gap-2">
                    <Button onClick={() => {
                      sessionStorage.setItem("gaman-ride", JSON.stringify(journey));
                      void navigate({ to: "/ride" });
                    }}>{t("startGuidance")}</Button>
                    <Button variant="secondary" onClick={() => {
                      const title = `${n(fromPlace.name)} – ${n(toPlace.name)}`;
                      saveLocalJourney({ id: crypto.randomUUID(), title, json: JSON.stringify(journey), savedAt: Date.now() });
                      setNotice(t("saved"));
                    }}>{t("saveJourney")}</Button>
                    {journey.legs.some((leg) => leg.kind === "ride") ? (
                      isPending ? <div className="h-11 rounded-md bg-surface-2" /> : user ? (
                        <Button variant="secondary" disabled={busy} onClick={() => void buy(journey)}>{busy ? t("working") : t("buyTicket")}</Button>
                      ) : (
                        <Link to="/login" className="inline-flex h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-medium">{t("signInToPay")}</Link>
                      )
                    ) : null}
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1 size-4" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                      <span>{t("shareConsent")}</span>
                    </label>
                    {user ? <Button variant="ghost" disabled={busy} onClick={() => void share(journey)}>{t("share")}</Button> : null}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setHome(toPlace.key); setNotice(t("homeSet")); }}>{t("home")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setWork(toPlace.key); setNotice(t("workSet")); }}>{t("work")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => { toggleFavorite(toPlace.key); setNotice(t("favoriteSet")); }}>{t("favorites")}</Button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        ) : null}

        {!toPlace && recentKeys.length > 0 && !query.trim() ? (
          <section>
            <h2 className="text-sm font-medium">{t("recent")}</h2>
            <ul>
              {recentKeys.map((key) => {
                const place = resolvePlace(key);
                if (!place) return null;
                return (
                  <li key={key}>
                    <button type="button" className="min-h-11 text-sm underline" onClick={() => choose(key)}>{n(place.name)}</button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
        {favoriteKeys.length > 0 && !query.trim() ? (
          <p className="text-sm text-muted">{t("favorites")}: {favoriteKeys.length}</p>
        ) : null}
        {notice ? <p role="status" className="text-sm">{notice}</p> : null}
      </div>
    </>
  );

  return (
    <MapShell
      panel={panel}
      lines={lines}
      stops={STOPS.map((stop) => ({
        id: stop.id,
        lng: stop.lng,
        lat: stop.lat,
        title: n(stop.name),
        subtitle: stop.kind === "rail" ? t("train") : t("bus"),
      }))}
      vehicles={vehicles}
      user={loc ? { lng: loc.lng, lat: loc.lat } : null}
      fitKey={selected?.id ?? null}
      fitCoordinates={fit}
      onSelectStop={(id) => {
        setFocusStop(id);
        if (!toKey) setQuery("");
      }}
      onMove={setCenter}
      onLocate={locate}
      locating={locStatus === "locating"}
    />
  );
}

function OfflineNote() {
  const { t } = useI18n();
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  if (online) return null;
  return (
    <p role="status" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
      <span className="font-medium">{t("offline")}. </span>
      {t("offlineBody")}
    </p>
  );
}
