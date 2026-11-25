import { useEffect, useState } from "react";
import type { RoomLoopRow } from "../types/roomLoop";

/** בלי step (סיום הסדנה, אין מי שנוגע) - השקפים עוברים לבד כל כך הרבה שניות */
const AUTO_SLIDE_SECONDS = 9;

/*
 * לופ שהלקוחה הוסיפה ב-/admin (2026-11-25), כפי שהוא מוצג בדף הלופים (מסך
 * העשרה וידע). אותה שפה כמו הלופים המקוריים (RoomLoop): כותרת עם ריבוע אדום
 * בפינה, רשת קווים, פס התקדמות - ובצבע שנבחר:
 *   כחול  - כמו שקף תשובה (rl-page--answer)
 *   כתום  - כמו שקף "ועכשיו אצלכן" (rl-page--now)
 *   לבן   - כמו שקף חידה (הנייר הבהיר)
 * לופ ידני: שקף טקסט אחד בכל פעם, לפי step (כל נגיעה = הבא). לופ סרטון: הסרטון
 * מתנגן בלולאה, מושתק (המסך הגדול בלי קול).
 */
const PAGE_BY_COLOR = {
  blue: "rl-page--answer",
  orange: "rl-page--now",
  white: "rl-page--riddle",
} as const;

function CustomRoomLoop({ loop, step }: { loop: RoomLoopRow; step?: number }) {
  const page = PAGE_BY_COLOR[loop.color] ?? PAGE_BY_COLOR.blue;
  const slides = loop.slides ?? [];
  const n = slides.length;
  const [auto, setAuto] = useState(0);
  useEffect(() => {
    if (step !== undefined || n < 2) return;
    const t = window.setInterval(() => setAuto((a) => a + 1), AUTO_SLIDE_SECONDS * 1000);
    return () => window.clearInterval(t);
  }, [step, n]);
  const at = step ?? auto;
  const index = n > 0 ? ((at % n) + n) % n : 0;

  return (
    <main className={`rl-page ${page} cl-page`} dir="rtl">
      <div className="rl-grid" aria-hidden="true" />
      <header className="rl-title">
        <span className="rl-title__sq" aria-hidden="true" />
        {loop.title}
      </header>

      {loop.kind === "video" ? (
        <div className="cl-video">
          {loop.video_url ? (
            <video src={loop.video_url} autoPlay muted loop playsInline />
          ) : (
            <p className="rl-text">אין סרטון</p>
          )}
        </div>
      ) : (
        <>
          <div key={index} className="rl-slide">
            <p className="rl-text cl-text">{slides[index]?.text ?? ""}</p>
          </div>
          <div className="rl-progress" aria-hidden="true">
            <span style={{ width: `${n > 0 ? ((index + 1) / n) * 100 : 0}%` }} />
          </div>
        </>
      )}
    </main>
  );
}

export default CustomRoomLoop;
