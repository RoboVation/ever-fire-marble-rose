/**
 * PayHere is the intended Sri Lankan merchant gateway (sandbox, then live)
 * once a business is approved. This build does not ship merchant secrets.
 *
 * The working passenger flow is an explicit sandbox confirmation inside an
 * authenticated server function. This webhook verifier is a placeholder:
 * it checks an HMAC-SHA256 of the raw body when PAYHERE_MERCHANT_SECRET is
 * set, and never marks a ticket paid. Official PayHere notify fields are a
 * different algorithm and must replace this before live money moves.
 */
export async function verifyPayhereWebhook(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
): Promise<{ ok: boolean; status: number; reason: string }> {
  if (!secret) {
    return {
      ok: false,
      status: 501,
      reason: "PAYHERE_MERCHANT_SECRET is not configured",
    };
  }
  if (!signature) return { ok: false, status: 401, reason: "missing signature" };
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (!safeEqual(hex, signature.trim().toLowerCase())) {
    return { ok: false, status: 401, reason: "bad signature" };
  }
  return {
    ok: true,
    status: 200,
    reason: "signature valid; ticket state is unchanged until the official notify schema is mapped",
  };
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
