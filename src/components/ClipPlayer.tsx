import { useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";

/** 0:07 - פורמט הזמן המוכר מנגני וידאו. */
export function fmtTime(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * כפתור עגול בסרגל הנגן. מוגדר פעם אחת כדי שכל הכפתורים - גם במסך ההקלטה
 * וגם במסך הצפייה - יתנהגו וייראו אותו דבר: מצב "דלוק" מסומן ברקע בהיר וקו
 * תחתון, כמו ה-CC ביוטיוב, ובגודל שמתאים לאצבע על מסך מגע גדול (סעיף 2
 * ב-CLAUDE.md).
 */
export function PlayerButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex h-14 w-14 items-center justify-center rounded-full text-white transition-colors duration-150 active:scale-90 disabled:opacity-40 ${
        active ? "bg-white/20" : "hover:bg-white/12"
      }`}
    >
      {children}
      {active && <span className="absolute bottom-2 h-[3px] w-6 rounded-full bg-white" />}
    </button>
  );
}

/**
 * נגן צפייה בהקלטה - אותה שפה חזותית בדיוק של סרגל ההקלטה: פס אדום, כפתור
 * עגול משמאל, וכפתורי קול/כיתוב/מסך מלא מימין. רכיב נפרד כי הוא מופיע שלוש
 * פעמים במסך אחד (הקלטה לכל קבוצה), וכל מופע מנהל את הקול והזמן של עצמו.
 *
 * "מסך מלא" הוא הגדלה ב-CSS (fixed inset-0) ולא Fullscreen API - הדף כבר
 * במסך מלא ממצב הקיוסק, ובקשה מקוננת עלולה להוציא אותו ממנו בדפדפני אנדרואיד
 * ישנים (סעיף 2 ב-CLAUDE.md).
 */
function ClipPlayer({ src, caption, title }: { src: string; caption?: string; title?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showCaption, setShowCaption] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ended, setEnded] = useState(false);

  // קובץ שנוצר ב-MediaRecorder מגיע בלי אורך בכותרת (duration = Infinity),
  // ואז פס ההתקדמות לא יודע לאן להתקדם. הטריק המקובל: לקפוץ לזמן ענק, מה
  // שמכריח את הדפדפן לחשב את האורך האמיתי, ואז לחזור להתחלה.
  function handleMetadata() {
    const v = videoRef.current;
    if (!v) return;
    if (v.duration === Infinity || Number.isNaN(v.duration)) {
      v.currentTime = 1e101;
      const onSeeked = () => {
        v.currentTime = 0;
        setDuration(v.duration);
        v.removeEventListener("seeked", onSeeked);
      };
      v.addEventListener("seeked", onSeeked);
    } else {
      setDuration(v.duration);
    }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      // ברירת מחדל: עם קול. הצפייה המשותפת היא כל הפואנטה של השלב.
      v.muted = false;
      v.volume = 1;
      setMuted(false);
      v.play().catch(() => setFailed(true));
    } else {
      v.pause();
    }
  }

  /** ניגון מהתחלה - גם באמצע הסרטון וגם אחרי שנגמר. */
  function restart() {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    v.volume = 1;
    setMuted(false);
    setEnded(false);
    v.play().catch(() => setFailed(true));
  }

  function seekTo(e: MouseEvent<HTMLDivElement>) {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  // יציאה ממסך מלא גם במקש Escape, לא רק בכפתור.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (failed) {
    return (
      <div className="flex h-48 w-full flex-col items-center justify-center gap-1 rounded-xl bg-black/40 px-3 text-center">
        <p className="text-sm font-bold text-[#ff9bae]">הסרטון לא נטען</p>
        <p className="text-xs text-white/50">ההקלטה נשמרה, אבל הדפדפן לא הצליח להוריד אותה</p>
      </div>
    );
  }

  const progress = duration > 0 ? current / duration : 0;

  return (
    <div
      className={`overflow-hidden border border-white/10 bg-black shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] ${
        expanded ? "fixed inset-0 z-50 rounded-none" : "relative rounded-2xl"
      }`}
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        onLoadedMetadata={handleMetadata}
        onTimeUpdate={() => setCurrent(videoRef.current?.currentTime ?? 0)}
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
        }}
        onError={() => setFailed(true)}
        onClick={togglePlay}
        className={expanded ? "h-full w-full object-contain" : "h-48 w-full object-cover"}
      />

      {/* כפתור הפעלה גדול במרכז כל עוד לא מנגן - הזמנה ברורה ללחוץ */}
      {!playing && (
        <button
          type="button"
          aria-label={ended ? "לצפייה מהתחלה" : "נגני"}
          onClick={ended ? restart : togglePlay}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-black/55 text-white transition-transform duration-150 hover:scale-105">
            {ended ? (
              <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-10 w-10 translate-x-0.5" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </span>
          {ended && <span className="rounded-full bg-black/55 px-4 py-1 text-sm font-bold text-white">לצפייה מהתחלה</span>}
        </button>
      )}

      {showCaption && caption && caption.trim() !== "" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-6">
          <p className="max-w-[92%] rounded-lg bg-black/80 px-4 py-2 text-center text-base leading-snug font-bold text-white">
            {caption}
          </p>
        </div>
      )}

      {/* סרגל השליטה - dir="ltr" בכוונה, זו החתימה החזותית של נגן וידאו */}
      <div
        dir="ltr"
        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-14 pb-3"
      >
        <div className="relative mx-1 h-1.5 cursor-pointer rounded-full bg-white/25" onClick={seekTo}>
          <div className="h-full rounded-full bg-[#ff2d2d]" style={{ width: `${progress * 100}%` }} />
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff2d2d] shadow-md"
            style={{ left: `${progress * 100}%` }}
          />
        </div>

        <div className="mt-2 flex items-center gap-1">
          <PlayerButton label={playing ? "השהיה" : "נגני"} onClick={togglePlay}>
            {playing ? (
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </PlayerButton>

          <PlayerButton label="מהתחלה" onClick={restart}>
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
          </PlayerButton>

          <PlayerButton
            label={muted ? "הפעלת קול" : "השתקה"}
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              v.muted = !v.muted;
              v.volume = 1;
              setMuted(v.muted);
            }}
          >
            {muted ? (
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 5 6 9H3v6h3l5 4z" />
                <path d="m17 9 4 6M21 9l-4 6" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 5 6 9H3v6h3l5 4z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
              </svg>
            )}
          </PlayerButton>

          <span className="px-1 text-sm font-bold text-white/90 tabular-nums">
            {fmtTime(current)} / {fmtTime(duration)}
          </span>

          <div className="flex-1" />

          {caption && caption.trim() !== "" && (
            <PlayerButton label="כיתוב" active={showCaption} onClick={() => setShowCaption((c) => !c)}>
              <span className="text-base font-black tracking-tight">CC</span>
            </PlayerButton>
          )}

          <PlayerButton
            label={expanded ? "יציאה ממסך מלא" : "מסך מלא"}
            active={expanded}
            onClick={() => setExpanded((e) => !e)}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {expanded ? (
                <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
              ) : (
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              )}
            </svg>
          </PlayerButton>
        </div>
      </div>

      {/* שם הקבוצה במסך מלא - אחרת לא ברור של מי ההקלטה שמוצגת */}
      {expanded && title && (
        <div className="absolute top-6 right-6 rounded-full bg-black/60 px-5 py-2 text-lg font-bold text-white">
          {title}
        </div>
      )}
    </div>
  );
}

export default ClipPlayer;
