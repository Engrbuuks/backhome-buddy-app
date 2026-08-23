-- 0037: shared rate-limit store for auth endpoints (run AFTER 0036)
--
-- WHY: the app's rate limiter was an in-memory Map. On Vercel every serverless
-- instance holds its own copy, so "8 attempts per minute" was really "8 per
-- instance per minute" — and a burst of traffic spawns instances, which is
-- exactly what a brute-force attempt looks like. This moves the counter into
-- Postgres so every instance counts against the same number.
--
-- The in-memory check stays in front of this as a fast path; this table is the
-- authority. The app FAILS OPEN if this is unavailable, so a database hiccup can
-- never lock legitimate users out of signing in.

create table if not exists auth_rate_limits (
  key          text primary key,          -- e.g. 'signin:someone@example.com'
  count        int not null default 0,
  window_start timestamptz not null default now()
);

create index if not exists auth_rate_limits_window_idx on auth_rate_limits (window_start);

-- No policies => service role only. Never exposed to anon/authenticated clients.
alter table auth_rate_limits enable row level security;

/**
 * Count one attempt against `p_key` and return the running total for the current
 * window. Rolls the window over automatically once it has expired.
 *
 * Atomic: the whole thing is a single INSERT ... ON CONFLICT, so two instances
 * hitting it at the same moment cannot both read a stale count.
 */
create or replace function public.bump_rate_limit(p_key text, p_window_seconds int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_cutoff timestamptz := now() - make_interval(secs => p_window_seconds);
begin
  insert into auth_rate_limits as a (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count        = case when a.window_start < v_cutoff then 1 else a.count + 1 end,
        window_start = case when a.window_start < v_cutoff then now() else a.window_start end
  returning a.count into v_count;

  -- Opportunistic cleanup (~1 call in 100) so the table can't grow forever.
  if random() < 0.01 then
    delete from auth_rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count;
end;
$$;

-- Callable only by trusted server code holding the service-role key.
revoke all on function public.bump_rate_limit(text, int) from public, anon, authenticated;
grant execute on function public.bump_rate_limit(text, int) to service_role;
