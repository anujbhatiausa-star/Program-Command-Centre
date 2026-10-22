-- Program Command Center: schema, indexes, row-level security, realtime.
-- Run once in the Supabase SQL Editor of a NEW, dedicated project.
-- Sample data only. Customer-visible data and PM-only finance data live in separate tables.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- People and access
-- ---------------------------------------------------------------------------
create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org text not null check (org in ('algoworks', 'customer')),
  role_title text not null,
  location text not null,
  region text not null check (region in ('Onshore', 'Offshore')),
  allocation_pct int not null default 100 check (allocation_pct between 0 and 100),
  start_sprint int not null default 1,
  email text unique
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  person_id uuid references public.people (id),
  email text not null unique,
  org text not null check (org in ('algoworks', 'customer')),
  role text not null check (role in ('pm', 'ba', 'sponsor', 'product_owner'))
);

-- Role of the signed-in user, or null for the service role / SQL editor.
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where user_id = auth.uid()
$$;

create or replace function public.is_pm() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'pm', false)
$$;

-- ---------------------------------------------------------------------------
-- PM-only finance data (cost, margin, internal rate card)
-- ---------------------------------------------------------------------------
create table public.person_costs (
  person_id uuid primary key references public.people (id) on delete cascade,
  cost_per_sprint numeric(12, 2) not null check (cost_per_sprint >= 0)
);

create table public.finance_config (
  id int primary key default 1 check (id = 1),
  margin_target_pct numeric(5, 2) not null
);

-- ---------------------------------------------------------------------------
-- Customer-visible program data
-- ---------------------------------------------------------------------------
create table public.program_config (
  id int primary key default 1 check (id = 1),
  program_name text not null,
  customer_name text not null,
  rate_per_point numeric(10, 2) not null check (rate_per_point > 0), -- contract rate, printed on invoices
  currency text not null default 'USD',
  acceptance_window_days int not null default 5
);

create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  name text not null,
  goal text,
  start_date date not null,
  end_date date not null,
  status text not null check (status in ('planned', 'active', 'closed')),
  closed_at timestamptz
);
create unique index one_active_sprint on public.sprints (status) where status = 'active';

create table public.epics (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  cloud text not null
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  epic_id uuid references public.epics (id) on delete set null,
  cloud text not null,
  type text not null check (type in ('Configuration', 'Flow', 'Apex', 'LWC', 'Integration', 'Migration', 'Testing')),
  points int not null check (points > 0),
  status text not null default 'Backlog'
    check (status in ('Backlog', 'In progress', 'Ready for acceptance', 'Accepted')),
  sprint_id uuid references public.sprints (id) on delete set null,      -- sprint the work is planned in
  accepted_sprint_id uuid references public.sprints (id) on delete set null, -- sprint it bills in
  ready_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references public.people (id),
  rejection_reason text,
  updated_at timestamptz not null default now(),
  check ((status = 'Accepted') = (accepted_sprint_id is not null))
);
create index stories_sprint_idx on public.stories (sprint_id);
create index stories_accepted_sprint_idx on public.stories (accepted_sprint_id);
create index stories_status_idx on public.stories (status);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  person_id uuid not null references public.people (id),
  share_pct numeric(5, 2) not null check (share_pct > 0 and share_pct <= 100),
  unique (story_id, person_id)
);
create index assignments_story_idx on public.assignments (story_id);

create table public.story_events (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  kind text not null check (kind in ('accepted', 'rejected')),
  reason text,
  actor_person_id uuid references public.people (id),
  sprint_id uuid references public.sprints (id) on delete set null,
  created_at timestamptz not null default now()
);
create index story_events_story_idx on public.story_events (story_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  sprint_id uuid not null unique references public.sprints (id) on delete cascade,
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Paid')),
  rate_per_point numeric(10, 2) not null,
  billable_points numeric(10, 2) not null,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  paid_at timestamptz
);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  story_id uuid references public.stories (id) on delete set null,
  story_key text not null,
  story_title text not null,
  points numeric(10, 2) not null,
  algoworks_pct numeric(5, 2) not null,
  billable_points numeric(10, 2) not null,
  amount numeric(12, 2) not null
);
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id);

