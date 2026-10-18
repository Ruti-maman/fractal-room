-- טקסטי שלב 2: מסע ההזדהות (I / II / III / סיכום) ומסך "מי בחדר", לפי האפיון של הלקוחה.
-- ("הגדלנו זום" לא טקסט - הוא מיושם: כתב גדול בשלב + צלילת הזום בכניסה, ZoomIntro.tsx)
-- מתמזג לתוך content הקיים של שלב 2 (לא דורס את סרטון הדילמה).
-- לשנות נוסח: לערוך כאן ולהריץ שוב, או לערוך ישירות ב-content של program_stages.
update program_stages
set content = content || jsonb_build_object(
  'room', jsonb_build_object(
    'intro', 'התחברנו לחלקים. עכשיו רואים את התמונה.',
    'journey_title', 'איפה אנחנו במסע:',
    'after_line', 'כל קבוצה היא צורה אחרת. עכשיו נראה',
    'after_bold', 'איזו צורה תצליח לעשות שינוי בדפוס.',
    'waiting', 'המערכת ממתינה לכל הצוותים'
  ),
  'identification', jsonb_build_object(
    'shape_line', 'עכשיו משנים צורה, שמים את הפרקטל על השולחן',
    'tables_title', 'התחלקנה לשולחנות עבודה',
    'participants_title', 'הזינו את פרטי המשתתפות',
    'name_title', 'בחרנה שם מקורי, קצר ומייצג לקבוצה',
    'name_bonus', 'וצברו עליו ניקוד נוסף',
    'tips_title', 'איך יוצרים שם שלא נשכח?',
    'tips', jsonb_build_array(
      jsonb_build_object('title', 'קצר', 'text', 'מעט מילים, הרבה אופי.'),
      jsonb_build_object('title', 'קליט', 'text', 'נכנס לראש ונשאר שם.'),
      jsonb_build_object('title', 'שלכן', 'text', 'משקף משהו מהצורה, מהאופי או מהרעיון שלכן.'),
      jsonb_build_object('title', 'עם טוויסט', 'text', 'חיבור מפתיע, משחק מילים, קריצה.'),
      jsonb_build_object('title', 'בלי הוראות הפעלה', 'text', 'אם צריך להסביר אותו, הוא עוד לא מוכן.')
    ),
    'summary_title', 'זו הקבוצה שלנו',
    'fractal_title', 'כלל הפרקטל',
    'fractal_text', 'חלק קטן, אבל כבר רואים בו את השלם.'
  )
)
where stage_number = 2
  and program_id = (select id from programs where name = 'תוכנית לדוגמה');
