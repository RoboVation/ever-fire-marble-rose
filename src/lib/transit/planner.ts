import { estimateFare, NO_FARE, sumFares, type FareEstimate } from "./fares.ts";
import { walkMeters } from "./geo.ts";
import { alongM, DIRECTIONS, routeById, stopById, STOPS } from "./network.ts";
import { nextBoard } from "./schedule.ts";
import type { Direction, Localized, Stop } from "./types.ts";

export type SortMode = "fastest" | "fare" | "transfers" | "walk";

export type PlanPoint = { lat: number; lng: number; stopId?: string };

type NamedPoint = { lat: number; lng: number; name?: Localized; stopId?: string };

export type WalkLeg = {
  kind: "walk";
  from: NamedPoint;
  to: NamedPoint;
  distanceM: number;
  durationMin: number;
  departAt: number;
  arriveAt: number;
  purpose: "access" | "transfer" | "egress";
};

export type RideLeg = {
  kind: "ride";
  mode: "bus" | "rail";
  routeId: string;
  routeCode: string;
  routeName: Localized;
  directionId: string;
  headsign: Localized;
  operator: Localized;
  board: Stop;
  alight: Stop;
  intermediate: Stop[];
  distanceM: number;
  waitMin: number;
  rideMin: number;
  departAt: number;
  arriveAt: number;
  fare: FareEstimate;
  geometry: [number, number][];
  dataSource: "sample";
  freshness: "sample-headway";
};

export type Leg = WalkLeg | RideLeg;

export type Journey = {
  id: string;
  signature: string;
  legs: Leg[];
  departAt: number;
  arriveAt: number;
  durationMin: number;
  walkM: number;
  transfers: number;
  fare: FareEstimate;
  reliability: "unknown";
  freshness: "sample-dataset";
};

export type PlanInput = {
  origin: PlanPoint;
  destination: PlanPoint;
  departAt: number;
  sort: SortMode;
  inactiveRouteIds?: string[];
  headwayByRoute?: Record<string, number>;
};

const MIN_CONNECTION_MS = 60_000;
const WALK_OMIT_M = 50;

function activeDirections(input: PlanInput): Direction[] {
  return DIRECTIONS.filter((direction) => !input.inactiveRouteIds?.includes(direction.routeId)).map(
    (direction) => {
      const headway = input.headwayByRoute?.[direction.routeId];
      if (headway == null || !Number.isFinite(headway)) return direction;
      return { ...direction, headwayMin: Math.min(120, Math.max(2, Math.round(headway))) };
    },
  );
}

function nearestStops(lat: number, lng: number, limit: number, maxM: number): Stop[] {
  return STOPS.map((stop) => ({ stop, distance: walkMeters({ lat, lng }, stop) }))
    .filter((item) => item.distance <= maxM)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((item) => item.stop);
}

function candidates(point: PlanPoint): Stop[] {
  if (point.stopId) {
    const preferred = stopById(point.stopId);
    if (!preferred) return nearestStops(point.lat, point.lng, 3, 1600);
    const near = nearestStops(preferred.lat, preferred.lng, 4, 800).filter(
      (stop) => stop.id !== preferred.id,
    );
    return [preferred, ...near].slice(0, 3);
  }
  return nearestStops(point.lat, point.lng, 3, 1600);
}

function named(stop: Stop): NamedPoint {
  return { lat: stop.lat, lng: stop.lng, name: stop.name, stopId: stop.id };
}

function makeWalk(
  from: NamedPoint,
  to: NamedPoint,
  readyAt: number,
  purpose: WalkLeg["purpose"],
): WalkLeg | null {
  const distanceM = walkMeters(from, to);
  if (distanceM < WALK_OMIT_M) return null;
  const durationMin = distanceM / 78;
  return {
    kind: "walk",
    from,
    to,
    distanceM,
    durationMin,
    departAt: readyAt,
    arriveAt: readyAt + durationMin * 60_000,
    purpose,
  };
}

function rideLeg(direction: Direction, board: Stop, alight: Stop, readyAt: number): RideLeg | null {
  const from = direction.stopIds.indexOf(board.id);
  const to = direction.stopIds.indexOf(alight.id);
  if (from < 0 || to <= from) return null;
  const boarded = nextBoard(direction, board.id, readyAt);
  const route = routeById(direction.routeId);
  if (!boarded || !route) return null;
  const distanceM = alongM(direction, from, to);
  const rideMin = (distanceM / (direction.speedKmh * 1000)) * 60;
  const departAt = boarded.boardAt;
  const geometry = direction.stopIds.slice(from, to + 1).flatMap((id) => {
    const stop = stopById(id);
    return stop ? [[stop.lng, stop.lat] as [number, number]] : [];
  });
  const intermediate = direction.stopIds.slice(from + 1, to).flatMap((id) => {
    const stop = stopById(id);
    return stop ? [stop] : [];
  });
  return {
    kind: "ride",
    mode: route.mode,
    routeId: route.id,
    routeCode: route.code,
    routeName: route.name,
    directionId: direction.id,
    headsign: direction.headsign,
    operator: route.operator,
    board,
    alight,
    intermediate,
    distanceM,
    waitMin: Math.max(0, (departAt - readyAt) / 60_000),
    rideMin,
    departAt,
    arriveAt: departAt + rideMin * 60_000,
    fare: estimateFare(distanceM / 1000, route.mode),
    geometry,
    dataSource: "sample",
    freshness: "sample-headway",
  };
}

