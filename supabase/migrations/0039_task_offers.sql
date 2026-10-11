-- 0039: the offer and accept layer. Run AFTER 0038.
--
-- WHY OFFER RATHER THAN ASSIGN
--
-- Assigning a task to a buddy who is asleep, travelling or already holding
-- three jobs creates a silent failure: nobody notices until the client asks.
-- So on payment the task is OFFERED to the best ranked eligible buddy with a
-- time window, and cascades down the shortlist on decline or timeout.
--
-- One build, five problems: it removes the manual assignment step, it gives a
-- buddy a legitimate way to say the pay is too low, decline reasons become
-- pricing intelligence, accept rate and response time become the first real
-- reliability signal, and that signal is what later makes automated matching
-- safe. Manual assignment is untouched and overrides at any point.
--
-- THE RACE THAT MATTERS
--
-- Two buddies holding live offers for the same request must never both accept.
-- accept_task_offer does the whole claim inside one transaction with row locks,
-- so the second accept finds the request already taken and fails cleanly.
--
-- The TypeScript state machine remains the authority on which transitions are
-- legal; the SQL below re-checks the same 'paid' -> 'assigned' edge purely as a
-- race guard. If ALLOWED_TRANSITIONS ever changes for assignment, change the
-- status check in accept_task_offer to match.

create table if not exists task_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  buddy_id uuid not null references profiles(id) on delete cascade,

  -- Where this buddy sat in the shortlist, and which cascade round this is.
  rank int not null default 1,
  round int not null default 1,
  -- Matcher score at the moment of offer, frozen for later analysis.
  score int,

  status text not null default 'pending',
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,

  -- Why they said no. This is the pricing intelligence: four declines on price
  -- in one area means the rate card is wrong there, and nothing else tells you.
  decline_reason text,
  decline_note text,

  -- Null when the offer was raised automatically on payment.
  created_by uuid references profiles(id) on delete set null
);

