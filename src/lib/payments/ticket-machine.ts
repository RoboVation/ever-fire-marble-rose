export type TicketStatus = "pending_payment" | "paid" | "failed" | "refunded" | "redeemed";

export type TicketRecord = {
  id: string;
  status: TicketStatus;
  amountLkr: number;
  idempotencyKey: string;
  paidAt: string | null;
  redeemedAt: string | null;
  refundedAt: string | null;
  provider: "sandbox";
  providerRef: string | null;
};

export type TicketOutcome =
  | "paid"
  | "replay"
  | "failed"
  | "refunded"
  | "redeemed"
  | "rejected"
  | "already_redeemed";

export function confirmSandbox(
  ticket: TicketRecord,
  key: string,
  nowIso: string,
): { ticket: TicketRecord; outcome: TicketOutcome } {
  if (key !== ticket.idempotencyKey) return { ticket, outcome: "rejected" };
  if (ticket.status === "paid" || ticket.status === "redeemed") {
    return { ticket, outcome: "replay" };
  }
  if (ticket.status !== "pending_payment") return { ticket, outcome: "rejected" };
  return {
    outcome: "paid",
    ticket: {
      ...ticket,
      status: "paid",
      paidAt: nowIso,
      providerRef: `sandbox:${ticket.id}`,
    },
  };
}

export function failSandbox(ticket: TicketRecord): { ticket: TicketRecord; outcome: TicketOutcome } {
  if (ticket.status === "failed") return { ticket, outcome: "replay" };
  if (ticket.status !== "pending_payment") return { ticket, outcome: "rejected" };
  return { outcome: "failed", ticket: { ...ticket, status: "failed" } };
}

export function refundTicket(
  ticket: TicketRecord,
  nowIso: string,
): { ticket: TicketRecord; outcome: TicketOutcome } {
  if (ticket.status === "refunded") return { ticket, outcome: "replay" };
  if (ticket.status !== "paid") return { ticket, outcome: "rejected" };
  return {
    outcome: "refunded",
    ticket: { ...ticket, status: "refunded", refundedAt: nowIso },
  };
}

export function redeemTicket(
  ticket: TicketRecord,
  nowIso: string,
): { ticket: TicketRecord; outcome: TicketOutcome } {
  if (ticket.status === "redeemed") return { ticket, outcome: "already_redeemed" };
  if (ticket.status !== "paid") return { ticket, outcome: "rejected" };
  return {
    outcome: "redeemed",
    ticket: { ...ticket, status: "redeemed", redeemedAt: nowIso },
  };
}

export function validateTicket(ticket: TicketRecord | null): { valid: boolean; reason: string } {
  if (!ticket) return { valid: false, reason: "missing" };
  if (ticket.status === "paid") return { valid: true, reason: "paid" };
  if (ticket.status === "redeemed") return { valid: false, reason: "already_redeemed" };
  if (ticket.status === "pending_payment") return { valid: false, reason: "unpaid" };
  if (ticket.status === "refunded") return { valid: false, reason: "refunded" };
  return { valid: false, reason: "failed" };
}
