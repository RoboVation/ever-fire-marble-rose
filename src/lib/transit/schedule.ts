import { colomboDayStart } from "./geo.ts";
import { alongM } from "./network.ts";
import type { Direction } from "./types.ts";

export function nextBoard(
  direction: Direction,
  stopId: string,
  readyAt: number,
): { boardAt: number; terminalDepart: number } | null {
  const index = direction.stopIds.indexOf(stopId);
  if (index < 0) return null;
  const speed = (direction.speedKmh * 1000) / 3600;
  const offsetMs = speed <= 0 ? 0 : (alongM(direction, 0, index) / speed) * 1000;
  const dayStart = colomboDayStart(readyAt);
  for (let minute = direction.firstMin; minute <= direction.lastMin; minute += direction.headwayMin) {
    const terminalDepart = dayStart + minute * 60_000;
    const boardAt = terminalDepart + offsetMs;
    if (boardAt + 500 >= readyAt) return { boardAt, terminalDepart };
  }
  return null;
}

export function activeTrips(
  direction: Direction,
  now: number,
): { terminalDepart: number; progressM: number }[] {
  const last = direction.stopIds.length - 1;
  const total = alongM(direction, 0, last);
  const speed = (direction.speedKmh * 1000) / 3600;
  if (speed <= 0 || total <= 0) return [];
  const runtimeMs = (total / speed) * 1000;
  const dayStart = colomboDayStart(now);
  const trips: { terminalDepart: number; progressM: number }[] = [];
  for (let minute = direction.firstMin; minute <= direction.lastMin; minute += direction.headwayMin) {
    const terminalDepart = dayStart + minute * 60_000;
    const elapsed = now - terminalDepart;
    if (elapsed < 0 || elapsed > runtimeMs) continue;
    trips.push({ terminalDepart, progressM: (elapsed / 1000) * speed });
  }
  return trips;
}