do $$ begin
  alter table task_offers add constraint task_offer_status_known
    check (status in ('pending','accepted','declined','expired','superseded'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table task_offers add constraint task_offer_decline_reason_known
    check (decline_reason is null or decline_reason in
      ('payout_too_low','too_far','not_available','outside_my_skill','other'));
exception when duplicate_object then null; end $$;

-- A declined offer must say why. Silent declines would waste the whole signal.
do $$ begin
  alter table task_offers add constraint task_offer_decline_has_reason
    check (status <> 'declined' or decline_reason is not null);
exception when duplicate_object then null; end $$;

-- At most ONE live offer per request. This is what makes the cascade a queue
-- rather than a scramble, and it is enforced by the database, not by hope.
create unique index if not exists task_offers_one_pending_per_request
  on task_offers (request_id) where status = 'pending';

-- Never offer the same request to the same buddy twice in one round.
create unique index if not exists task_offers_no_repeat
  on task_offers (request_id, buddy_id, round);

create index if not exists task_offers_buddy_idx on task_offers (buddy_id, status, offered_at desc);
create index if not exists task_offers_expiry_idx on task_offers (expires_at) where status = 'pending';

alter table task_offers enable row level security;

-- A buddy may read their own offers and nothing else. All writes go through the
-- security-definer functions below or service-role server actions, so there is
-- no insert/update/delete policy here on purpose.
do $$ begin
  create policy task_offers_own_select on task_offers
    for select using (buddy_id = auth.uid());
exception when duplicate_object then null; end $$;

comment on table task_offers is
  'Time boxed offers of a paid task to ranked buddies. One pending offer per '
  'request at a time; declines must carry a reason.';

/**
 * Accept an offer, atomically.
 *
 * Every eligibility rule is re-checked HERE rather than trusted from the moment
 * the offer was raised, because minutes may have passed: the buddy may have
 * been suspended, turned off availability, filled their capacity, or had their
 * clearance lowered. An offer is an invitation, never a pre-authorisation.
 *
 * Returns jsonb { ok: bool, reason: text }. Never raises on a losing race, so
 * the caller can show the buddy a plain message instead of an error page.
 */
create or replace function public.accept_task_offer(p_offer uuid, p_buddy uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o            task_offers%rowtype;
  r            requests%rowtype;
  b            buddy_profiles%rowtype;
  v_tier       trust_tier;
  v_min_tasks  int;
  v_live       int;
  tier_rank    constant jsonb := '{"standard":0,"high_value":1,"safeguarding":2}'::jsonb;
begin
  -- Lock the offer first, then the request, always in that order, so two
  -- concurrent accepts queue behind each other instead of deadlocking.
  select * into o from task_offers where id = p_offer for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Offer not found.');
  end if;
  if o.buddy_id <> p_buddy then
    return jsonb_build_object('ok', false, 'reason', 'This offer is not yours.');
  end if;
  if o.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'This offer is no longer open.');
  end if;
  if o.expires_at <= now() then
    update task_offers set status = 'expired', responded_at = now() where id = o.id;
    return jsonb_build_object('ok', false, 'reason', 'This offer has expired.');
  end if;

  select * into r from requests where id = o.request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Request not found.');
  end if;
  if r.assigned_buddy_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'This task has already been taken.');
  end if;
  -- Mirrors ALLOWED_TRANSITIONS: paid -> assigned.
  if r.status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'This task is no longer available for assignment.');
  end if;

  select * into b from buddy_profiles where id = p_buddy for update;
  if not found or b.vetting <> 'approved' then
    return jsonb_build_object('ok', false, 'reason', 'Your account is not approved for tasks.');
  end if;
  if not b.accepting_work then
    return jsonb_build_object('ok', false, 'reason', 'Turn availability back on before accepting work.');
  end if;

  -- Capacity, counted live rather than cached.
  select count(*) into v_live
  from requests
  where assigned_buddy_id = p_buddy and status in ('assigned','in_progress','proof_ready');
  if v_live >= b.max_concurrent_tasks then
    return jsonb_build_object('ok', false, 'reason',
      format('You are already holding %s tasks, which is your limit.', v_live));
  end if;

  -- Exposure gates: clearance must cover the task's trust tier, and the buddy
  -- must have enough completed work behind them.
  select st.trust_tier, st.min_completed_tasks into v_tier, v_min_tasks
  from service_types st where st.id = r.service_type_id;

  if v_tier is not null
     and (tier_rank ->> b.clearance_tier::text)::int < (tier_rank ->> v_tier::text)::int then
    return jsonb_build_object('ok', false, 'reason', 'You are not cleared for this type of task.');
  end if;
  if v_min_tasks is not null and b.tasks_completed < v_min_tasks then
    return jsonb_build_object('ok', false, 'reason',
      format('This task needs %s completed tasks; you have %s.', v_min_tasks, b.tasks_completed));
  end if;

  -- Claim it.
  update task_offers set status = 'accepted', responded_at = now() where id = o.id;
  update task_offers set status = 'superseded', responded_at = now()
    where request_id = o.request_id and id <> o.id and status = 'pending';
  update requests
    set assigned_buddy_id = p_buddy, status = 'assigned', updated_at = now()
    where id = r.id;

  insert into request_timeline (request_id, from_status, to_status, actor_id, note)
  values (r.id, r.status, 'assigned', p_buddy, 'Buddy accepted the offer');

  return jsonb_build_object('ok', true, 'reason', '');
end;
$$;

revoke all on function public.accept_task_offer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_task_offer(uuid, uuid) to service_role;

/**
 * Mark pending offers past their window as expired. Called by the cron route,
 * which then cascades each affected request to the next buddy. Returns the
 * request ids that just lost their offer, so the caller knows what to re-offer.
 */
create or replace function public.expire_stale_offers()
returns table (request_id uuid)
language sql
security definer
set search_path = public
as $$
  update task_offers
  set status = 'expired', responded_at = now()
  where status = 'pending' and expires_at <= now()
  returning task_offers.request_id;
$$;

revoke all on function public.expire_stale_offers() from public, anon, authenticated;
grant execute on function public.expire_stale_offers() to service_role;
