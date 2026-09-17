-- מבנה הנתונים של חדר פרקטל, לפי סעיף 6 ב-CLAUDE.md.
-- להריץ פעם אחת ב-Supabase Dashboard: SQL Editor -> New query -> להדביק את כל הקובץ -> Run.

create table programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  created_at timestamptz not null default now()
);

create table program_stages (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  stage_number int not null,
  stage_type text not null check (stage_type in ('independent', 'parallel', 'shared')),
  duration_minutes int,
  sync_gate boolean not null default false,
  content jsonb not null default '{}'::jsonb,
  unique (program_id, stage_number)
);

create table workshops (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  status text not null default 'active' check (status in ('active', 'finished')),
  created_at timestamptz not null default now(),
  shared_stage_started_at timestamptz
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  screen_number int not null check (screen_number between 1 and 3),
  name text,
  current_stage int not null default 1,
  stage_started_at timestamptz not null default now(),
  unique (workshop_id, screen_number)
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table responses (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  stage_number int not null,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table media (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  stage_number int not null,
  url text not null,
  created_at timestamptz not null default now()
);

-- RLS: המסכים פונים ישירות ל-Supabase עם מפתח ה-publishable (ציבורי מטבעו),
-- ואין מנגנון התחברות/משתמשות בפרויקט הזה (ראו סעיף 5 - "מקור אמת אחד").
-- לכן מדיניות ה-RLS כאן פתוחה לקריאה/כתיבה לכל מי שמחזיק את המפתח הציבורי,
-- בדיוק כמו שהאפליקציה עצמה עובדת. אין הרשאות שונות בין קבוצה לקבוצה.
alter table programs enable row level security;
alter table program_stages enable row level security;
alter table workshops enable row level security;
alter table groups enable row level security;
alter table participants enable row level security;
alter table responses enable row level security;
alter table media enable row level security;

create policy "public read/write" on programs for all using (true) with check (true);
create policy "public read/write" on program_stages for all using (true) with check (true);
create policy "public read/write" on workshops for all using (true) with check (true);
create policy "public read/write" on groups for all using (true) with check (true);
create policy "public read/write" on participants for all using (true) with check (true);
create policy "public read/write" on responses for all using (true) with check (true);
create policy "public read/write" on media for all using (true) with check (true);
