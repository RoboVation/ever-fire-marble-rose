import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmSandbox,
  failSandbox,
  redeemTicket,
  refundTicket,
  validateTicket,
  type TicketRecord,
} from "./ticket-machine.ts";

function pending(): TicketRecord {
  return {
    id: "t1",
    status: "pending_payment",
    amountLkr: 80,
    idempotencyKey: "key-1",
    paidAt: null,
    redeemedAt: null,
    refundedAt: null,
    provider: "sandbox",
    providerRef: null,
  };
}

test("sandbox confirm is idempotent and a QR is invalid until paid", () => {
  const created = pending();
  assert.equal(validateTicket(created).valid, false);
  assert.equal(validateTicket(created).reason, "unpaid");
  const wrong = confirmSandbox(created, "other", "2026-07-06T08:00:00.000Z");
  assert.equal(wrong.outcome, "rejected");
  assert.equal(wrong.ticket.status, "pending_payment");
  const paid = confirmSandbox(created, "key-1", "2026-07-06T08:00:00.000Z");
  assert.equal(paid.outcome, "paid");
  assert.equal(paid.ticket.status, "paid");
  assert.equal(validateTicket(paid.ticket).valid, true);
  const replay = confirmSandbox(paid.ticket, "key-1", "2026-07-06T09:00:00.000Z");
  assert.equal(replay.outcome, "replay");
  assert.equal(replay.ticket.paidAt, paid.ticket.paidAt);
});

test("unpaid tickets cannot be redeemed or refunded, and redemption is once", () => {
  const created = pending();
  assert.equal(redeemTicket(created, "2026-07-06T08:00:00.000Z").outcome, "rejected");
  assert.equal(refundTicket(created, "2026-07-06T08:00:00.000Z").outcome, "rejected");
  const paid = confirmSandbox(created, "key-1", "2026-07-06T08:00:00.000Z").ticket;
  const boarded = redeemTicket(paid, "2026-07-06T08:10:00.000Z");
  assert.equal(boarded.outcome, "redeemed");
  assert.equal(validateTicket(boarded.ticket).reason, "already_redeemed");
  assert.equal(redeemTicket(boarded.ticket, "2026-07-06T08:11:00.000Z").outcome, "already_redeemed");
  assert.equal(refundTicket(boarded.ticket, "2026-07-06T08:12:00.000Z").outcome, "rejected");
});

test("failed payment stays invalid and refund is only from paid", () => {
  const failed = failSandbox(pending());
  assert.equal(failed.outcome, "failed");
  assert.equal(validateTicket(failed.ticket).valid, false);
  assert.equal(confirmSandbox(failed.ticket, "key-1", "2026-07-06T08:00:00.000Z").outcome, "rejected");
  const paid = confirmSandbox(pending(), "key-1", "2026-07-06T08:00:00.000Z").ticket;
  const refunded = refundTicket(paid, "2026-07-06T08:20:00.000Z");
  assert.equal(refunded.outcome, "refunded");
  assert.equal(validateTicket(refunded.ticket).reason, "refunded");
  assert.equal(refundTicket(refunded.ticket, "2026-07-06T08:21:00.000Z").outcome, "replay");
});
