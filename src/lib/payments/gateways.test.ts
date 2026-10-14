import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyPayhereWebhook } from "./gateways.ts";

test("webhook rejects when the merchant secret is absent or the signature is wrong", async () => {
  const missing = await verifyPayhereWebhook("{}", null, undefined);
  assert.equal(missing.status, 501);
  assert.equal(missing.ok, false);
  const bad = await verifyPayhereWebhook("{}", "nope", "test-secret");
  assert.equal(bad.status, 401);
});

test("a valid placeholder signature does not imply a captured ticket", async () => {
  const body = "{\"order_id\":\"t1\"}";
  const signature = createHmac("sha256", "test-secret").update(body).digest("hex");
  const result = await verifyPayhereWebhook(body, signature, "test-secret");
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.match(result.reason, /unchanged/i);
});
