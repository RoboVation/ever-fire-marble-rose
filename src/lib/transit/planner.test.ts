import assert from "node:assert/strict";
import test from "node:test";
import { estimateFare } from "./fares.ts";
import { DIRECTIONS, ROUTES, STOPS, stopById } from "./network.ts";
import { planJourneys } from "./planner.ts";
import { priceRide } from "./price.ts";

const morning = Date.parse("2026-07-06T08:30:00+05:30");
const late = Date.parse("2026-07-06T23:50:00+05:30");

function place(id: string) {
  const stop = stopById(id);
  assert.ok(stop, id);
  return { lat: stop.lat, lng: stop.lng, stopId: stop.id };
}

test("sample graph only references known stops and routes", () => {
  const stopIds = new Set(STOPS.map((stop) => stop.id));
  const directionIds = new Set(DIRECTIONS.map((direction) => direction.id));
  for (const direction of DIRECTIONS) {
    assert.ok(stopIds.has(direction.stopIds[0] ?? ""));
    for (const id of direction.stopIds) assert.ok(stopIds.has(id), id);
    assert.ok(direction.stopIds.length >= 2);
  }
  for (const route of ROUTES) {
    for (const id of route.directionIds) assert.ok(directionIds.has(id), id);
  }
});

test("Pettah to Panadura offers the Galle Road sample and a low-confidence fare", () => {
  const journeys = planJourneys({
    origin: place("pettah"),
    destination: place("panadura"),
    departAt: morning,
    sort: "fastest",
  });
  assert.ok(journeys.length > 0);
  assert.ok(
    journeys.some((journey) =>
      journey.legs.some((leg) => leg.kind === "ride" && leg.routeId === "sample-galle"),
    ),
  );
  const routeIds = new Set(ROUTES.map((route) => route.id));
  for (const journey of journeys) {
    assert.equal(journey.freshness, "sample-dataset");
    assert.equal(journey.reliability, "unknown");
    for (const leg of journey.legs) {
      if (leg.kind !== "ride") continue;
      assert.ok(routeIds.has(leg.routeId));
      assert.equal(leg.dataSource, "sample");
      assert.equal(leg.fare.confidence, "low");
      assert.ok(leg.departAt >= morning - 1000);
      const priced = priceRide(leg.routeId, leg.board.id, leg.alight.id);
      assert.equal(priced?.amountLkr, leg.fare.amountLkr);
    }
  }
});

test("Kaduwela to Mount Lavinia requires a transfer on the sample network", () => {
  const journeys = planJourneys({
    origin: place("kaduwela"),
    destination: place("mount-lavinia"),
    departAt: morning,
    sort: "transfers",
  });
  const rides = journeys.filter((journey) => journey.legs.some((leg) => leg.kind === "ride"));
  assert.ok(rides.length > 0);
  assert.ok(rides.every((journey) => journey.transfers >= 1));
});

test("fare sort is non-decreasing and distance model grows", () => {
  const journeys = planJourneys({
    origin: place("fort"),
    destination: place("nugegoda"),
    departAt: morning,
    sort: "fare",
  });
  for (let i = 1; i < journeys.length; i += 1) {
    assert.ok((journeys[i]?.fare.amountLkr ?? 0) >= (journeys[i - 1]?.fare.amountLkr ?? 0));
  }
  assert.ok(estimateFare(10, "bus").amountLkr > estimateFare(1, "bus").amountLkr);
  assert.equal(estimateFare(3, "bus").confidence, "low");
});

test("after the last sample departure there is no ride", () => {
  const journeys = planJourneys({
    origin: place("pettah"),
    destination: place("panadura"),
    departAt: late,
    sort: "fastest",
  });
  assert.ok(journeys.every((journey) => journey.legs.every((leg) => leg.kind !== "ride")));
});

test("an inactive corridor is not offered", () => {
  const journeys = planJourneys({
    origin: place("pettah"),
    destination: place("panadura"),
    departAt: morning,
    sort: "fastest",
    inactiveRouteIds: ["sample-galle"],
  });
  assert.ok(
    journeys.every((journey) =>
      journey.legs.every((leg) => leg.kind !== "ride" || leg.routeId !== "sample-galle"),
    ),
  );
});
