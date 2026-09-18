-- שלבים 1-3 הם תוכן אמיתי (עם placeholder לוידאו/לוגו, עד שיגיעו קבצים אמיתיים מהלקוחה).
-- לפי המצגת (docs/מצגת.pptx): שלבים 1-3 כולם 5 דקות.
-- להריץ פעם אחת, אחרי seed_dev.sql.

insert into program_stages (program_id, stage_number, stage_type, sync_gate, duration_minutes, content)
select id, 1, 'parallel', false, 5, '{
  "screens": {
    "1": { "type": "logo", "image_url": "" },
    "2": { "type": "video", "video_url": "" },
    "3": { "type": "text", "title": "ברוכות הבאות לחדר פרקטל", "body": "כל קבוצה תעבור מסע של גילוי, ניתוח ופתרון יצירתי לדילמה פדגוגית." }
  },
  "transition_text": "מתחילים את המסע..."
}'::jsonb from programs where name = 'תוכנית לדוגמה'
union all
select id, 2, 'shared', true, 5, '{}'::jsonb from programs where name = 'תוכנית לדוגמה'
union all
select id, 3, 'independent', false, 5, '{
  "dilemma_text": "דילמה: איך מלמדים כיתה מגוונת כשלכל תלמידה קצב שונה?",
  "transition_text": "מהשראות למעשה..."
}'::jsonb from programs where name = 'תוכנית לדוגמה';
