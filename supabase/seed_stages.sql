-- שלבי דוגמה לבדיקת מנוע השלבים בלבד (לא חלק מהמוצר הסופי - ראו סעיף 11 ב-CLAUDE.md).
-- להריץ פעם אחת, אחרי seed_dev.sql.

insert into program_stages (program_id, stage_number, stage_type, sync_gate, content)
select id, 1, 'parallel', false, '{}'::jsonb from programs where name = 'תוכנית לדוגמה'
union all
select id, 2, 'shared', true, '{}'::jsonb from programs where name = 'תוכנית לדוגמה'
union all
select id, 3, 'independent', false, '{}'::jsonb from programs where name = 'תוכנית לדוגמה';
