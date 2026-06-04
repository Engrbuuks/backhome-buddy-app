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
export type PaymentProvider = "paystack" | "flutterwave";
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
}
