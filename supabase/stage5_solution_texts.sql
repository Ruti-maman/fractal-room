-- טקסטי שלב 5 (גיבוש פתרונות) לפי התסריט של הלקוחה: שורות הפתיחה, הכותרת,
-- וארבע האפשרויות בסדר החדש (א טכני, ב התעלמות, ג העברת אחריות, ד שינוי פדגוגי).
-- הכותרת של כל אפשרות כתובה על כפתור הבחירה, והטקסט הרץ (explanation_lines) מופיע בפופ-אפ.
-- דורס את content של שלב 5 כולו (אין בו שדות אחרים).
-- לשנות נוסח: לערוך כאן ולהריץ שוב, או לערוך ישירות ב-content של program_stages.
update program_stages
set content = jsonb_build_object(
  'intro_lines', jsonb_build_array('יש בעיה.', 'יש תמונת מצב.', 'עכשיו צריך שינוי.'),
  'title', 'אבל רגע, איזה שינוי?',
  'options', jsonb_build_array(
    jsonb_build_object(
      'label', 'פתרון טכני נקודתי',
      'correct', false,
      'explanation', 'פתרנו את הרגע. לא את האתגר :(',
      'explanation_lines', jsonb_build_array(
        jsonb_build_object('text', '"בואו נשים פלסטר ונקווה שהבעיה תתרשם."'),
        jsonb_build_object('text', 'פתרנו את הרגע. לא את האתגר :(', 'bold', true)
      )
    ),
    jsonb_build_object(
      'label', 'התעלמות מהאתגר הקיים',
      'correct', false,
      'explanation', 'אסטרטגיה נועזת. פחות מומלצת פדגוגית :)',
      'explanation_lines', jsonb_build_array(
        jsonb_build_object('text', '"אולי אם לא נדבר על זה — זה ייעלם."'),
        jsonb_build_object('text', 'אסטרטגיה נועזת. פחות מומלצת פדגוגית :)', 'bold', true)
      )
    ),
    jsonb_build_object(
      'label', 'העברת אחריות לגורם חיצוני',
      'correct', false,
      'explanation', 'עכשיו רק נשאר למצוא מי אחראי לזה שמישהו אחר אחראי :(',
      'explanation_lines', jsonb_build_array(
        jsonb_build_object('text', '"זה כבר בטיפול של מישהו אחר."'),
        jsonb_build_object('text', 'מעולה.'),
        jsonb_build_object('text', 'עכשיו רק נשאר למצוא מי אחראי לזה שמישהו אחר אחראי :(', 'bold', true)
      )
    ),
    jsonb_build_object(
      'label', 'שינוי פדגוגי עמוק ומובנה',
      'correct', true,
      'explanation', 'אנחנו משנות את הצורניות.',
      'explanation_lines', jsonb_build_array(
        jsonb_build_object('text', 'לא עוד פלסטר.'),
        jsonb_build_object('text', 'לא עוד אלתור.'),
        jsonb_build_object('text', 'ולא עוד ניסיון לגרום לתלמידה להתאים את עצמה לדפוס שלא עובד.'),
        jsonb_build_object('text', 'אנחנו משנות את הצורניות.', 'bold', true),
        jsonb_build_object('text', 'כמורות לעתיד, האחריות שלנו היא לא למצוא מי אחר יכול לפתור את הבעיה,'),
        jsonb_build_object('text', 'אלא לשאול: מה אנחנו יכולות לשנות?', 'bold', true),
        jsonb_build_object('text', 'לא לשנות את התלמידה כדי שתתאים למערכת.', 'bold', true),
        jsonb_build_object('text', 'לשנות משהו במערכת כדי לאפשר לתלמידה להצליח.', 'bold', true),
        jsonb_build_object('text', 'כי שינוי אמיתי לא מעביר את הכדור,', 'bold', true),
        jsonb_build_object('text', 'הוא משנה את המשחק.', 'bold', true)
      )
    )
  )
)
where stage_number = 5
  and program_id = (select id from programs where name = 'תוכנית לדוגמה');
