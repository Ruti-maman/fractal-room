-- שלד מלא לשלבים 4-10 (placeholder לתוכן שעדיין לא נבנה) - לוודא שהמעבר בין
-- כל 10 השלבים עובד מקצה לקצה. stage_type/sync_gate לפי הטבלה בסעיף 5 ב-CLAUDE.md.
-- תיאורים חולצו ישירות משקפי המצגת (docs/מצגת.pptx, שקפים 6-15).
-- להריץ פעם אחת ב-SQL Editor (בטוח להריץ שוב - הוא מוחק ומייצר מחדש רק שלבים 4-10).

delete from program_stages where stage_number between 4 and 10
  and program_id = (select id from programs where name = 'תוכנית לדוגמה');

insert into program_stages (program_id, stage_number, stage_type, sync_gate, duration_minutes, content)
select id, 4, 'independent', false, 5,
  '{"description": "כאן יהיה: (1) סימון הטקסט במרקר - ירוק לחוזקות, אדום לחסמים; (2) טבלה אוטומטית שמסכמת את מה שסומן, עם כותרות פדגוגיות לכל שורה; (3) ניסוח תמונת תפקוד כוללת (עד 2 משפטים) ומסקנה מעשית בעזרת AI, שתלווה כסטריפ את כל השלבים הבאים."}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
select id, 5, 'independent', false, 5,
  '{"description": "כאן יהיו 4 כפתורי פתרון: פתרון טכני נקודתי / שינוי פדגוגי עמוק ומובנה / התעלמות מהאתגר / העברת אחריות לגורם חיצוני. לחיצה על אפשרות שגויה תפתח פופ-אפ עם הסבר ותמונה; רק השינוי הפדגוגי העמוק הוא הדרך הנכונה שממשיכה הלאה."}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
select id, 6, 'independent', false, 5,
  '{"description": "כאן יהיה זמן דיון קבוצתי מונחה, עם טיימר בצורת שעון חול ומשפט השראה על כוחו של הדיון הפתוח - בסיס מקדים לשלב הסימולציות הבא."}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
select id, 7, 'shared', true, 10,
  '{"description": "כאן יהיו הוראות לעריכת סימולציה, הקלדת הפתרון, והקלטה מול מצלמה. אחר כך - צפייה משותפת ב-3 הסרטונים של כל הקבוצות, כשכל משתתפת מקלידה את שמה ומדרגת כל סרטון באייקון כוכב."}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
select id, 8, 'shared', true, null,
  '{"description": "כאן תוכרז הקבוצה המנצחת (לפי דירוג הכוכבים משלב הסימולציות) עם גביע ניצחון ואפקט קולי."}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
select id, 9, 'independent', false, null,
  '{"description": "שלב שלא מוצג על המסך בכלל: שאלון סיכום מובנה (כמו Google Forms) שממולא מאחורי הקלעים, מיועד רק למקרה שלא נצליח לייצא את כל נתוני הסדנה. הסיכום יוצא לבנק כלים משותף."}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
select id, 10, 'shared', true, null,
  '{"description": "כאן תהיה ניסוח משותף של 3 עקרונות מנחים חדשניים, מתוך כל הידע שנצבר בסדנה, בעזרת AI. סיום התהליך - כל הנתונים נשמרים במערכת."}'::jsonb
from programs where name = 'תוכנית לדוגמה';
