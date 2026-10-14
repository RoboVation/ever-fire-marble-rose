import { estimateFare, type FareEstimate } from "./fares.ts";
import { alongM, DIRECTIONS, routeById } from "./network.ts";

/** Server and client must price a boarding the same way. Headway does not affect fare. */
export function priceRide(routeId: string, boardId: string, alightId: string): FareEstimate | null {
  const route = routeById(routeId);
  if (!route) return null;
  const direction = DIRECTIONS.find((item) => {
    if (item.routeId !== routeId) return false;
    const from = item.stopIds.indexOf(boardId);
    const to = item.stopIds.indexOf(alightId);
    return from >= 0 && to > from;
  });
  if (!direction) return null;
  const from = direction.stopIds.indexOf(boardId);
  const to = direction.stopIds.indexOf(alightId);
  return estimateFare(alongM(direction, from, to) / 1000, route.mode);
}
