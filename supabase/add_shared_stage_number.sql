-- מתקן באג: shared_stage_started_at היה משותף לכל השלבים המשותפים (2, 7, 8, 10),
-- כך שלב מאוחר "ירש" זמן התחלה ישן משלב קודם. עמודה זו אומרת לאיזה שלב שייך
-- הזמן השמור, כדי שכל שלב משותף יקבל זמן התחלה טרי משלו.
-- להריץ פעם אחת ב-SQL Editor.

alter table workshops add column if not exists shared_stage_number int;
