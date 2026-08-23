/**
 * The single payment abstraction (ARCHITECTURE.md §6).
 * Business logic depends ONLY on this interface — never on a provider SDK
 * directly. Paystack and Flutterwave each implement it. Swapping or adding a
 * provider (incl. a future licensed escrow partner for payouts) means writing
 * one new implementation, not touching business logic.
 */

export interface InitPaymentResult { checkoutUrl: string; reference: string; }
export interface VerifyResult { status: "succeeded" | "failed" | "pending"; amountNgn: number; }
export interface PayoutResult { reference: string; status: "processing" | "paid" | "failed"; }
export interface BankDetails { bankCode: string; accountNumber: string; accountName: string; }
export interface NormalizedWebhookEvent {
  type: "payment.succeeded" | "payment.failed" | "payout.paid" | "payout.failed" | "unknown";
  reference: string;
  amountNgn: number;
}

export interface PaymentProvider {
  /** Start a client payment; returns a hosted checkout URL + our reference. */
  initializePayment(args: { reference: string; amountNgn: number; email: string }): Promise<InitPaymentResult>;
  /** Server-side truth check of a payment's status. */
  verifyPayment(reference: string): Promise<VerifyResult>;
  /** Send a payout (transfer) to a buddy's bank account. */
  initiatePayout(args: { reference: string; amountNgn: number; bank: BankDetails }): Promise<PayoutResult>;
  verifyPayout(reference: string): Promise<PayoutResult>;
  /** Issue a (full or partial) refund against a payment. */
  initiateRefund(args: { reference: string; amountNgn: number }): Promise<{ reference: string; status: string }>;
  /**
   * Verify the webhook signature and normalize the payload to a common event.
   * MUST verify the signature and reject forgeries before returning.
   */
  parseWebhook(rawBody: string, signature: string): NormalizedWebhookEvent;
}
