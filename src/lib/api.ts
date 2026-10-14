import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  confirmSandbox,
  failSandbox,
  redeemTicket,
  refundTicket,
  validateTicket,
  type TicketRecord,
} from "@/lib/payments/ticket-machine";
import { priceRide } from "@/lib/transit/price";
import { routeById, stopById } from "@/lib/transit/network";
import type { AlertView, OverrideView, TicketSummary, TicketView } from "@/lib/ticket-types";

type Sql = {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
};

const hits = new Map<string, number[]>();

function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

async function sqlClient(): Promise<Sql> {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") throw new Error("Invalid text");
  const text = value.replace(/[\u0000-\u001F]/g, "").trim();
  if (!text || text.length > max) throw new Error("Invalid text");
  return text;
}

function optionalClean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F]/g, "").trim().slice(0, max);
}

function localText(value: unknown): { en: string; si: string; ta: string } {
  if (!value || typeof value !== "object") throw new Error("Invalid name");
  const record = value as Record<string, unknown>;
  const en = clean(record.en, 80);
  const si = optionalClean(record.si, 80) || en;
  const ta = optionalClean(record.ta, 80) || en;
  return { en, si, ta };
}

function stamp(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return text === "null" ? null : text;
}

type TicketRow = {
  id: string;
  status: TicketRecord["status"];
  amount_lkr: number;
  fare_model: string;
  summary_json: string;
  idempotency_key: string;
  provider: string;
  provider_ref: string | null;
  paid_at: unknown;
  redeemed_at: unknown;
  refunded_at: unknown;
  created_at: unknown;
};

function viewTicket(row: TicketRow): TicketView {
  let summary: TicketSummary = {
    board: { en: "", si: "", ta: "" },
    alight: { en: "", si: "", ta: "" },
    routes: [],
    transfers: 0,
  };
  try {
    summary = JSON.parse(row.summary_json) as TicketSummary;
  } catch {
    summary = summary;
  }
  return {
    id: row.id,
    status: row.status,
    amountLkr: Number(row.amount_lkr),
    fareModel: row.fare_model,
    provider: row.provider,
    summary,
    createdAt: stamp(row.created_at) ?? "",
    paidAt: stamp(row.paid_at),
    redeemedAt: stamp(row.redeemed_at),
    refundedAt: stamp(row.refunded_at),
  };
}

function recordOf(row: TicketRow): TicketRecord {
  return {
    id: row.id,
    status: row.status,
    amountLkr: Number(row.amount_lkr),
    idempotencyKey: row.idempotency_key,
    paidAt: stamp(row.paid_at),
    redeemedAt: stamp(row.redeemed_at),
    refundedAt: stamp(row.refunded_at),
    provider: "sandbox",
    providerRef: row.provider_ref,
  };
}

async function audit(sql: Sql, actorId: string, action: string, detail: string) {
  await sql`insert into audit_log (id, actor_id, action, detail) values (${crypto.randomUUID()}, ${actorId}, ${action}, ${detail})`;
}

async function requireStaff(sql: Sql, userId: string): Promise<boolean> {
  const rows = await sql<{ role: string }>`select role from staff_roles where user_id = ${userId} limit 1`;
  return rows[0]?.role === "operator";
}

export const listAlerts = createServerFn({ method: "GET" }).handler(async (): Promise<AlertView[]> => {
  const sql = await sqlClient();
  const rows = await sql<{
    id: string;
    severity: "info" | "disruption";
    route_id: string | null;
    title_en: string;
    title_si: string;
    title_ta: string;
    body_en: string;
    body_si: string;
    body_ta: string;
  }>`select id, severity, route_id, title_en, title_si, title_ta, body_en, body_si, body_ta
     from service_alerts where active = true order by created_at desc limit 20`;
  return rows.map((row) => ({
    id: row.id,
    severity: row.severity,
    routeId: row.route_id,
    title: { en: row.title_en, si: row.title_si, ta: row.title_ta },
    body: { en: row.body_en, si: row.body_si, ta: row.body_ta },
  }));
});

export const listOverrides = createServerFn({ method: "GET" }).handler(async (): Promise<OverrideView[]> => {
  const sql = await sqlClient();
  const rows = await sql<{
    route_id: string;
    headway_min: number | null;
    active: boolean;
    note: string | null;
  }>`select route_id, headway_min, active, note from route_overrides`;
  return rows.map((row) => ({
    routeId: row.route_id,
    headwayMin: row.headway_min == null ? null : Number(row.headway_min),
    active: Boolean(row.active),
    note: row.note,
  }));
});

