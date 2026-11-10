import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import Icon, { type IconName } from "./ui/Icon";
import { cx } from "../lib/cx";

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
 *
 * הערה על הצבע: הסרגל הזה יושב **על גבי וידאו**, ולכן הוא נשאר כהה ואטום
 * למחצה ולא הופך לזכוכית טורקיז כמו שאר הממשק. זו לא חריגה מהשפה אלא
 * דרישה ממנה - זכוכית שקופה מעל תמונה נעה פשוט לא קריאה, וכל נגן וידאו
 * בעולם עובד כך מאותה סיבה. הטורקיז נוכח כאן בפס ההתקדמות ובמצב הדלוק.
 */
export function PlayerButton({
  label,
  icon,
  text,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  /** אייקון מהסט המשותף. לחלופין `text` לכפתור כמו CC. */
  icon?: IconName;
  text?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "relative flex h-14 w-14 items-center justify-center btn-rect text-white transition-colors duration-150 active:scale-90 disabled:opacity-40",
        active ? "bg-white/20" : "hover:bg-white/12",
      )}
    >
      {icon ? (
        <Icon name={icon} size={26} filled={icon === "play" || icon === "record"} />
      ) : (
        <span className="text-base font-black tracking-tight">{text}</span>
      )}
      {active && (
        <span className="bg-accent absolute bottom-2 h-[3px] w-6 rounded-full" />
      )}
    </button>
  );
}

/**
 * נגן צפייה בהקלטה - אותה שפה חזותית בדיוק של סרגל ההקלטה: פס התקדמות
 * טורקיז, כפתור עגול משמאל, וכפתורי קול/כיתוב/מסך מלא מימין. רכיב נפרד כי
 * הוא מופיע שלוש פעמים במסך אחד (הקלטה לכל קבוצה), וכל מופע מנהל את הקול
 * והזמן של עצמו.
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
      <div className="glass glass-brick flex h-48 w-full flex-col items-center justify-center gap-2 rounded-xl px-4 text-center">
        <Icon name="alert" size={26} className="text-warn" />
        <p className="text-warn text-sm font-bold">הסרטון לא נטען</p>
        <p className="text-ink-3 text-xs">
          ההקלטה נשמרה, אבל הדפדפן לא הצליח להוריד אותה
        </p>
      </div>
    );
  }

  const progress = duration > 0 ? current / duration : 0;

  return (
    <div
      className={cx(
        "overflow-hidden bg-black shadow-glass-lg",
        expanded
          ? "fixed inset-0 z-50 rounded-none"
          : "glass !bg-black relative rounded-2xl",
      )}
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
          aria-label={ended ? "לצפייה מהתחלה" : "ניגון"}
          onClick={ended ? restart : togglePlay}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3"
        >
          <span
            className="glass glass-active flex h-20 w-20 items-center justify-center btn-rect transition-transform duration-150 hover:scale-105"
            style={{ boxShadow: "0 0 40px -4px var(--ds-glow)" }}
          >
            <Icon
              name={ended ? "refresh" : "play"}
              size={36}
              filled={!ended}
              className={ended ? undefined : "translate-x-0.5"}
            />
          </span>
          {ended && (
            <span className="rounded-sm bg-black/60 px-4 py-1 text-sm font-bold text-white">
              לצפייה מהתחלה
            </span>
          )}
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
        className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/50 to-transparent px-4 pt-14 pb-3"
      >
        <div
          className="relative mx-1 h-1.5 cursor-pointer rounded-full bg-white/25"
          onClick={seekTo}
        >
          <div
            className="bg-accent h-full rounded-full"
            style={{ width: `${progress * 100}%`, boxShadow: "0 0 10px var(--ds-glow)" }}
          />
          <span
            className="bg-accent absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 diamond shadow-md"
            style={{ left: `${progress * 100}%` }}
          />
        </div>

        <div className="mt-2 flex items-center gap-1">
          <PlayerButton
            label={playing ? "השהיה" : "ניגון"}
            icon={playing ? "pause" : "play"}
            onClick={togglePlay}
          />

          <PlayerButton label="מהתחלה" icon="refresh" onClick={restart} />

          <PlayerButton
            label={muted ? "הפעלת קול" : "השתקה"}
            icon={muted ? "volumeOff" : "volume"}
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              v.muted = !v.muted;
              v.volume = 1;
              setMuted(v.muted);
            }}
          />

          <span className="px-1 text-sm font-bold text-white/90 tabular-nums">
            {fmtTime(current)} / {fmtTime(duration)}
          </span>

          <div className="flex-1" />

          {caption && caption.trim() !== "" && (
            <PlayerButton
              label="כיתוב"
              text="CC"
              active={showCaption}
              onClick={() => setShowCaption((c) => !c)}
            />
          )}

          <PlayerButton
            label={expanded ? "יציאה ממסך מלא" : "מסך מלא"}
            icon={expanded ? "fullscreenExit" : "fullscreen"}
            active={expanded}
            onClick={() => setExpanded((e) => !e)}
          />
        </div>
      </div>

      {/* שם הקבוצה במסך מלא - אחרת לא ברור של מי ההקלטה שמוצגת */}
      {expanded && title && (
        <div className="absolute top-6 right-6 rounded-sm bg-black/60 px-5 py-2 text-lg font-bold text-white">
          {title}
        </div>
      )}
    </div>
  );
}

export default ClipPlayer;
