-- ============================================================================
-- לופים נוספים למסך הגדול (2026-11-25, דרישת הלקוחה: "כפתור הוספת לופ עם
-- אפשרות ללופ ידני או סרטון", "בחירת צבע כתום, כחול או לבן").
--
-- הלופים המקוריים ("פרקטל וזה קהל" וכו') נשארים בקוד (src/lib/roomLoops.ts),
-- כי יש להם איורים ותנועה מיוחדים לכל שקף. כאן נשמרים רק לופים שהלקוחה
-- מוסיפה בעצמה ב-/admin, והם מופיעים בדף הלופים (מסך העשרה וידע).
--
--   kind   'manual' - שקפים של טקסט (slides: מערך של {text}), עוברים בנגיעה
--          'video'  - סרטון אחד (video_url, ב-Storage תחת media/loops/)
--   color  'orange' / 'blue' / 'white' - צבע הריבוע והשקפים
-- ============================================================================

create table if not exists room_loops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null check (kind in ('manual', 'video')),
  color text not null default 'blue' check (color in ('orange', 'blue', 'white')),
  slides jsonb not null default '[]'::jsonb,
  video_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table room_loops enable row level security;

-- כמו שאר הטבלאות בפרויקט: אין התחברות, המסכים והמסך הניהולי פתוחים
drop policy if exists "public read/write" on room_loops;
create policy "public read/write" on room_loops for all using (true) with check (true);
