import { NextRequest, NextResponse } from "next/server";

/**
 * Flutterwave webhook endpoint. Same contract as Paystack:
 * verify signature (verif-hash header) → parse → idempotency check → update + advance state.
 */
export async function POST(_req: NextRequest) {
  // TODO: implement at payments step
  return NextResponse.json({ received: true });
}
