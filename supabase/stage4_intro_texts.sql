-- טקסטי שלב 4 (ניתוח דילמה): מסך הפתיחה, כפתור "זום אין" והוראת הסימון, לפי התסריט של הלקוחה.
-- מתמזג לתוך content הקיים של שלב 4 (לא דורס את טקסט הפרופיל והקטגוריות).
-- לשנות נוסח: לערוך כאן ולהריץ שוב, או לערוך ישירות ב-content של program_stages.
update program_stages
set content = content || jsonb_build_object(
  'intro', jsonb_build_object(
    'lines', jsonb_build_array(
      jsonb_build_object('text', 'לפני שאתן ממהרות לפתור, קחו את הדילמה ופרקו אותה לחלקים:', 'bold', true),
      jsonb_build_object('text', 'מי התלמידה?', 'bold', true),
      jsonb_build_object('text', 'רקע קצר.'),
      jsonb_build_object('text', 'סיכוי?', 'bold', true),
      jsonb_build_object('text', 'חוזקות.'),
      jsonb_build_object('text', 'סיכון?', 'bold', true),
      jsonb_build_object('text', 'חסמים.'),
      jsonb_build_object('text', 'ומה באמת קורה כאן?', 'bold', true),
      jsonb_build_object('text', 'הדילמה.', 'bold', true),
      jsonb_build_object('text', 'המטרה:'),
      jsonb_build_object('text', 'לא לראות ״בעיה״.', 'bold', true),
      jsonb_build_object('text', 'לראות מערכת שלמה של צורות וקשרים.', 'bold', true)
    ),
    'start_label', 'ועכשיו, זום אין',
    'marking_hint', 'לנוחיותכן! הדגישו קטע רלוונטי ע״י גרירה (זה עובד ממש פשוט כמו מרקר רגיל) והמערכת תציף לכן מאגר לבחירתכן של: חוזקות | חסמים | יכולות | מונחים מקצועיים שימקדו וידייקו אתכן בניסוח ובניתוח.'
  )
)
where stage_number = 4
  and program_id = (select id from programs where name = 'תוכנית לדוגמה');
