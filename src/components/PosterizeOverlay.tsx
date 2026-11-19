import { useEffect, useRef, type RefObject } from "react";

/**
 * "Posterize Time" להקלטות של שלב 7 (בקשת המפתחת 2026-11-19): במקום תנועה
 * חלקה (24-30 תמונות בשנייה), התמונה מתחלפת רק CLIP_FPS פעמים בשנייה - מראה
 * "קופצני" של סטופ-מושן. הקול ממשיך רגיל ורציף.
 *
 * איך: שכבת canvas מעל הסרטון, שמציירת את התמונה הנוכחית שלו רק כל 1/6
 * שנייה. הקובץ עצמו לא משתנה - ההקלטה נשמרת חלקה, והאפקט רק בתצוגה. לכן
 * אפשר לכבות או לשנות קצב בכל רגע (CLIP_FPS), וזה עובד גם על הקלטות ישנות.
 *
 * השכבה פעילה רק בזמן ניגון. בעצירה היא נעלמת והסרטון עצמו גלוי - כך
 * הפקדים של הדפדפן (קול, מסך מלא) זמינים כרגיל. נגיעה בשכבה בזמן ניגון
 * עוצרת את הסרטון.
 *
 * כתוביות: הכתוביות המובנות של הדפדפן מצוירות על הסרטון ולכן מוסתרות מתחת
 * לשכבה - עם drawCaptions השכבה מציירת אותן בעצמה.
 */

/** כמה תמונות בשנייה. 0 = בלי אפקט (תנועה חלקה רגילה). */
export const CLIP_FPS = 6;

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** האם הסרטון מנגן עכשיו - השכבה פעילה רק אז. */
  active: boolean;
  /** איך התמונה ממלאת את המסגרת - כמו object-fit של הסרטון שמתחת. */
  fit?: "cover" | "contain";
  /** לצייר את הכתוביות (track) על השכבה - לנגן של הדפדפן. */
  drawCaptions?: boolean;
  /** נגיעה בשכבה (בזמן ניגון). בלי - השכבה לא חוסמת נגיעות. */
  onTap?: () => void;
}

function PosterizeOverlay({ videoRef, active, fit = "cover", drawCaptions = false, onTap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // גודל ה-canvas לפי גודל התיבה בפועל (חד גם במסך ברזולוציה גבוהה)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // הכתוביות המובנות - מוסתרות בזמן שהשכבה פעילה (היא מציירת אותן), וחוזרות בעצירה
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !drawCaptions || CLIP_FPS <= 0) return;
    const tracks = Array.from(video.textTracks ?? []);
    tracks.forEach((t) => (t.mode = active ? "hidden" : "showing"));
  }, [active, drawCaptions, videoRef]);

  useEffect(() => {
    if (!active || CLIP_FPS <= 0) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !video || !ctx) return;

    const frameMs = 1000 / CLIP_FPS;
    let last = -Infinity;
    let raf = 0;

    const draw = () => {
      const cw = canvas.width;
      const ch = canvas.height;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;
      // אותו חיתוך/התאמה כמו object-fit של הסרטון, כדי שהתמונה תיפול עליו בדיוק
      const scale = fit === "cover" ? Math.max(cw / vw, ch / vh) : Math.min(cw / vw, ch / vh);
      const w = vw * scale;
      const h = vh * scale;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(video, (cw - w) / 2, (ch - h) / 2, w, h);

      if (drawCaptions) {
        const cue = Array.from(video.textTracks ?? [])
          .flatMap((t) => Array.from(t.activeCues ?? []))
          .map((c) => (c as VTTCue).text)
          .join(" ")
          .trim();
        if (cue) {
          const dpr = window.devicePixelRatio || 1;
          const size = Math.round(Math.max(14, ch / dpr / 14)) * dpr;
          ctx.font = `700 ${size}px Heebo, sans-serif`;
          ctx.direction = "rtl";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          const tw = Math.min(ctx.measureText(cue).width, cw * 0.92);
          const pad = size * 0.4;
          const y = ch - size * 1.1;
          ctx.fillStyle = "rgba(0,0,0,0.8)";
          ctx.fillRect((cw - tw) / 2 - pad, y - size - pad / 2, tw + pad * 2, size + pad);
          ctx.fillStyle = "#fff";
          ctx.fillText(cue, cw / 2, y, cw * 0.92);
        }
      }
    };

    const tick = (now: number) => {
      // רק כשעברה "תמונה" שלמה (1/6 שנייה) - זה כל האפקט
      if (now - last >= frameMs) {
        last = now;
        draw();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, fit, drawCaptions, videoRef]);

  if (CLIP_FPS <= 0) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      onClick={onTap}
      className="absolute inset-0 h-full w-full"
      style={{
        // בעצירה - שקוף וחסר נגיעות, והסרטון והפקדים שלו גלויים
        visibility: active ? "visible" : "hidden",
        pointerEvents: active && onTap ? "auto" : "none",
      }}
    />
  );
}

export default PosterizeOverlay;
