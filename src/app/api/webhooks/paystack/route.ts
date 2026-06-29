import { NextRequest, NextResponse } from "next/server";

/**
 * Paystack webhook endpoint.
 * WHEN WIRING PAYMENTS (build step 7):
 *  1. Read the raw body + 'x-paystack-signature' header.
 *  2. Verify the HMAC signature against PAYSTACK_WEBHOOK_SECRET — reject if invalid.
 *  3. Parse via PaystackProvider.parseWebhook().
 *  4. Idempotency: look up by provider_reference; if already processed, return 200 and stop.
 *  5. Update payments/payouts + advance the request state machine (service-role).
 * The webhook — not the browser redirect — is the source of truth for payment status.
 */
export async function POST(_req: NextRequest) {
  // TODO: implement at payments step
  return NextResponse.json({ received: true });
}
