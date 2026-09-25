import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  className?: string;
  onEnded?: () => void;
}

/**
 * סרטון תוכן שמתנגן **לבד, עם קול**, ברגע שהמסך נפתח.
 *
 * דפדפנים חוסמים ניגון עם קול עד שהייתה נגיעה בדף (autoplay policy), ובסדנה
 * אין מי שילחץ "נגן". לכן יש כאן שלוש שכבות, לפי הסדר:
 *
 * 1. ניסיון ניגון עם קול. אם הדפדפן מוגדר למצב קיוסק
 *    (--autoplay-policy=no-user-gesture-required) או שכבר הייתה נגיעה
 *    בסדנה (הכפתור "התחילו"), זה פשוט עובד.
 * 2. אם נחסם - הסרטון מנגן **מושתק** (זה תמיד מותר), כך שהמסך לא עומד דומם,
 *    ורצים ניסיונות חוזרים להחזיר את הקול.
 * 3. כל נגיעה על המסך, בכל מקום, מחזירה את הקול ומתחילה מחדש.
 *
 * הכלל החשוב: **לעולם לא להשאיר את הסרטון עצור**. אם הקול נחסם, ממשיכים
 * מושתק - אחרת המסך נראה תקוע.
 */
function AutoPlayVideo({ src, className, onEnded }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let timers: number[] = [];

    /** מנסה לנגן עם קול. מחזיר אם הצליח. */
    async function tryWithSound(): Promise<boolean> {
      if (!video || cancelled) return false;
      const wasMuted = video.muted;
      video.muted = false;
      video.volume = 1;
      try {
        await video.play();
        if (!cancelled) setSoundBlocked(false);
        return true;
      } catch {
        // חשוב: מחזירים את המצב הקודם וממשיכים לנגן מושתק, לא משאירים עצור
        video.muted = wasMuted || true;
        video.play().catch(() => {});
        if (!cancelled) setSoundBlocked(true);
        return false;
      }
    }

    async function start() {
      if (await tryWithSound()) return;
      // ניסיונות חוזרים: לפעמים ההרשאה נפתחת רגע אחרי טעינת המסך
      for (const delay of [400, 1200, 3000]) {
        timers.push(
          window.setTimeout(() => {
            if (!cancelled && videoRef.current?.muted) void tryWithSound();
          }, delay),
        );
      }
    }

    start();

    // כל נגיעה על המסך מחזירה את הקול ומתחילה מההתחלה
    const onPointer = async () => {
      if (!video || cancelled || !video.muted) return;
      if (await tryWithSound()) {
        video.currentTime = 0;
        document.removeEventListener("pointerdown", onPointer);
      }
    };
    document.addEventListener("pointerdown", onPointer);

    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
      timers = [];
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [src]);

  return (
    <div className="relative flex flex-col items-center gap-2">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        // רץ בלופ: המסך לא נשאר על פריים קפוא בזמן שהקבוצה עדיין צופה/מדברת
        loop
        // פס הפקדים של הדפדפן - עצירה, עוצמת קול ומסך מלא, לפי בקשת הלקוחה
        controls
        onEnded={onEnded}
        className={className}
        data-audio-blocked={soundBlocked ? "true" : undefined}
      />
      {soundBlocked && (
        <p className="text-sm font-bold text-white/50">געו במסך כדי להפעיל את הקול</p>
      )}
    </div>
  );
}

export default AutoPlayVideo;
