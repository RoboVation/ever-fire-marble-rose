import { createFileRoute } from "@tanstack/react-router";
import { verifyPayhereWebhook } from "@/lib/payments/gateways";

export const Route = createFileRoute("/api/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-payhere-signature");
        const result = await verifyPayhereWebhook(raw, signature, process.env.PAYHERE_MERCHANT_SECRET);
        return new Response(JSON.stringify({ ok: result.ok, reason: result.reason }), {
          status: result.status,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