export const reportCount = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const stopId = clean((input as { stopId?: unknown })?.stopId, 40);
    if (!stopById(stopId)) throw new Error("Invalid stop");
    return { stopId };
  })
  .handler(async ({ data }) => {
    const sql = await sqlClient();
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const rows = await sql<{ n: number }>`select count(*)::int as n from arrival_reports
      where stop_id = ${data.stopId} and status = 'unverified' and created_at > ${cutoff}`;
    return { unverified: Number(rows[0]?.n ?? 0) };
  });

export const getShare = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({ id: clean((input as { id?: unknown })?.id, 80) }))
  .handler(async ({ data }) => {
    const sql = await sqlClient();
    const rows = await sql<{ journey_json: string; expires_at: unknown }>`
      select journey_json, expires_at from trip_shares where id = ${data.id} limit 1`;
    const row = rows[0];
    if (!row) return { ok: false as const, error: "missing" };
    const expires = stamp(row.expires_at);
    if (!expires || new Date(expires).getTime() < Date.now()) return { ok: false as const, error: "expired" };
    return { ok: true as const, journeyJson: row.journey_json, expiresAt: expires };
  });

export const myAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await sqlClient();
    const role = await sql<{ role: string }>`select role from staff_roles where user_id = ${context.userId} limit 1`;
    const count = await sql<{ n: number }>`select count(*)::int as n from staff_roles`;
    return { role: role[0]?.role === "operator" ? "operator" : "passenger", operatorCount: Number(count[0]?.n ?? 0) };
  });

export const listTickets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await sqlClient();
    const rows = await sql<TicketRow>`select id, status, amount_lkr, fare_model, summary_json, idempotency_key, provider, provider_ref, paid_at, redeemed_at, refunded_at, created_at
      from tickets where user_id = ${context.userId} order by created_at desc limit 30`;
    return rows.map(viewTicket);
  });

export const getTicket = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: clean((input as { id?: unknown })?.id, 80) }))
  .handler(async ({ context, data }) => {
    const sql = await sqlClient();
    const rows = await sql<TicketRow>`select id, status, amount_lkr, fare_model, summary_json, idempotency_key, provider, provider_ref, paid_at, redeemed_at, refunded_at, created_at
      from tickets where id = ${data.id} and user_id = ${context.userId} limit 1`;
    const row = rows[0];
    if (!row) return { ok: false as const, error: "missing" };
    return { ok: true as const, ticket: viewTicket(row), validation: validateTicket(recordOf(row)) };
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = input as { idempotencyKey?: unknown; summary?: unknown; rides?: unknown };
    const idempotencyKey = clean(body.idempotencyKey, 80);
    if (!/^[A-Za-z0-9-]{8,80}$/.test(idempotencyKey)) throw new Error("Invalid key");
    const summaryRaw = body.summary as { board?: unknown; alight?: unknown; routes?: unknown; transfers?: unknown };
    const summary: TicketSummary = {
      board: localText(summaryRaw?.board),
      alight: localText(summaryRaw?.alight),
      routes: Array.isArray(summaryRaw?.routes)
        ? summaryRaw.routes.slice(0, 4).map((item) => {
            const route = item as { id?: unknown; code?: unknown; mode?: unknown; name?: unknown };
            const mode = route.mode === "rail" ? "rail" : "bus";
            return { id: clean(route.id, 40), code: clean(route.code, 20), mode, name: localText(route.name) };
          })
        : [],
      transfers: Number.isFinite(Number(summaryRaw?.transfers)) ? Math.max(0, Math.min(3, Number(summaryRaw.transfers))) : 0,
    };
    if (!Array.isArray(body.rides) || body.rides.length < 1 || body.rides.length > 4) throw new Error("Invalid rides");
    const rides = body.rides.map((item) => {
      const ride = item as { routeId?: unknown; boardId?: unknown; alightId?: unknown };
      return { routeId: clean(ride.routeId, 40), boardId: clean(ride.boardId, 40), alightId: clean(ride.alightId, 40) };
    });
    return { idempotencyKey, summary, rides };
  })
  .handler(async ({ context, data }) => {
    if (limited(`ticket:${context.userId}`, 8, 60_000)) return { ok: false as const, error: "rate" };
    let amount = 0;
    const models = new Set<string>();
    for (const ride of data.rides) {
      const fare = priceRide(ride.routeId, ride.boardId, ride.alightId);
      if (!fare) return { ok: false as const, error: "invalid_ride" };
      amount += fare.amountLkr;
      models.add(fare.modelId);
    }
    const fareModel = models.size === 1 ? ([...models][0] ?? "mixed") : "mixed";
    const sql = await sqlClient();
    const id = crypto.randomUUID();
    await sql`insert into tickets (id, user_id, status, summary_json, rides_json, amount_lkr, fare_model, idempotency_key)
      values (${id}, ${context.userId}, 'pending_payment', ${JSON.stringify(data.summary)}, ${JSON.stringify(data.rides)}, ${amount}, ${fareModel}, ${data.idempotencyKey})
      on conflict (user_id, idempotency_key) do nothing`;
    const rows = await sql<TicketRow>`select id, status, amount_lkr, fare_model, summary_json, idempotency_key, provider, provider_ref, paid_at, redeemed_at, refunded_at, created_at
      from tickets where user_id = ${context.userId} and idempotency_key = ${data.idempotencyKey} limit 1`;
    const row = rows[0];
    if (!row) return { ok: false as const, error: "failed" };
    return { ok: true as const, ticket: viewTicket(row) };
  });

