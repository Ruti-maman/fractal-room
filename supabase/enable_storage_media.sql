-- יוצר bucket ציבורי לאחסון סרטוני הסימולציה של שלב 7, עם אותה מדיניות פתוחה
-- שכבר קיימת בשאר הטבלאות (ראו סעיף 6 ב-CLAUDE.md - החלטת גישה פתוחה שאושרה).
-- להריץ פעם אחת ב-SQL Editor.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media public read" on storage.objects
  for select using (bucket_id = 'media');

create policy "media public insert" on storage.objects
  for insert with check (bucket_id = 'media');