create table public.raid_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('Risk', 'Issue', 'Assumption', 'Dependency')),
  title text not null,
  description text,
  severity text not null check (severity in ('Low', 'Medium', 'High', 'Critical')),
  owner text not null,
  exposure text, -- plain-language exposure, e.g. "2 sprints of integration work"
  status text not null default 'Open' check (status in ('Open', 'Mitigating', 'Closed')),
  mitigation text,
  due_date date,
  updated_at timestamptz not null default now()
);

create table public.environments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort int not null,
  current_release text,
  test_coverage_pct int check (test_coverage_pct between 0 and 100),
  open_defects int not null default 0,
  last_deploy_at timestamptz,
  health text not null check (health in ('Healthy', 'At risk', 'Blocked'))
);

create table public.releases (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  target_date date not null,
  scope text not null,
  status text not null check (status in ('Planned', 'In UAT', 'Go', 'No-go', 'Released'))
);

create table public.release_gates (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  sort int not null,
  name text not null,
  owner text not null,
  done boolean not null default false
);

create table public.planned_roles (
  id uuid primary key default gen_random_uuid(),
  org text not null check (org in ('algoworks', 'customer')),
  role_title text not null,
  region text not null check (region in ('Onshore', 'Offshore')),
  planned int not null check (planned >= 0)
);

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- Shares of a story must total 100 (checked at commit so a story can be re-split).
create or replace function public.check_assignment_shares() returns trigger
language plpgsql as $$
declare
  sid uuid := coalesce(new.story_id, old.story_id);
  total numeric;
begin
  select sum(share_pct) into total from public.assignments where story_id = sid;
  if total is not null and total <> 100 then
    raise exception 'Assignment shares for story % total %, expected 100', sid, total;
  end if;
  return null;
end $$;

create constraint trigger assignments_total_100
  after insert or update or delete on public.assignments
  deferrable initially deferred
  for each row execute function public.check_assignment_shares();

-- Story workflow. auth.uid() is null for the service role (seed), which bypasses these checks.
--  * Only a product_owner may accept (from "Ready for acceptance") or reject (back to "In progress").
--  * Acceptance stamps who/when and bills in the currently active sprint.
--  * Accepted stories are locked (they are already billable).
--  * Customers other than the product owner cannot change stories (also blocked by RLS).
create or replace function public.enforce_story_workflow() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := public.app_role();
  actor uuid;
  active_sprint uuid;
begin
  new.updated_at := now();
  if auth.uid() is null then
    return new;
  end if;
  select person_id into actor from public.profiles where user_id = auth.uid();

  if old.status = 'Accepted' then
    raise exception 'Accepted stories are locked';
  end if;

  if new.status = 'Accepted' then
    if r <> 'product_owner' then
      raise exception 'Only the customer product owner can accept stories';
    end if;
    if old.status <> 'Ready for acceptance' then
      raise exception 'Only stories ready for acceptance can be accepted';
    end if;
    select id into active_sprint from public.sprints where status = 'active';
    if active_sprint is null then
      raise exception 'No active sprint to bill the acceptance in';
    end if;
    new.accepted_sprint_id := active_sprint;
    new.accepted_at := now();
    new.accepted_by := actor;
    new.rejection_reason := null;
    insert into public.story_events (story_id, kind, actor_person_id, sprint_id)
      values (new.id, 'accepted', actor, active_sprint);
    return new;
  end if;

  if old.status = 'Ready for acceptance' and new.status = 'In progress' then
    if r <> 'product_owner' then
      raise exception 'Only the customer product owner can reject stories';
    end if;
    if coalesce(length(trim(new.rejection_reason)), 0) < 5 then
      raise exception 'A rejection needs a reason';
    end if;
    new.ready_at := null;
    insert into public.story_events (story_id, kind, reason, actor_person_id, sprint_id)
      values (new.id, 'rejected', new.rejection_reason,
              actor, (select id from public.sprints where status = 'active'));
    return new;
  end if;

  -- Any other change is delivery work: Algoworks PM/BA only. The product owner
  -- may only accept or reject, never edit points, splits or status otherwise.
  if r not in ('pm', 'ba') then
    raise exception 'Only the Algoworks delivery team can change story details';
  end if;
  if new.points <> old.points and old.status = 'Ready for acceptance' then
    raise exception 'Points cannot change while a story awaits acceptance';
  end if;
  new.accepted_sprint_id := null;
  new.accepted_at := null;
  new.accepted_by := null;
  if new.status = 'Ready for acceptance' and old.status <> 'Ready for acceptance' then
    new.ready_at := now();
  end if;
  return new;