async function loadOwn(sql: Sql, userId: string, id: string) {
  const rows = await sql<TicketRow>`select id, status, amount_lkr, fare_model, summary_json, idempotency_key, provider, provider_ref, paid_at, redeemed_at, refunded_at, created_at
    from tickets where id = ${id} and user_id = ${userId} limit 1`;
  return rows[0] ?? null;
}

export const confirmTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = input as { id?: unknown; idempotencyKey?: unknown };
    return { id: clean(body.id, 80), idempotencyKey: clean(body.idempotencyKey, 80) };
  })
  .handler(async ({ context, data }) => {
    const sql = await sqlClient();
    const row = await loadOwn(sql, context.userId, data.id);
    if (!row) return { ok: false as const, error: "missing" };
    const next = confirmSandbox(recordOf(row), data.idempotencyKey, new Date().toISOString());
    if (next.outcome === "rejected") return { ok: false as const, error: "rejected", ticket: viewTicket(row) };
    if (next.outcome === "paid") {
      await sql`update tickets set status = 'paid', paid_at = ${next.ticket.paidAt}, provider_ref = ${next.ticket.providerRef}
        where id = ${row.id} and user_id = ${context.userId} and status = 'pending_payment'`;
    }
    const fresh = await loadOwn(sql, context.userId, data.id);
    if (!fresh) return { ok: false as const, error: "missing" };
    return { ok: true as const, outcome: next.outcome, ticket: viewTicket(fresh) };
  });

export const failTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: clean((input as { id?: unknown })?.id, 80) }))
  .handler(async ({ context, data }) => {
    const sql = await sqlClient();
    const row = await loadOwn(sql, context.userId, data.id);
    if (!row) return { ok: false as const, error: "missing" };
    const next = failSandbox(recordOf(row));
    if (next.outcome === "failed") {
      await sql`update tickets set status = 'failed' where id = ${row.id} and user_id = ${context.userId} and status = 'pending_payment'`;
    }
    const fresh = await loadOwn(sql, context.userId, data.id);
    return fresh
      ? { ok: true as const, outcome: next.outcome, ticket: viewTicket(fresh) }
      : { ok: false as const, error: "missing" };
  });

export const refundOwnTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: clean((input as { id?: unknown })?.id, 80) }))
  .handler(async ({ context, data }) => {
    const sql = await sqlClient();
    const row = await loadOwn(sql, context.userId, data.id);
    if (!row) return { ok: false as const, error: "missing" };
    const next = refundTicket(recordOf(row), new Date().toISOString());
    if (next.outcome === "refunded") {
      await sql`update tickets set status = 'refunded', refunded_at = ${next.ticket.refundedAt}
        where id = ${row.id} and user_id = ${context.userId} and status = 'paid'`;
    }
    const fresh = await loadOwn(sql, context.userId, data.id);
    return fresh
      ? { ok: true as const, outcome: next.outcome, ticket: viewTicket(fresh) }
      : { ok: false as const, error: "missing" };
  });

