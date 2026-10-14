export type LocalText = { en: string; si: string; ta: string };

export type TicketSummary = {
  board: LocalText;
  alight: LocalText;
  routes: { id: string; code: string; mode: "bus" | "rail"; name: LocalText }[];
  transfers: number;
};

export type TicketStatus = "pending_payment" | "paid" | "failed" | "refunded" | "redeemed";

export type TicketView = {
  id: string;
  status: TicketStatus;
  amountLkr: number;
  fareModel: string;
  provider: string;
  summary: TicketSummary;
  createdAt: string;
  paidAt: string | null;
  redeemedAt: string | null;
  refundedAt: string | null;
};

export type AlertView = {
  id: string;
  severity: "info" | "disruption";
  routeId: string | null;
  title: LocalText;
  body: LocalText;
};

export type OverrideView = {
  routeId: string;
  headwayMin: number | null;
  active: boolean;
  note: string | null;
};
