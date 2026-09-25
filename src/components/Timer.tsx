import { useEffect, useRef, useState } from "react";

interface Props {
  startedAt: string;
  durationMinutes: number;
  /** נקראת פעם אחת כשנגמר הזמן - המסך עובר לשלב הבא לבד (תשובת הלקוחה). */
  onTimeUp?: () => void;
  /** ספירה בלי תצוגה - למסך הפתיחה, שבו לא מציגים טיימר אבל הוא כן מעביר. */
  hidden?: boolean;
}

/**
 * אין ספירה לאחור מקומית - הטיימר תמיד מחשב מחדש מהשעה האמיתית מול זמן ההתחלה
 * שנשמר במסד הנתונים (סעיף 5 ב-CLAUDE.md). כך רענון מסך לא משבש את הזמן שנותר.
 */
function Timer({ startedAt, durationMinutes, onTimeUp, hidden }: Props) {
  const [now, setNow] = useState(() => Date.now());
  // כדי שהמעבר האוטומטי יקרה פעם אחת בלבד לכל שלב, גם אם הרכיב מתרנדר שוב
  const firedForRef = useRef<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedMs = now - new Date(startedAt).getTime();
  const totalMs = durationMinutes * 60_000;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const isTimeUp = remainingMs <= 0;

  useEffect(() => {
    if (!isTimeUp || !onTimeUp) return;
    if (firedForRef.current === startedAt) return;
    firedForRef.current = startedAt;
    onTimeUp();
  }, [isTimeUp, onTimeUp, startedAt]);

  if (hidden) return null;

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");

  return (
    <div
      className={`fixed bottom-6 right-6 rounded-xl px-5 py-3 text-2xl font-bold ${
        isTimeUp ? "bg-accent-red" : "bg-white/10"
      }`}
    >
      {mm}:{ss}
    </div>
  );
}

export default Timer;
