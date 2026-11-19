/*
 * ============================================================================
 *  שעון חול - טיימר הדיון בשלב 6 (בקשת המפתחת 2026-11-15)
 * ============================================================================
 *
 *  במקום טבעת ספירה לאחור: שעון חול מצויר בקו דק, שהחול שלו (אדום-כתום)
 *  יורד במשך **דקה אחת**, ובסוף כל דקה הוא **מתהפך** - כך עשר פעמים לאורך
 *  עשר דקות הדיון. מתחתיו: הזמן שנותר בספרות, ועשרה ריבועים קטנים שמתמלאים
 *  בכל דקה שעברה.
 *
 *  הזמן מחושב מ-startedAt (כמו Timer) - אין ספירה מקומית, ורענון מחזיר את
 *  השעון בדיוק לאותה נקודה בדקה.
 *
 *  ההיפוך: בסוף דקה החול נמצא כולו למטה. ברגע המעבר מציירים אותו שוב כולו
 *  למעלה, אבל מסובבים את השעון מ-180° ל-360° - כך שבתחילת הסיבוב הוא נראה
 *  בדיוק כמו רגע לפני (החול "למטה"), ובסופו החול למעלה. היפוך אמיתי, בלי קפיצה.
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  startedAt: string;
  durationMinutes: number;
  label?: string;
}

const MINUTE_MS = 60_000;

/* גאומטריית הזכוכית (viewBox 140x190): שתי בועות רחבות, ואחר כך מעט רזות יותר (בקשת
   המפתחת 2026-11-15) שנפגשות בצוואר ב-y=95 */
const TOP_BULB = "M25 18 L115 18 C115 60 77 80 72.5 95 L67.5 95 C63 80 25 60 25 18 Z";
const BOTTOM_BULB = "M67.5 95 L72.5 95 C77 110 115 130 115 172 L25 172 C25 130 63 110 67.5 95 Z";

function Hourglass({ startedAt, durationMinutes, label }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  // בזמן שעון החול סולם ההשראות מוסתר (בקשת המפתחת 2026-11-16) - הסולם
  // מוזרק מחוץ למסך הזה, ולכן הסימון על <html> (stage-scenes.css)
  useEffect(() => {
    document.documentElement.setAttribute("data-hourglass", "");
    return () => document.documentElement.removeAttribute("data-hourglass");
  }, []);

  const totalMs = durationMinutes * MINUTE_MS;
  const elapsed = Math.min(Math.max(0, now - new Date(startedAt).getTime()), totalMs);
  const done = elapsed >= totalMs;
  const minute = done ? durationMinutes - 1 : Math.floor(elapsed / MINUTE_MS);
  // כמה מהחול כבר ירד בדקה הנוכחית (0 עד 1)
  const f = done ? 1 : (elapsed % MINUTE_MS) / MINUTE_MS;

  // היפוך - בכל פעם שהדקה מתחלפת (לא בטעינה הראשונה)
  const lastMinuteRef = useRef<number | null>(null);
  const [flipKey, setFlipKey] = useState(0);
  useEffect(() => {
    if (lastMinuteRef.current !== null && minute !== lastMinuteRef.current) {
      setFlipKey((k) => k + 1);
    }
    lastMinuteRef.current = minute;
  }, [minute]);

  const remaining = Math.ceil((totalMs - elapsed) / 1000);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  // מפלס החול: למעלה מתרוקן מהצוואר כלפי מעלה, למטה נערם מהרצפה
  const topLevel = 95 - 70 * (1 - f); // y של פני החול בבועה העליונה
  const bottomLevel = 172 - 70 * f; // y של ראש הערימה בבועה התחתונה
  const flowing = !done && f > 0.002 && f < 0.998;

  return (
    <div className="hg" role="timer" aria-label={`${label ?? ""} ${mm}:${ss}`}>
      <div key={flipKey} className={flipKey > 0 ? "hg__glass hg__glass--flip" : "hg__glass"}>
        <svg viewBox="0 0 140 190" aria-hidden="true">
          <defs>
            <clipPath id="hg-top">
              <path d={TOP_BULB} />
            </clipPath>
            <clipPath id="hg-bottom">
              <path d={BOTTOM_BULB} />
            </clipPath>
          </defs>

          {/* גוון זכוכית עדין מאחורי החול - נותן לשעון נפח */}
          <path className="hg__tint" d={TOP_BULB} />
          <path className="hg__tint" d={BOTTOM_BULB} />

          {/* החול */}
          <g className="hg__sand">
            <rect x="0" y={topLevel} width="140" height={95 - topLevel + 1} clipPath="url(#hg-top)" />
            <rect x="0" y={bottomLevel} width="140" height={172 - bottomLevel} clipPath="url(#hg-bottom)" />
            {flowing && <line className="hg__stream" x1="70" y1="94" x2="70" y2={bottomLevel} />}
          </g>

          {/* הזכוכית - קו דק */}
          <path className="hg__line" d={TOP_BULB} />
          <path className="hg__line" d={BOTTOM_BULB} />

          {/* המסגרת: לוחות למעלה ולמטה בלבד (העמודים הוסרו - בקשת המפתחת) */}
          <rect className="hg__plate" x="13" y="6" width="114" height="12" />
          <rect className="hg__plate" x="13" y="172" width="114" height="12" />
        </svg>
      </div>

      <div className="hg__time" aria-hidden="true">
        {mm}:{ss}
      </div>
      {label && <div className="hg__label">{label}</div>}

      {/* דקה = ריבוע. מתמלא כשהדקה עברה, והנוכחית מהבהבת */}
      <ol className="hg__minutes" aria-hidden="true">
        {Array.from({ length: durationMinutes }, (_, i) => (
          <li key={i} className={i < minute || done ? "is-done" : i === minute ? "is-now" : undefined} />
        ))}
      </ol>
    </div>
  );
}

export default Hourglass;
