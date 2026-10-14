export type Localized = { en: string; si: string; ta: string };

export type Lang = "en" | "si" | "ta";

export type Stop = {
  id: string;
  name: Localized;
  lat: number;
  lng: number;
  kind: "bus" | "rail";
  /** Surveyed step-free access is not available for this sample set. */
  accessibility: "unverified";
};

export type Direction = {
  id: string;
  routeId: string;
  headsign: Localized;
  stopIds: string[];
  /** Sample average speed. Not a measured running time. */
  speedKmh: number;
  headwayMin: number;
  /** Minutes from midnight, Asia/Colombo. Last terminal departure, inclusive. */
  firstMin: number;
  lastMin: number;
  color: string;
};

export type TransitRoute = {
  id: string;
  code: string;
  name: Localized;
  mode: "bus" | "rail";
  operator: Localized;
  disclaimer: Localized;
  directionIds: string[];
};

export type Landmark = {
  id: string;
  name: Localized;
  blurb: Localized;
  lat: number;
  lng: number;
  nearestStopId: string;
};

export type PlaceRef = {
  key: string;
  name: Localized;
  lat: number;
  lng: number;
  stopId?: string;
  kind: "stop" | "landmark";
};
