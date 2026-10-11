-- 0041: automated bank account name verification. Run AFTER 0040.
--
-- WHY THIS IS THE BEST FREE IDENTITY CHECK AVAILABLE IN NIGERIA
--
-- Paystack's Account Resolve endpoint is free in Nigeria. Send an account
-- number and a bank code, get back the name the bank holds. To open that
-- account the person already passed the bank's own KYC, which means BVN, which
-- means biometric enrolment at a branch.
--
-- So a name match is not "they typed their name twice". It is evidence that a
-- Nigerian bank, with fingerprints on file, believes this person is who they
-- say they are. For nothing.
--
-- It is also on the critical path regardless: the account is how the buddy
-- gets paid, so it must be collected and correct anyway. The verification is a
-- free side effect of work you already have to do.
--
-- What it does NOT prove: that the person holding the phone is the account
-- holder. It catches fabricated identities, not impersonation. Face match
-- against the NIMC photo is what closes that gap, and that one costs money.

alter table buddy_profiles
  -- Paystack's numeric bank code, e.g. "058" for GTBank. Required for resolve;
  -- the existing bank_name is free text and cannot be used for a lookup.
  add column if not exists bank_code text,
  -- Exactly what the bank returned, stored verbatim. Never overwrite the
  -- buddy's own entry with it: the discrepancy is the signal.
  add column if not exists bank_verified_name text,
  add column if not exists bank_verified_at timestamptz,
  -- pass | review | fail — the outcome of comparing the two names.
  add column if not exists bank_match_outcome text,
  -- 0 to 1. How much of the shorter name was found in the longer.
  add column if not exists bank_match_score numeric(4,3);

do $$ begin
  alter table buddy_profiles add constraint bank_match_outcome_known
    check (bank_match_outcome is null or bank_match_outcome in ('pass','review','fail'));
exception when duplicate_object then null; end $$;

-- Duplicate detection. One person running several buddy accounts is the most
-- common fraud in this model, and a shared payout account is the clearest
-- signal of it. Not a unique constraint: a genuine family may share an
-- account, so this is for flagging rather than blocking.
create index if not exists buddy_profiles_bank_account_idx
  on buddy_profiles (bank_account_number)
  where bank_account_number is not null;

comment on column buddy_profiles.bank_verified_name is
  'Name returned by the bank via Paystack resolve. Stored as received; never '
  'overwrites what the buddy typed, because the difference is the evidence.';