function finalize(legs: Leg[], leaveAt: number): Journey | null {
  if (legs.length === 0) return null;
  const arriveAt = legs[legs.length - 1]?.arriveAt ?? leaveAt;
  const rides = legs.filter((leg): leg is RideLeg => leg.kind === "ride");
  const signature = legs
    .map((leg) =>
      leg.kind === "walk" ? `w:${leg.purpose}:${leg.to.stopId ?? ""}` : `r:${leg.routeId}:${leg.board.id}:${leg.alight.id}`,
    )
    .join(">");
  return {
    id: signature,
    signature,
    legs,
    departAt: leaveAt,
    arriveAt,
    durationMin: Math.max(0, (arriveAt - leaveAt) / 60_000),
    walkM: legs.reduce((sum, leg) => sum + (leg.kind === "walk" ? leg.distanceM : 0), 0),
    transfers: Math.max(0, rides.length - 1),
    fare: rides.length > 0 ? sumFares(rides.map((ride) => ride.fare)) : NO_FARE,
    reliability: "unknown",
    freshness: "sample-dataset",
  };
}

export function sortJourneys(list: Journey[], sort: SortMode): Journey[] {
  return [...list].sort((a, b) => {
    const primary =
      sort === "fare"
        ? a.fare.amountLkr - b.fare.amountLkr
        : sort === "transfers"
          ? a.transfers - b.transfers
          : sort === "walk"
            ? a.walkM - b.walkM
            : a.durationMin - b.durationMin;
    if (primary !== 0) return primary;
    if (a.durationMin !== b.durationMin) return a.durationMin - b.durationMin;
    return a.fare.amountLkr - b.fare.amountLkr;
  });
}

export function planJourneys(input: PlanInput): Journey[] {
  const directions = activeDirections(input);
  const boards = candidates(input.origin);
  const alights = candidates(input.destination);
  const found: Journey[] = [];
  const originPt: NamedPoint = { lat: input.origin.lat, lng: input.origin.lng };
  const destPt: NamedPoint = { lat: input.destination.lat, lng: input.destination.lng };

  const directWalk = makeWalk(originPt, destPt, input.departAt, "access");
  if (directWalk && directWalk.distanceM < 2200) {
    const journey = finalize([directWalk], input.departAt);
    if (journey) found.push(journey);
  }

  for (const board of boards) {
    for (const alight of alights) {
      if (board.id === alight.id) continue;
      const access = makeWalk(originPt, named(board), input.departAt, "access");
      const ready = access?.arriveAt ?? input.departAt;
      for (const direction of directions) {
        const ride = rideLeg(direction, board, alight, ready);
        if (!ride) continue;
        const egress = makeWalk(named(alight), destPt, ride.arriveAt, "egress");
        const legs: Leg[] = [];
        if (access) legs.push(access);
        legs.push(ride);
        if (egress) legs.push(egress);
        const journey = finalize(legs, input.departAt);
        if (journey && journey.durationMin <= 180) found.push(journey);
      }
    }
  }

  for (const board of boards) {
    for (const alight of alights) {
      const access = makeWalk(originPt, named(board), input.departAt, "access");
      const ready = access?.arriveAt ?? input.departAt;
      for (const first of directions) {
        const start = first.stopIds.indexOf(board.id);
        if (start < 0) continue;
        for (let index = start + 1; index < first.stopIds.length; index += 1) {
          const hub = stopById(first.stopIds[index] ?? "");
          if (!hub || hub.id === alight.id) continue;
          const ride1 = rideLeg(first, board, hub, ready);
          if (!ride1) continue;
          const hubs = [hub, ...nearestStops(hub.lat, hub.lng, 3, 450).filter((stop) => stop.id !== hub.id)];
          for (const transferStop of hubs) {
            if (transferStop.id === alight.id) continue;
            const transferWalk =
              transferStop.id === hub.id
                ? null
                : makeWalk(named(hub), named(transferStop), ride1.arriveAt, "transfer");
            const ready2 = (transferWalk?.arriveAt ?? ride1.arriveAt) + MIN_CONNECTION_MS;
            for (const second of directions) {
              if (second.routeId === first.routeId) continue;
              const ride2 = rideLeg(second, transferStop, alight, ready2);
              if (!ride2) continue;
              const egress = makeWalk(named(alight), destPt, ride2.arriveAt, "egress");
              const legs: Leg[] = [];
              if (access) legs.push(access);
              legs.push(ride1);
              if (transferWalk) legs.push(transferWalk);
              legs.push(ride2);
              if (egress) legs.push(egress);
              const journey = finalize(legs, input.departAt);
              if (journey && journey.durationMin <= 180) found.push(journey);
            }
          }
        }
      }
    }
  }

  const best = new Map<string, Journey>();
  for (const journey of found) {
    const previous = best.get(journey.signature);
    if (!previous || journey.arriveAt < previous.arriveAt) best.set(journey.signature, journey);
  }
  const deduped = [...best.values()];
  const picked = new Map<string, Journey>();
  const take = (sorted: Journey[], count: number) => {
    let kept = 0;
    for (const journey of sorted) {
      if (picked.has(journey.signature)) continue;
      picked.set(journey.signature, journey);
      kept += 1;
      if (kept >= count) break;
    }
  };
  take(sortJourneys(deduped, "fastest"), 4);
  take(sortJourneys(deduped, "fare"), 3);
  take(sortJourneys(deduped, "transfers"), 3);
  take(sortJourneys(deduped, "walk"), 2);
  return sortJourneys([...picked.values()], input.sort).slice(0, 5);
}
