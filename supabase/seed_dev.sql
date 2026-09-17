-- נתוני דוגמה לבדיקה בפיתוח בלבד (לא חלק מהמוצר הסופי - ראו סעיף 11 ב-CLAUDE.md).
-- להריץ פעם אחת ב-SQL Editor, אחרי schema.sql.

insert into programs (name) values ('תוכנית לדוגמה');

insert into workshops (program_id, status)
select id, 'active' from programs where name = 'תוכנית לדוגמה';

insert into groups (workshop_id, screen_number, current_stage)
select w.id, s.screen_number, 1
from workshops w
cross join (values (1), (2), (3)) as s(screen_number)
where w.status = 'active';
