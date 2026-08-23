-- 0015: make user deletion safe for incidental references (run AFTER 0014)
-- Audit/timeline/notification rows shouldn't block deleting a user; the
-- history is kept with the actor set to null. Money/request FKs stay strict
-- ON PURPOSE: a user with real requests/payments should never be deletable.

alter table audit_log drop constraint if exists audit_log_actor_id_fkey;
alter table audit_log add constraint audit_log_actor_id_fkey
  foreign key (actor_id) references profiles(id) on delete set null;

alter table notifications drop constraint if exists notifications_user_id_fkey;
alter table notifications add constraint notifications_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

alter table request_timeline drop constraint if exists request_timeline_actor_id_fkey;
alter table request_timeline add constraint request_timeline_actor_id_fkey
  foreign key (actor_id) references profiles(id) on delete set null;

alter table additional_charges drop constraint if exists additional_charges_proposed_by_fkey;
alter table additional_charges add constraint additional_charges_proposed_by_fkey
  foreign key (proposed_by) references profiles(id) on delete set null;
