-- שלד לשלבים 4-10. stage_type/sync_gate לפי הטבלה בסעיף 5 ב-CLAUDE.md.
-- להריץ ב-SQL Editor (מוחק ומייצר מחדש רק שלבים 4-10).
--
-- שימו לב: הקובץ הזה מייצג את התוכן ה"אמיתי" הנוכחי (מסונכרן עם מה שרץ בפועל
-- ב-DB, נכון לרגע העדכון האחרון של כל שלב) - לא placeholder גנרי כמו שהיה
-- פעם. שלבים 5, 7, 8, 9, 10 עדיין לא נבנו בפועל (רק תיאור טקסטואלי); שלבים
-- 4 ו-6 כבר בנויים עם מנגנון אמיתי, ולכן יש להם content עם שדות אמיתיים
-- (לא description) - תעדכנו כאן כל פעם שהתוכן האמיתי משתנה, אחרת הרצה חוזרת
-- של הקובץ תדרוס בטעות תוכן אמיתי בחזרה ל-placeholder ישן.

delete from program_stages where stage_number between 4 and 10
  and program_id = (select id from programs where name = 'תוכנית לדוגמה');

insert into program_stages (program_id, stage_number, stage_type, sync_gate, duration_minutes, content)
select id, 4, 'independent', false, 5,
  '{"profile_text": "התלמיד מפגין יכולת הבעה מילולית גבוהה ומצליח להסביר את מחשבותיו בבהירות מרשימה. ניכרת אצלו מוטיבציה אישית להצלחה במשימה, והוא מגלה הבנה קוגניטיבית מהירה של החומר הנלמד. יחד עם זאת, קיים אצלו קושי משמעותי במעבר בין משימות, והוא מתקשה להסתגל לשינוי פתאומי בסדר היום. נראית אצלו גם רגישות תחושתית לרעש בסביבת הכיתה, שמקשה עליו להתרכז. הוא מגלה זיכרון חזותי מצוין לפרטים, אך נוטה להימנעות מתקשורת יזומה בעבודה קבוצתית, ולעיתים חש תסכול מהיר בעת אי-הבנה ראשונית של הוראה.", "categories": ["תקשורת ושפה", "תפקוד קוגניטיבי ולמידה", "ויסות רגשי", "תפקוד חברתי", "גמישות מחשבתית והסתגלות", "עיבוד חושי וסביבתי"]}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
select id, 5, 'independent', false, 5,
  '{"options": [
    {"label": "פתרון טכני נקודתי", "correct": false, "explanation": "אינו מטפל בשורש הבעיה הפדגוגית"},
    {"label": "שינוי פדגוגי עמוק ומובנה", "correct": true, "explanation": "זוהי הדרך הנכונה!"},
    {"label": "התעלמות מהאתגר הקיים", "correct": false, "explanation": "מוביל להחמרת הקושי בכיתה"},
    {"label": "העברת האחריות לגורם חיצוני", "correct": false, "explanation": "אינו מטפל בשורש הבעיה הפדגוגית"}
  ]}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
select id, 6, 'independent', false, 5,
  '{"quote": "הדיון הפתוח והמשותף הוא הכלי החזק ביותר של המורה בדרך לשינוי תפיסתי עמוק בקרב תלמידיו."}'::jsonb
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
-- שלב 8 = טקסט המסר ("הגענו לשלב הגמר"), שלב 9 = הכרזת המנצחת וטקסט הסיום
-- (דרישת הלקוחה, 2026-10-19). שניהם מוצגים ב-Stage8Winner (part לפי המספר).
select id, 9, 'independent', false, 10,
  '{}'::jsonb
from programs where name = 'תוכנית לדוגמה'
union all
-- עצמאי ובלי שער סנכרון (דרישת הלקוחה): מסך ההמתנה כאן היה כפילות של זה
-- שבשלב 8. כל הצוותים כבר עברו את שער שלב 8, כך שהנתונים של כולן קיימים.
select id, 10, 'independent', false, 10,
  '{}'::jsonb  -- Stage10Principles לא קורא content בכלל, העקרונות נשמרים ב-responses.
from programs where name = 'תוכנית לדוגמה';
