/**
 * Transport feeds plug in behind this interface.
 * Do not point an adapter at a private or undocumented endpoint.
 * A real integration needs a written operator agreement and a documented feed,
 * usually GTFS static plus GTFS-Realtime vehicle positions and trip updates.
 *
 * Suggested server-only environment variables, injected at deploy, never VITE_:
 *   OPERATOR_GTFS_URL
 *   OPERATOR_GTFS_RT_URL
 *   OPERATOR_GTFS_RT_KEY
 */
export type VehicleObservation = {
  id: string;
  routeId: string;
  lat: number;
  lng: number;
  headsign: string;
  observedAt: string;
  source: "gtfs-realtime" | "demonstration";
};

export type FeedAlert = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "disruption";
};

export interface TransitFeedAdapter {
  id: string;
  label: string;
  configured: boolean;
  fetchVehicles?: () => Promise<VehicleObservation[]>;
  fetchAlerts?: () => Promise<FeedAlert[]>;
}

export const sampleFeedAdapter: TransitFeedAdapter = {
  id: "sample-western-province",
  label: "Bundled Western Province sample corridors",
  configured: true,
};

export const operatorFeedAdapter: TransitFeedAdapter = {
  id: "operator-gtfs",
  label: "Authorized operator GTFS / GTFS-Realtime",
  configured: false,
};
