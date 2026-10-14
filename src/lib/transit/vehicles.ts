import type { Localized } from "./types.ts";
import { DIRECTIONS, pointAlong, routeById, stopById, alongM } from "./network.ts";
import { activeTrips, nextBoard } from "./schedule.ts";

export type VehicleSample = {
  id: string;
  routeId: string;
  directionId: string;
  routeCode: string;
  headsign: Localized;
  lat: number;
  lng: number;
  bearing: number;
  nextStopName: Localized;
  following: Localized[];
  etaNextMin: number;
  dataSource: "demonstration";
  status: "sample-moving";
};

export type ArrivalSample = {
  directionId: string;
  routeId: string;
  routeCode: string;
  mode: "bus" | "rail";
  headsign: Localized;
  etaMin: number;
  boardAt: number;
  nextStops: Localized[];
  dataSource: "demonstration";
  status: "sample";
};

function withHeadway(
  headwayByRoute: Record<string, number>,
): typeof DIRECTIONS {
  return DIRECTIONS.map((direction) => {
    const headway = headwayByRoute[direction.routeId];
    if (headway == null || !Number.isFinite(headway)) return direction;
    return { ...direction, headwayMin: Math.min(120, Math.max(2, Math.round(headway))) };
  });
}

export function sampleVehicles(
  now: number,
  inactive: string[] = [],
  headwayByRoute: Record<string, number> = {},
): VehicleSample[] {
  const vehicles: VehicleSample[] = [];
  for (const direction of withHeadway(headwayByRoute)) {
    if (inactive.includes(direction.routeId)) continue;
    const route = routeById(direction.routeId);
    if (!route) continue;
    const speed = (direction.speedKmh * 1000) / 3600;
    for (const trip of activeTrips(direction, now)) {
      const position = pointAlong(direction, trip.progressM);
      const next = stopById(position.nextStopId);
      if (!next) continue;
      const index = direction.stopIds.indexOf(next.id);
      const following = direction.stopIds.slice(index, index + 3).flatMap((id) => {
        const stop = stopById(id);
        return stop ? [stop.name] : [];
      });
      const nextOffset = alongM(direction, 0, Math.max(0, index));
      const remainM = Math.max(0, nextOffset - trip.progressM);
      vehicles.push({
        id: `${direction.id}:${trip.terminalDepart}`,
        routeId: direction.routeId,
        directionId: direction.id,
        routeCode: route.code,
        headsign: direction.headsign,
        lat: position.lat,
        lng: position.lng,
        bearing: position.bearing,
        nextStopName: next.name,
        following,
        etaNextMin: speed > 0 ? Math.max(0, Math.round(remainM / speed / 60)) : 0,
        dataSource: "demonstration",
        status: "sample-moving",
      });
    }
  }
  return vehicles;
}

export function arrivalsAt(
  stopId: string,
  now: number,
  inactive: string[] = [],
  headwayByRoute: Record<string, number> = {},
): ArrivalSample[] {
  const arrivals: ArrivalSample[] = [];
  for (const direction of withHeadway(headwayByRoute)) {
    if (inactive.includes(direction.routeId)) continue;
    if (!direction.stopIds.includes(stopId)) continue;
    const route = routeById(direction.routeId);
    const boarded = nextBoard(direction, stopId, now);
    if (!route || !boarded) continue;
    const index = direction.stopIds.indexOf(stopId);
    const nextStops = direction.stopIds.slice(index + 1, index + 4).flatMap((id) => {
      const stop = stopById(id);
      return stop ? [stop.name] : [];
    });
    arrivals.push({
      directionId: direction.id,
      routeId: direction.routeId,
      routeCode: route.code,
      mode: route.mode,
      headsign: direction.headsign,
      etaMin: Math.max(0, Math.round((boarded.boardAt - now) / 60_000)),
      boardAt: boarded.boardAt,
      nextStops,
      dataSource: "demonstration",
      status: "sample",
    });
  }
  arrivals.sort((a, b) => a.etaMin - b.etaMin);
  return arrivals;
}