end $$;

create trigger stories_workflow
  before update on public.stories
  for each row execute function public.enforce_story_workflow();

-- Invoice status moves forward only: Draft -> Sent -> Paid.
create or replace function public.enforce_invoice_status() returns trigger
language plpgsql as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if not ((old.status = 'Draft' and new.status = 'Sent') or (old.status = 'Sent' and new.status = 'Paid')) then
    raise exception 'Invoice status can only move Draft -> Sent -> Paid';
  end if;
  if new.status = 'Sent' then new.sent_at := coalesce(new.sent_at, now()); end if;
  if new.status = 'Paid' then new.paid_at := coalesce(new.paid_at, now()); end if;
  return new;
end $$;

create trigger invoices_status
  before update on public.invoices
  for each row execute function public.enforce_invoice_status();

-- ---------------------------------------------------------------------------
-- Row-level security: on for every table, deny by default.
-- ---------------------------------------------------------------------------
alter table public.people enable row level security;
alter table public.profiles enable row level security;
alter table public.person_costs enable row level security;
alter table public.finance_config enable row level security;
alter table public.program_config enable row level security;
alter table public.sprints enable row level security;
alter table public.epics enable row level security;
alter table public.stories enable row level security;
alter table public.assignments enable row level security;
alter table public.story_events enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.raid_items enable row level security;
alter table public.environments enable row level security;
alter table public.releases enable row level security;
alter table public.release_gates enable row level security;
alter table public.planned_roles enable row level security;

-- Readable by any signed-in user.
create policy read_all on public.people for select to authenticated using (true);
create policy read_all on public.program_config for select to authenticated using (true);
create policy read_all on public.sprints for select to authenticated using (true);
create policy read_all on public.epics for select to authenticated using (true);
create policy read_all on public.stories for select to authenticated using (true);
create policy read_all on public.assignments for select to authenticated using (true);
create policy read_all on public.story_events for select to authenticated using (true);
create policy read_all on public.raid_items for select to authenticated using (true);
create policy read_all on public.environments for select to authenticated using (true);
create policy read_all on public.releases for select to authenticated using (true);
create policy read_all on public.release_gates for select to authenticated using (true);
create policy read_all on public.planned_roles for select to authenticated using (true);

-- Profiles: your own row; the PM sees all.
create policy read_own on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_pm());

-- Invoices: the customer sees issued invoices (Sent/Paid); drafts are internal to the PM.
create policy read_invoices on public.invoices for select to authenticated
  using (status <> 'Draft' or public.is_pm());
create policy read_invoice_lines on public.invoice_lines for select to authenticated
  using (exists (select 1 from public.invoices i
                 where i.id = invoice_id and (i.status <> 'Draft' or public.is_pm())));

-- Cost, margin and internal rate card: PM only.
create policy pm_read on public.person_costs for select to authenticated using (public.is_pm());
create policy pm_read on public.finance_config for select to authenticated using (public.is_pm());

-- Writes.
create policy update_stories on public.stories for update to authenticated
  using (public.app_role() in ('pm', 'ba', 'product_owner'))
  with check (public.app_role() in ('pm', 'ba', 'product_owner'));

create policy pm_update on public.sprints for update to authenticated
  using (public.is_pm()) with check (public.is_pm());
create policy pm_insert on public.sprints for insert to authenticated with check (public.is_pm());

create policy pm_insert on public.invoices for insert to authenticated with check (public.is_pm());
create policy pm_update on public.invoices for update to authenticated
  using (public.is_pm()) with check (public.is_pm());
create policy pm_insert on public.invoice_lines for insert to authenticated with check (public.is_pm());

create policy pm_insert on public.raid_items for insert to authenticated with check (public.is_pm());
create policy pm_update on public.raid_items for update to authenticated
  using (public.is_pm()) with check (public.is_pm());

create policy pm_update on public.release_gates for update to authenticated
  using (public.is_pm()) with check (public.is_pm());

-- Table privileges (RLS above decides which rows). anon gets nothing.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Realtime: the PM dashboard listens for story acceptances.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.stories;
  end if;
end $$;