export const createShare = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = input as { consent?: unknown; journeyJson?: unknown };
    if (body.consent !== true) throw new Error("consent");
    const journeyJson = clean(body.journeyJson, 40_000);
    return { journeyJson };
  })
  .handler(async ({ context, data }) => {
    if (limited(`share:${context.userId}`, 10, 60_000)) return { ok: false as const, error: "rate" };
    const sql = await sqlClient();
    const id = crypto.randomUUID();
    const expires = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    await sql`insert into trip_shares (id, user_id, journey_json, expires_at) values (${id}, ${context.userId}, ${data.journeyJson}, ${expires})`;
    return { ok: true as const, id, expiresAt: expires };
  });

export const saveJourney = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = input as { id?: unknown; title?: unknown; journeyJson?: unknown };
    return { id: clean(body.id, 120), title: clean(body.title, 120), journeyJson: clean(body.journeyJson, 40_000) };
  })
  .handler(async ({ context, data }) => {
    const sql = await sqlClient();
    await sql`insert into saved_journeys (id, user_id, title, journey_json) values (${data.id}, ${context.userId}, ${data.title}, ${data.journeyJson})
      on conflict (id) do nothing`;
    return { ok: true as const };
  });

export const listSavedJourneys = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await sqlClient();
    return sql<{ id: string; title: string; created_at: unknown }>`
      select id, title, created_at from saved_journeys where user_id = ${context.userId} order by created_at desc limit 20`;
  });

export const sendFeedback = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = input as { kind?: unknown; message?: unknown; refId?: unknown };
    const kind = clean(body.kind, 20);
    if (!["stop", "route", "vehicle", "other"].includes(kind)) throw new Error("Invalid kind");
    return { kind, message: clean(body.message, 1000), refId: optionalClean(body.refId, 80) || null };
  })
  .handler(async ({ context, data }) => {
    if (limited(`feedback:${context.userId}`, 6, 60_000)) return { ok: false as const, error: "rate" };
    const sql = await sqlClient();
    await sql`insert into feedback (id, user_id, kind, message, ref_id) values (${crypto.randomUUID()}, ${context.userId}, ${data.kind}, ${data.message}, ${data.refId})`;
    return { ok: true as const };
  });

export const sendArrivalReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = input as { stopId?: unknown; routeId?: unknown; note?: unknown };
    const stopId = clean(body.stopId, 40);
    const routeId = clean(body.routeId, 40);
    if (!stopById(stopId) || !routeById(routeId)) throw new Error("Invalid report");
    return { stopId, routeId, note: optionalClean(body.note, 200) || null };
  })
  .handler(async ({ context, data }) => {
    if (limited(`report:${context.userId}`, 6, 60_000)) return { ok: false as const, error: "rate" };
    const sql = await sqlClient();
    await sql`insert into arrival_reports (id, user_id, stop_id, route_id, note) values (${crypto.randomUUID()}, ${context.userId}, ${data.stopId}, ${data.routeId}, ${data.note})`;
    return { ok: true as const };
  });

export const deleteAccountData = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await sqlClient();
    const anon = `deleted:${(await sha256(context.userId)).slice(0, 16)}`;
    await sql`delete from saved_places where user_id = ${context.userId}`;
    await sql`delete from saved_journeys where user_id = ${context.userId}`;
    await sql`delete from feedback where user_id = ${context.userId}`;
    await sql`delete from arrival_reports where user_id = ${context.userId}`;
    await sql`delete from trip_shares where user_id = ${context.userId}`;
    await sql`update tickets set user_id = ${anon} where user_id = ${context.userId}`;
    await sql`delete from staff_roles where user_id = ${context.userId}`;
    await sql`delete from profiles where user_id = ${context.userId}`;
    await audit(sql, anon, "account_deleted", "app data unlinked");
    return { ok: true as const };
  });

export const claimOperator = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await sqlClient();
    const inserted = await sql<{ user_id: string }>`
      insert into staff_roles (user_id, role)
      select ${context.userId}, 'operator'
      where not exists (select 1 from staff_roles)
      returning user_id`;
    if (!inserted[0]) return { ok: false as const, error: "already_claimed" };
    await audit(sql, context.userId, "claim_operator", "first operator");
    return { ok: true as const };
  });

