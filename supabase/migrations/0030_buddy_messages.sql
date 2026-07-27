-- 0030: allow the assigned buddy to take part in a request's message thread.
-- The thread becomes three-way: client, staff (admin), and the assigned buddy.
-- Everyone on the request can read; each can post as themselves.

-- 1. Relax the sender check to include 'buddy'.
alter table request_messages drop constraint if exists request_messages_sender_check;
alter table request_messages add constraint request_messages_sender_check
  check (sender in ('client', 'staff', 'buddy'));

-- 2. Let the assigned buddy READ the thread for their task.
drop policy if exists "buddy reads assigned request messages" on request_messages;
create policy "buddy reads assigned request messages" on request_messages
  for select using (
    exists (select 1 from requests r where r.id = request_id and r.assigned_buddy_id = auth.uid())
  );

-- 3. Let the assigned buddy POST to the thread for their task.
drop policy if exists "buddy sends on assigned request" on request_messages;
create policy "buddy sends on assigned request" on request_messages
  for insert with check (
    sender = 'buddy'
    and sender_id = auth.uid()
    and exists (select 1 from requests r where r.id = request_id and r.assigned_buddy_id = auth.uid())
  );
