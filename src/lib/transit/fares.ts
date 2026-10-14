/**
 * Illustrative fare model for comparing sample journeys.
 * This is NOT a National Transport Commission gazette fare, an SLTB table,
 * or a Sri Lanka Railways tariff. Confidence is always low.
 *
 * Bus: LKR 40 for the first 2 km, then LKR 5 per additional started kilometre.
 * Rail: LKR 50 for the first 5 km, then LKR 8 per additional started kilometre.
 * Both round up to the next LKR 5. Each boarding is priced separately.
 */
export const FARE_MODEL_ID = "sample-distance-model-v1";

export const FARE_SOURCE =
  "Demonstration distance model, not an NTC, SLTB, or railway tariff";

export type FareEstimate = {
  amountLkr: number;
  currency: "LKR";
  confidence: "low" | "high";
  modelId: string;
  sourceLabel: string;
};

export const NO_FARE: FareEstimate = {
  amountLkr: 0,
  currency: "LKR",
  confidence: "high",
  modelId: "no-fare",
  sourceLabel: "No paid segment",
};

function round5(n: number): number {
  return Math.ceil(n / 5) * 5;
}

export function estimateFare(distanceKm: number, mode: "bus" | "rail"): FareEstimate {
  const km = Math.max(0, distanceKm);
  const raw =
    mode === "bus"
      ? 40 + Math.max(0, Math.ceil(km - 2)) * 5
      : 50 + Math.max(0, Math.ceil(km - 5)) * 8;
  return {
    amountLkr: round5(raw),
    currency: "LKR",
    confidence: "low",
    modelId: FARE_MODEL_ID,
    sourceLabel: FARE_SOURCE,
  };
}

export function sumFares(fares: FareEstimate[]): FareEstimate {
  if (fares.length === 0) return NO_FARE;
  return {
    amountLkr: fares.reduce((sum, fare) => sum + fare.amountLkr, 0),
    currency: "LKR",
    confidence: fares.some((fare) => fare.confidence === "low") ? "low" : "high",
    modelId: fares.every((fare) => fare.modelId === fares[0]?.modelId)
      ? (fares[0]?.modelId ?? FARE_MODEL_ID)
      : "mixed",
    sourceLabel: fares[0]?.sourceLabel ?? FARE_SOURCE,
  };
}