export const createInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await sqlClient();
    if (!(await requireStaff(sql, context.userId))) return { ok: false as const, error: "forbidden" };
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const code = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
    await sql`insert into operator_invites (code_hash, created_by) values (${await sha256(code)}, ${context.userId})`;
    await audit(sql, context.userId, "create_invite", "operator invite issued");
    return { ok: true as const, code };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ code: clean((input as { code?: unknown })?.code, 16).toUpperCase() }))
  .handler(async ({ context, data }) => {
    const sql = await sqlClient();
    const hash = await sha256(data.code);
    const rows = await sql<{ code_hash: string }>`select code_hash from operator_invites where code_hash = ${hash} and used_by is null limit 1`;
    if (!rows[0]) return { ok: false as const, error: "bad_invite" };
    await sql`update operator_invites set used_by = ${context.userId}, used_at = now() where code_hash = ${hash} and used_by is null`;
    await sql`insert into staff_roles (user_id, role) values (${context.userId}, 'operator')
      on conflict (user_id) do update set role = 'operator'`;
    await audit(sql, context.userId, "accept_invite", "invite redeemed");
    return { ok: true as const };
  });

export const staffOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await sqlClient();
    if (!(await requireStaff(sql, context.userId))) return { ok: false as const, error: "forbidden" };
    const tickets = await sql<{ status: string; n: number; amount: number }>`
      select status, count(*)::int as n, coalesce(sum(amount_lkr), 0)::int as amount from tickets group by status`;
    const feedback = await sql<{ n: number }>`select count(*)::int as n from feedback`;
    const reports = await sql<{ n: number }>`select count(*)::int as n from arrival_reports where status = 'unverified'`;
    const alerts = await sql<{
      id: string;
      severity: string;
      route_id: string | null;
      active: boolean;
      title_en: string;
      body_en: string;
    }>`select id, severity, route_id, active, title_en, body_en from service_alerts order by created_at desc limit 20`;
    const inbox = await sql<{ id: string; kind: string; message: string; ref_id: string | null; created_at: unknown }>`
      select id, kind, message, ref_id, created_at from feedback order by created_at desc limit 30`;
    const reportRows = await sql<{ id: string; stop_id: string; route_id: string; note: string | null; status: string; created_at: unknown }>`
      select id, stop_id, route_id, note, status, created_at from arrival_reports order by created_at desc limit 30`;
    const auditRows = await sql<{ id: string; action: string; detail: string | null; created_at: unknown }>`
      select id, action, detail, created_at from audit_log order by created_at desc limit 30`;
    const overrides = await sql<{ route_id: string; headway_min: number | null; active: boolean; note: string | null }>`
      select route_id, headway_min, active, note from route_overrides`;
    return {
      ok: true as const,
      tickets: tickets.map((row) => ({ status: row.status, n: Number(row.n), amount: Number(row.amount) })),
      feedbackCount: Number(feedback[0]?.n ?? 0),
      unverifiedReports: Number(reports[0]?.n ?? 0),
      alerts,
      inbox: inbox.map((row) => ({ ...row, createdAt: stamp(row.created_at) })),
      reports: reportRows.map((row) => ({ ...row, createdAt: stamp(row.created_at) })),
      audit: auditRows.map((row) => ({ ...row, createdAt: stamp(row.created_at) })),
      overrides,
    };
  });

export const inspectTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = clean((input as { id?: unknown })?.id, 80);
    const id = raw.startsWith("gaman:ticket:") ? raw.slice("gaman:ticket:".length) : raw;
    return { id: clean(id, 80) };
  })
  .handler(async ({ context, data }) => {
    const sql = await sqlClient();
    if (!(await requireStaff(sql, context.userId))) return { ok: false as const, error: "forbidden" };
    const rows = await sql<TicketRow>`select id, status, amount_lkr, fare_model, summary_json, idempotency_key, provider, provider_ref, paid_at, redeemed_at, refunded_at, created_at
      from tickets where id = ${data.id} limit 1`;
    const row = rows[0];
    if (!row) return { ok: false as const, error: "missing" };
    return { ok: true as const, ticket: viewTicket(row), validation: validateTicket(recordOf(row)) };
  });

