-- שלב 1 הוא תוכן אמיתי (עם placeholder לוידאו, עד שיגיע קובץ אמיתי מהלקוחה).
-- שלבים 2-3 עדיין רק לבדיקת מנוע השלבים (לא חלק מהמוצר הסופי - ראו סעיף 11 ב-CLAUDE.md).
-- להריץ פעם אחת, אחרי seed_dev.sql.

insert into program_stages (program_id, stage_number, stage_type, sync_gate, content)
select id, 1, 'parallel', false, '{
  "screens": {
    "1": { "type": "logo", "image_url": "" },
    "2": { "type": "video", "video_url": "" },
    "3": { "type": "text", "title": "ברוכות הבאות לחדר פרקטל", "body": "כל קבוצה תעבור מסע של גילוי, ניתוח ופתרון יצירתי לדילמה פדגוגית." }
  },
  "transition_text": "מתחילים את המסע..."
}'::jsonb from programs where name = 'תוכנית לדוגמה'
union all
select id, 2, 'shared', true, '{}'::jsonb from programs where name = 'תוכנית לדוגמה'
union all
select id, 3, 'independent', false, '{}'::jsonb from programs where name = 'תוכנית לדוגמה';
