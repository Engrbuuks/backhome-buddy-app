/**
 * Shared application types — mirror the database schema (see ARCHITECTURE.md §5).
 * Keep this in sync with the SQL migration. When you generate Supabase types
 * later (`supabase gen types`), these hand-written ones can be replaced/merged.
 */

export type UserRole = "client" | "buddy" | "admin";

export type RequestStatus =
  | "draft" | "submitted" | "quoted" | "awaiting_pay" | "paid" | "assigned"
  | "in_progress" | "proof_ready" | "proof_approved" | "completed" | "paid_out"
  | "cancelled" | "refunded" | "disputed";

export type BuddyVetting =
  | "applied" | "under_review" | "approved" | "rejected" | "suspended";

export type PaymentStatus =
  | "pending" | "succeeded" | "failed" | "refunded" | "partial_refund";
export type PayoutStatus = "pending" | "processing" | "paid" | "failed";
/** Matches the `payment_provider` DB enum. `manual` was added in migration 0003
 *  and is what the live collect-and-release flow actually uses (admin records a
 *  bank transfer in and a bank transfer out). Keep this union in step with the
 *  enum — anything missing here silently forces call sites onto `any`. */
export type PaymentProvider = "paystack" | "flutterwave" | "manual";
export type ProofKind = "photo" | "video" | "report";
export type TxnKind = "payment" | "payout" | "refund";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  base_price_ngn: number;
  default_buddy_payout_pct: number;
  active: boolean;
  sort_order: number;
}

export interface Request {
  id: string;
  client_id: string;
  service_type_id: string | null;
  region_id: string | null;
  status: RequestStatus;
  title: string | null;
  description: string | null;
  urgency: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_address: string | null;
  client_price_ngn: number | null;
  buddy_payout_ngn: number | null;
  assigned_buddy_id: string | null;
  created_at: string;
  updated_at: string;

  // ── Added after 0001. Optional here so existing narrower selects still type-check;
  //    they are real columns, not maybes. See the migration noted against each. ──
  /** 0004 — currency the client sees this request priced in. */
  display_currency?: string;
  /** 0004 — NGN-per-USD rate locked at quote time, so the price can't drift. */
  fx_rate?: number | null;
  /** 0010 — out-of-coverage demand capture ("Another state"). */
  requested_state?: string | null;
  /** 0011 — the client's checklist / what "done" means to them. */
  expectations?: string | null;
  /** 0013 — client-facing completion report. */
  report?: string | null;
  /** 0014 + 0031 — how the client answered the quote. */
  quote_decision?: "accepted" | "changes_requested" | "countered" | null;
  quote_decision_note?: string | null;
  /** 0031 — the client's proposed price (NGN) and the anti-haggle round counter. */
  counter_amount_ngn?: number | null;
  negotiation_rounds?: number;
  /** 0034 — client price minus passthrough purchases; the money actually earned. */
  service_revenue_ngn?: number | null;
}
