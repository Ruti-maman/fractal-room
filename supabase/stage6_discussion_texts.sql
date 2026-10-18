-- טקסטי שלב 6 (דיון קבוצתי מונחה) לפי התסריט של הלקוחה: כרטיס הפתיחה,
-- חמשת הטיפים לדיון טוב (בחלוניות), כלל הפרקטל, וטיימר דיון של 10 דקות.
-- דורס את content של שלב 6 (משפט ההשראה הישן לא מוצג יותר).
--
-- משך השלב עולה ל-20 דקות: טיימר הדיון (10 דק') רץ בנוסף לטיימר השלב,
-- וטיימר השלב מעביר לשלב 7 בסופו - אם הוא היה קצר מהדיון, הקבוצה הייתה
-- נזרקת לשלב הבא באמצע הדיון. לשנות לפי מה שהלקוחה תחליט.
--
-- לשנות נוסח: לערוך כאן ולהריץ שוב, או לערוך ישירות ב-content של program_stages.
update program_stages
set duration_minutes = 20,
    content = jsonb_build_object(
  'intro_lines', jsonb_build_array(
    jsonb_build_object('text', 'אז מה אנחנו יכולות לשנות — כדי שמשהו טוב יותר יוכל לקרות?', 'bold', true),
    jsonb_build_object('text', 'יש לכן 10 דקות', 'bold', true),
    jsonb_build_object('text', 'תוצר אחד ברור:'),
    jsonb_build_object('text', 'כיוון לשינוי פדגוגי עמוק ומובנה', 'bold', true),
    jsonb_build_object('text', 'שמתייחס לדפוס שזיהיתן — ולא רק לסימפטום.')
  ),
  'start_label', 'בואו נדבר על זה',
  'tips_title', 'טיפים לדיון טוב',
  'tips', jsonb_build_array(
    jsonb_build_object('title', 'קודם מבינות. אחר כך פותרות.', 'text', 'אל תקפצו לפתרון בדקה הראשונה.'),
    jsonb_build_object('title', 'תתווכחו עם הרעיון, לא עם מי שהציעה אותו.', 'text', 'רעיון טוב שורד כמה שאלות קשות.'),
    jsonb_build_object('title', 'חפשו את נקודת המינוף.', 'text', 'מה שינוי קטן יחסית שיכול לייצר שינוי גדול?'),
    jsonb_build_object('title', 'אל תסתפקו ב"צריך".', 'text', '"צריך לתת יותר יחס" זה לא פתרון. מה בדיוק עושים אחרת?'),
    jsonb_build_object('title', 'אם כולן מסכימות מיד — תעצרו.', 'text', 'כנראה עוד לא עשיתן מספיק זום.')
  ),
  'fractal_title', 'כלל הפרקטל',
  'fractal_text', 'תשובה טובה לא סוגרת את הדיון. היא פותחת עוד שכבה.',
  'discussion_minutes', 10,
  'discussion_label', 'זמן לעריכת הדיון'
)
where stage_number = 6
  and program_id = (select id from programs where name = 'תוכנית לדוגמה');
