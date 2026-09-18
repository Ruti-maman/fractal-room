-- מפעיל Realtime על טבלת responses, כדי שהשראות שלב 3 יתעדכנו מיד בכל המסכים
-- (לא רק דרך רשת הביטחון). להריץ פעם אחת.
alter publication supabase_realtime add table responses;
