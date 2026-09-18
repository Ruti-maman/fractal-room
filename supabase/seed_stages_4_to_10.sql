-- שלד מלא לשלבים 4-10 (placeholder לתוכן שעדיין לא נבנה) - לוודא שהמעבר בין
-- כל 10 השלבים עובד מקצה לקצה. stage_type/sync_gate לפי הטבלה בסעיף 5 ב-CLAUDE.md.
-- להריץ פעם אחת ב-SQL Editor.

delete from program_stages where stage_number between 4 and 10
  and program_id = (select id from programs where name = 'תוכנית לדוגמה');

insert into program_stages (program_id, stage_number, stage_type, sync_gate, duration_minutes, content)
select id, 4, 'independent', false, 5,
  '{"description": "כאן יהיה סימון בעיטור (מרקר) של חוזקות/חסמים בטקסט, טבלת סנכרון אוטומטית, ותמונת תפקוד שנוצרת ב-AI."}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
select id, 5, 'independent', false, 5,
  '{"description": "כאן יהיו 4 כפתורי בחירת פתרון, עם פופ-אפ הסבר לכפתורים הלא-נכונים."}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
select id, 6, 'independent', false, 5,
  '{"description": "כאן יהיה זמן דיון קבוצתי מונחה, עם משפט השראה על כוח הדיון."}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
select id, 7, 'shared', true, 10,
  '{"description": "כאן תהיה הקלטת סימולציה מול מצלמה, ואז צפייה משותפת ב-3 הסרטונים של כל הקבוצות."}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
select id, 8, 'shared', true, null,
  '{"description": "כאן תהיה הצבעה שיתופית ודירוג בכוכבים, עם הכרזת הקבוצה המנצחת ואפקט קולי."}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
select id, 9, 'independent', false, null,
  '{"description": "שלב אופציונלי: שאלון סיכום שממולא מאחורי הקלעים (לא מוצג על המסך) - רק אם לא נצליח לייצא את כל הסדנה."}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
select id, 10, 'shared', true, null,
  '{"description": "כאן תהיה ניסוח משותף של 3 עקרונות מנחים בעזרת AI, וסיום הסדנה עם שמירת כל הנתונים."}'::jsonb
from programs where name = 'תוכנית לדוגמה';
