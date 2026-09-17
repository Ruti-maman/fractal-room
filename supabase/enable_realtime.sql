-- מפעיל שידור בזמן אמת (Realtime) על טבלת הקבוצות, כדי שכל מסך יקבל עדכון
-- מיידי כששלב/שם של קבוצה כלשהי משתנה. להריץ פעם אחת ב-SQL Editor.
alter publication supabase_realtime add table groups;