export const redeemStaffTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: clean((input as { id?: unknown })?.id, 80) }))
  .handler(async ({ context, data }) => {
    const sql = await sqlClient();
    if (!(await requireStaff(sql, context.userId))) return { ok: false as const, error: "forbidden" };
    const updated = await sql<{ id: string }>`update tickets set status = 'redeemed', redeemed_at = now()
      where id = ${data.id} and status = 'paid' returning id`;
    if (updated[0]) {
      await audit(sql, context.userId, "redeem_ticket", data.id);
      return { ok: true as const, outcome: "redeemed" as const };
    }
    const rows = await sql<{ status: string }>`select status from tickets where id = ${data.id} limit 1`;
    if (!rows[0]) return { ok: false as const, error: "missing" };
    if (rows[0].status === "redeemed") return { ok: false as const, error: "already_redeemed" };
    return { ok: false as const, error: "not_payable" };
  });

export const saveOverride = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = input as { routeId?: unknown; headwayMin?: unknown; active?: unknown; note?: unknown };
    const routeId = clean(body.routeId, 40);
    if (!routeById(routeId)) throw new Error("Invalid route");
    const headway = Number(body.headwayMin);
    return {
      routeId,
      headwayMin: Number.isFinite(headway) ? Math.max(2, Math.min(120, Math.round(headway))) : null,
      active: body.active !== false,
      note: optionalClean(body.note, 280) || null,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await sqlClient();
    if (!(await requireStaff(sql, context.userId))) return { ok: false as const, error: "forbidden" };
    await sql`insert into route_overrides (route_id, headway_min, active, note, updated_by)
      values (${data.routeId}, ${data.headwayMin}, ${data.active}, ${data.note}, ${context.userId})
      on conflict (route_id) do update set headway_min = excluded.headway_min, active = excluded.active, note = excluded.note, updated_by = excluded.updated_by, updated_at = now()`;
    await audit(sql, context.userId, "save_override", data.routeId);
    return { ok: true as const };
  });

export const postAlert = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = input as {
      titleEn?: unknown;
      titleSi?: unknown;
      titleTa?: unknown;
      bodyEn?: unknown;
      bodySi?: unknown;
      bodyTa?: unknown;
      severity?: unknown;
      routeId?: unknown;
    };
    const titleEn = clean(body.titleEn, 120);
    const bodyEn = clean(body.bodyEn, 600);
    const routeId = optionalClean(body.routeId, 40);
    if (routeId && !routeById(routeId)) throw new Error("Invalid route");
    const severity = body.severity === "disruption" ? "disruption" : "info";
    return {
      titleEn,
      titleSi: optionalClean(body.titleSi, 120) || titleEn,
      titleTa: optionalClean(body.titleTa, 120) || titleEn,
      bodyEn,
      bodySi: optionalClean(body.bodySi, 600) || bodyEn,
      bodyTa: optionalClean(body.bodyTa, 600) || bodyEn,
      severity,
      routeId: routeId || null,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await sqlClient();
    if (!(await requireStaff(sql, context.userId))) return { ok: false as const, error: "forbidden" };
    const id = crypto.randomUUID();
    await sql`insert into service_alerts (id, severity, route_id, active, title_en, title_si, title_ta, body_en, body_si, body_ta, created_by)
      values (${id}, ${data.severity}, ${data.routeId}, true, ${data.titleEn}, ${data.titleSi}, ${data.titleTa}, ${data.bodyEn}, ${data.bodySi}, ${data.bodyTa}, ${context.userId})`;
    await audit(sql, context.userId, "post_alert", id);
    return { ok: true as const, id };
  });

export const setAlertActive = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = input as { id?: unknown; active?: unknown };
    return { id: clean(body.id, 80), active: body.active === true };
  })
  .handler(async ({ context, data }) => {
    const sql = await sqlClient();
    if (!(await requireStaff(sql, context.userId))) return { ok: false as const, error: "forbidden" };
    await sql`update service_alerts set active = ${data.active} where id = ${data.id}`;
    await audit(sql, context.userId, "set_alert", `${data.id}:${data.active ? "on" : "off"}`);
    return { ok: true as const };
  });

export const reviewReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = input as { id?: unknown; status?: unknown };
    const status = body.status === "verified" ? "verified" : "rejected";
    return { id: clean(body.id, 80), status };
  })
  .handler(async ({ context, data }) => {
    const sql = await sqlClient();
    if (!(await requireStaff(sql, context.userId))) return { ok: false as const, error: "forbidden" };
    await sql`update arrival_reports set status = ${data.status} where id = ${data.id}`;
    await audit(sql, context.userId, "review_report", `${data.id}:${data.status}`);
    return { ok: true as const };
  });
