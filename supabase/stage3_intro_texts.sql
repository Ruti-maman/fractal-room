-- טקסטי שלב 3 (שמש אסוציאציות): מסך הפתיחה, שני הצעדים ורצועת "נבחרו", לפי האפיון של הלקוחה.
-- מתמזג לתוך content הקיים של שלב 3 (לא דורס את טקסט הדילמה).
-- לשנות נוסח: לערוך כאן ולהריץ שוב, או לערוך ישירות ב-content של program_stages.
update program_stages
set content = content || jsonb_build_object(
  'intro', jsonb_build_object(
    'lines', jsonb_build_array(
      jsonb_build_object('text', 'מצאנו את הצורה.'),
      jsonb_build_object('text', 'עכשיו — איפה היא נשברת? יש דילמה?'),
      jsonb_build_object('text', 'מצוין.'),
      jsonb_build_object('text', 'כי לפני שמשנים צורה,'),
      jsonb_build_object('text', 'צריך להבין איפה היא לא עובדת.', 'bold', true),
      jsonb_build_object('text', 'כתבו כל מה שעולה לכן עכשיו בראש,'),
      jsonb_build_object('text', 'אחת שתיים שלוש ו -', 'bold', true),
      jsonb_build_object('text', 'רעיון / שאלה / תחושה / כיוון.'),
      jsonb_build_object('text', 'בשלב הזה לא מסדרים את המחשבות,'),
      jsonb_build_object('text', 'כאן נותנים להן לצאת.')
    ),
    'start_label', 'התחלנו',
    'step1', 'השלימו את כיווני המחשבה סביב השמש,',
    'step2', 'לאחר מכן לחצו על ארבעה כיוונים נבחרים שיוכלו לסייע לכן בהמשך המחקר',
    'strip_hint', 'לחצו על כיוון מחשבה כדי שתיבחר',
    'swipe_hint', 'גררו את המסך ימינה או שמאלה כדי להמשיך'
  )
)
where stage_number = 3
  and program_id = (select id from programs where name = 'תוכנית לדוגמה');
