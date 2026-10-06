import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { useMedia } from "../../hooks/useMedia";
import { normalizeVotes, useRatings } from "../../hooks/useRatings";
import { useParticipants } from "../../hooks/useParticipants";
import { clipKey, getLocalClip, saveLocalClip } from "../../lib/localClips";
import { listProjectClips, projectClipUrl, saveClipToProject } from "../../lib/projectClips";
import { PlayerButton, fmtTime } from "../ClipPlayer";
import { useLiveCaptions } from "../../hooks/useLiveCaptions";
import {
  requestTranscript,
  segmentsToVtt,
  useClipTranscripts,
  type TranscriptSegment,
} from "../../hooks/useClipTranscripts";
import type { Group } from "../../types/group";
import type { MediaItem } from "../../types/media";
import { BackgroundLayers } from "../ui/AppBackground";
import Icon from "../ui/Icon";
// תג השלב העגול - אותו תג כמו בכותרת של StageShell בכל שאר השלבים
import { LevelBadge } from "../ui/GameTile";
import { ConclusionInHeader } from "../PracticalConclusionBanner";
import { GlassButton, Spinner } from "../ui/Glass";
import { LoadingState, Skeleton } from "../ui/Feedback";
import StageShell from "../StageShell";

const RECORD_SECONDS = 10;

/** סולם הטורקיז של לבנת הזכוכית - אותם ערכים שמשמשים את שעון החול בשלב 6. */
const PALETTE = ["#c7f5f4", "#a7e9e5", "#84c7c1", "#6baca6", "#4e8f8b"];

/**
 * ההוראות מופיעות אחת אחרי השנייה, ורק בסוף נחשפת תיבת ההקלדה - לפי
 * ההוראה שבשקופית. הרשימה מרוכזת כאן כדי שיהיה קל להעביר אותה לתוכן
 * שנטען מה-DB כשממשק העריכה ייבנה (סעיף 7 ב-CLAUDE.md).
 *
 * התוכן הוא הנחיות צילום מעשיות למי שעומדת לעמוד מול המצלמה - תאורה,
 * מרחק, קול ותכנון המשפט - כי ההקלטה היא בת 10 שניות בלבד ואין הזדמנות
 * שנייה.
 */
const SIMULATION_STEPS = [
  { text: "בחרו משתתפת אחת שתעמוד מול המצלמה", color: PALETTE[0] },
  { text: "עמדו כמטר מהמסך, כך שהפנים והידיים ייכנסו למסגרת", color: PALETTE[1] },
  { text: "ודאו שהאור מגיע מלפנים - חלון מאחורי הגב יחשיך את הפנים", color: PALETTE[2] },
  { text: "דברו לאט, בקול ברור, ישירות אל המצלמה", color: PALETTE[3] },
  { text: "יש לכן 10 שניות בלבד - תכננו מראש משפט אחד ממוקד", color: PALETTE[4] },
];

/** כמה זמן עובר בין הופעת הוראה להוראה הבאה. */
const STEP_DELAY_SECONDS = 0.85;

/**
 * רקע ייעודי למסך ההקלטה - **סרט צילום** שגולל לרוחב, למעלה ולמטה.
 * רעיון אחר לגמרי מהרקע של שעון החול, וגם נושאי: המסך הזה עוסק בצילום.
 *
 * למה לרוחב ולא לאורך: פריים של סרט הוא מלבן שוכב, ולכן ברצועה אופקית
 * הפריימים מופיעים בפרופורציה הטבעית שלהם ומיד נקראים כ"סרט". ברצועה
 * אנכית הפריימים יוצאים עומדים וזה נקרא יותר כמו עמודת ריבועים. בנוסף
 * תצוגת המצלמה במרכז היא מלבן רחב, ושתי רצועות אופקיות ממסגרות אותה.
 *
 * הגלילה עובדת בטריק הקלאסי: הרצועה מכילה שני עותקים זהים ונעה בדיוק
 * ברוחב עותק אחד, כך שהחזרה להתחלה בלתי מורגשת.
 *
 * תנאי הכרחי לטריק: עותק **אחד** חייב להיות רחב יותר מהמסך. אם הוא קצר
 * מהמסך, לקראת סוף המחזור קצה הסרט נכנס לתמונה ונראה כאילו הסרט נגמר
 * פתאום. לכן מספר הפריימים נגזר מרוחב החלון בפועל ולא נקבע מראש.
 */

/** כמה פריימים צריך בעותק אחד כדי לכסות את כל רוחב המסך, ועוד שניים לביטחון. */
function tilesForScreen(tileWidth: number) {
  const screenWidth = typeof window === "undefined" ? 1920 : window.innerWidth;
  return Math.ceil(screenWidth / tileWidth) + 2;
}

function FilmStrip({ edge }: { edge: "top" | "bottom" }) {
  const TILE = 150;
  const H = 112;
  // הרצועה מוקטנת ומרוסנת בכוונה - היא **מבטא רקע**, לא הנושא של המסך.
  // קו העיצוב של הפרויקט הוא רקע כהה ונקי עם אלמנט מוקד אחד (כאן: המצלמה).
  const STRIP_H = 56;
  const SCALE = STRIP_H / H;

  // מספר הפריימים בעותק אחד מחושב מרוחב המסך (ראו ההסבר למעלה), ומתעדכן
  // אם גודל החלון משתנה. משך האנימציה נגזר ממנו, כך שמהירות הגלילה על
  // המסך נשארת זהה בכל רזולוציה.
  const [tiles, setTiles] = useState(() => tilesForScreen(TILE * SCALE));
  useEffect(() => {
    const onResize = () => setTiles(tilesForScreen(TILE * SCALE));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [SCALE]);

  const W = TILE * tiles * 2;

  // גרדיאנט אחד רציף שנמתח על **כל** אורך הסרט (אותו רעיון של שעון החול
  // בשלב 6: gradientUnits="userSpaceOnUse" משותף לכל האלמנטים). כך הצבע
  // זולג בעדינות מפריים לפריים במקום שכל פריים יהיה כתם צבע נפרד.
  // הפלטה חוזרת בדיוק 4 פעמים על הרוחב הכפול, כלומר פעמיים על כל עותק,
  // ולכן נקודת החיבור בלולאה זהה לנקודת ההתחלה והמעבר בלתי מורגש.
  const CYCLES = 4;
  const stops = Array.from({ length: CYCLES * PALETTE.length + 1 }, (_, i) => ({
    offset: i / (CYCLES * PALETTE.length),
    color: PALETTE[i % PALETTE.length],
  }));

  const gid = `film-grad-${edge}`;
  const glowId = `film-glow-${edge}`;

  // מיקומי הפריימים - אותו מערך משמש גם לשכבת הזוהר וגם לפריימים החדים
  const frames = Array.from({ length: tiles * 2 }, (_, i) => i * TILE);

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 overflow-hidden opacity-[0.32] ${
        edge === "top" ? "top-0" : "bottom-0"
      }`}
      style={{
        height: STRIP_H,
        // דהייה בקצוות, כדי שהסרט ייראה כאילו הוא נמשך אל מעבר למסך
        maskImage: "linear-gradient(90deg, transparent 0%, black 18%, black 82%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent 0%, black 18%, black 82%, transparent 100%)",
      }}
    >
      <div
        className="absolute top-0 left-0"
        style={{
          width: W * SCALE,
          height: STRIP_H,
          animation: `film-roll-x ${tiles * 3.4}s linear infinite${edge === "bottom" ? " reverse" : ""}`,
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width={W * SCALE} height={STRIP_H} aria-hidden="true">
          <defs>
            <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2="0">
              {stops.map((s, i) => (
                <stop key={i} offset={s.offset} stopColor={s.color} />
              ))}
            </linearGradient>
            <filter id={glowId} x="-5%" y="-40%" width="110%" height="180%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>

          {/* גוף הסרט - צלולואיד כהה, כמעט שקוף, כדי שלא יתחרה ברקע */}
          <rect width={W} height={H} fill="#0a1218" fillOpacity={0.45} />

          {/* הילה צבעונית רכה מתחת לפריימים - רק רמז של אור, לא כתם */}
          <g filter={`url(#${glowId})`} opacity={0.16}>
            {frames.map((x) => (
              <rect key={x} x={x + 10} y="29" width="130" height="54" rx="8" fill={`url(#${gid})`} />
            ))}
          </g>

          {/* הפריימים עצמם - בעיקר מסגרת. הצבע נשאר כמסגרת דקה ולא כמילוי
              מלא, כך שהרצועה נקראת כסרט אבל נשארת שקטה */}
          {frames.map((x) => (
            <g key={x}>
              <rect
                x={x + 10}
                y="29"
                width="130"
                height="54"
                rx="7"
                fill={`url(#${gid})`}
                fillOpacity={0.14}
              />
              <rect
                x={x + 10}
                y="29"
                width="130"
                height="54"
                rx="7"
                fill="none"
                stroke={`url(#${gid})`}
                strokeWidth={2}
                strokeOpacity={0.85}
              />
            </g>
          ))}

          {/* חורי הנעה למעלה ולמטה, כמו בסרט 35 מ"מ */}
          {frames.map((x) =>
            [14, 52, 90].map((dx) => (
              <g key={`${x}-${dx}`}>
                <rect x={x + dx} y="9" width="24" height="12" rx="5" fill="#ffffff" fillOpacity={0.3} />
                <rect x={x + dx} y="92" width="24" height="12" rx="5" fill="#ffffff" fillOpacity={0.3} />
              </g>
            )),
          )}

          {/* קו צבע דק לאורך הקצה הפנימי - מחבר את הרצועה אל שאר הדף */}
          <rect
            x="0"
            y={edge === "top" ? H - 2 : 0}
            width={W}
            height="2"
            fill={`url(#${gid})`}
            fillOpacity={0.5}
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * עדשת מצלמה מונפשת - הלב החזותי של המסך, באותו רעיון של שעון החול
 * בשלב 6: אלמנט SVG מרכזי אחד ונקי שמושך את העין. בלי טבעות מסתובבות
 * מסביב (לפי בקשת הלקוחה) - רק העדשה עצמה, עם נורית הקלטה שפועמת.
 */
function RecordingLens() {
  return (
    <div className="relative flex items-center justify-center">
      <style>{`
        @keyframes rec-pulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.18); }
        }
      `}</style>

      <div
        className="pointer-events-none absolute h-80 w-80 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(91,192,235,0.07) 45%, transparent 72%)",
        }}
      />

      <svg viewBox="0 0 200 200" className="relative h-60 w-60">
        <defs>
          <linearGradient id="lens-line" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="180">
            <stop offset="0%" stopColor={PALETTE[0]} />
            <stop offset="25%" stopColor={PALETTE[1]} />
            <stop offset="50%" stopColor={PALETTE[2]} />
            <stop offset="75%" stopColor={PALETTE[3]} />
            <stop offset="100%" stopColor={PALETTE[4]} />
          </linearGradient>
          <radialGradient id="lens-glass" cx="0.36" cy="0.3" r="0.75">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.3} />
            <stop offset="55%" stopColor="#84c7c1" stopOpacity={0.14} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.35} />
          </radialGradient>
        </defs>

        {/* גוף העדשה */}
        <circle cx="100" cy="100" r="62" fill="url(#lens-glass)" stroke="url(#lens-line)" strokeWidth={2.5} />
        <circle cx="100" cy="100" r="46" fill="none" stroke="url(#lens-line)" strokeWidth={1.5} opacity={0.55} />
        <circle cx="100" cy="100" r="26" fill="#0b1a22" stroke="url(#lens-line)" strokeWidth={2} opacity={0.9} />

        {/* הברקה על הזכוכית */}
        <path d="M74 76 C82 64 100 60 112 64" fill="none" stroke="#ffffff" strokeOpacity={0.5}
          strokeWidth={4} strokeLinecap="round" />

        {/* נורית הקלטה */}
        <circle cx="100" cy="100" r="9" fill="#e4685f"
          style={{ transformOrigin: "100px 100px", animation: "rec-pulse 1.6s ease-in-out infinite" }} />
      </svg>
    </div>
  );
}

interface Props {
  workshopId: string;
  myGroup: Group;
  allGroups: Group[];
  onAdvance: () => void;
}

function SolutionAndRecord({
  workshopId,
  myGroup,
  onDone,
}: {
  workshopId: string;
  myGroup: Group;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"solution" | "record">("solution");
  const [solution, setSolution] = useState("");
  const [status, setStatus] = useState<"idle" | "recording" | "review" | "uploading" | "error">("idle");
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RECORD_SECONDS);
  // ההתקדמות מחושבת מהשעון האמיתי ומצוירת ישירות על ה-DOM בכל פריים.
  // קודם היא הייתה נגזרת מ-secondsLeft, כלומר קפצה פעם בשנייה - מה שנראה
  // מקוטע. עדכון ישיר דרך ref (ולא state) שומר על 60fps בלי רינדור מחדש.
  const startedAtRef = useRef<number>(0);
  const barRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // --- מצב נגן התצוגה המקדימה (כיתוב / מסך מלא / מראה) ---
  const intervalRef = useRef<number | null>(null);
  const [showCaption, setShowCaption] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  // כתוביות חיות תוך כדי הדיבור. רצות רק בזמן הקלטה, ונכבות בשקט אם הדפדפן
  // לא תומך או שהסינון חוסם את שירות הזיהוי (ראו src/hooks/useLiveCaptions.ts).
  const { text: liveCaption, state: captionState } = useLiveCaptions(status === "recording");

  /**
   * ref פונקציונלי לאלמנט הווידאו. במעבר למסך מלא הנגן עובר ל-portal, כלומר
   * React בונה אלמנט <video> חדש - וזרם המצלמה (srcObject) לא עובר איתו, אז
   * התצוגה נשארת שחורה. כאן הזרם מחובר מחדש בכל פעם שהאלמנט נוצר, ולכן המעבר
   * בין המצבים שקוף למשתמשת.
   */
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) node.srcObject = streamRef.current;
  }, []);
  // המצלמה נפתחת אסינכרונית. בלי הדגל הזה אפשר ללחוץ על "התחילי הקלטה" לפני
  // שיש stream, ואז startRecording יוצא מיד בשקט - לחיצה שלא עושה כלום ובלי
  // שום משוב. על פלזמת אנדרואיד הפתיחה איטית יותר, אז זה תרחיש אמיתי.
  const [streamReady, setStreamReady] = useState(false);
  // עוצמת הקליטה של המיקרופון (0-1) ודגל "שקט מוחלט". נבדק בפועל שהקלטה
  // יכולה להישמר עם פס קול תקין אבל ריק לגמרי (max_volume ‎-90dB) כשהמיקרופון
  // של המחשב לא קולט - ואז אין שום סימן לכך עד שמנסים לצפות. המד הזה הופך
  // את זה לגלוי מראש.
  const [micLevel, setMicLevel] = useState(0);
  const [micSilent, setMicSilent] = useState(false);

  useEffect(() => {
    if (phase !== "record") return;
    setStreamReady(false);
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStreamReady(true);
      })
      .catch((err) => {
        setStatus("error");
        setError("אין גישה למצלמה: " + err.message);
      });
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [phase]);

  // מדידת עוצמת המיקרופון בזמן אמת
  useEffect(() => {
    if (!streamReady || !streamRef.current) return;
    const stream = streamRef.current;
    let ctx: AudioContext | null = null;
    let interval: number | null = null;
    let quietSince = Date.now();

    try {
      ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);

      interval = window.setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        setMicLevel(peak);
        if (peak > 0.02) {
          quietSince = Date.now();
          setMicSilent(false);
        } else if (Date.now() - quietSince > 3000) {
          setMicSilent(true);
        }
      }, 120);
    } catch {
      // דפדפן בלי AudioContext - מוותרים על המד, ההקלטה עצמה לא נפגעת.
    }

    return () => {
      if (interval !== null) clearInterval(interval);
      ctx?.close().catch(() => {});
    };
  }, [streamReady]);

  async function handleSaveSolution() {
    await supabase
      .from("responses")
      .insert({
        workshop_id: workshopId,
        group_id: myGroup.id,
        stage_number: 7,
        type: "solution_text",
        data: { text: solution },
      })
      .then();
    setPhase("record");
  }

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current);
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    // בסוף ההקלטה לא מעלים מיד: הקבוצה בוחרת בין "שליחה" ל"הקלטה חוזרת"
    recorder.onstop = () => setStatus("review");
    recorder.start();
    recorderRef.current = recorder;
    setStatus("recording");
    setSecondsLeft(RECORD_SECONDS);

    startedAtRef.current = Date.now();
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
  }

  /**
   * עצירה - גם מהכפתור בסרגל וגם אוטומטית בסוף הזמן. שתיהן עוברות דרך כאן
   * כדי ש-recorder.stop() ייקרא בדיוק פעם אחת (קריאה שנייה על מקליט שכבר
   * נעצר זורקת שגיאה בחלק מהדפדפנים) ושהטיימר ייעצר יחד איתו.
   */
  function stopRecording() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  // ציור ההתקדמות בכל פריים כל עוד מקליטים
  useEffect(() => {
    if (status !== "recording") return;
    let frame = 0;

    const draw = () => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      const ratio = Math.min(1, elapsed / RECORD_SECONDS);
      if (barRef.current) barRef.current.style.width = `${ratio * 100}%`;
      if (knobRef.current) knobRef.current.style.left = `${ratio * 100}%`;
      if (elapsedRef.current) elapsedRef.current.textContent = fmtTime(Math.min(RECORD_SECONDS, elapsed));
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [status]);

  // איפוס הפס כשחוזרים למצב המתנה
  useEffect(() => {
    if (status !== "idle") return;
    if (barRef.current) barRef.current.style.width = "0%";
    if (knobRef.current) knobRef.current.style.left = "0%";
    if (elapsedRef.current) elapsedRef.current.textContent = fmtTime(0);
  }, [status]);

  // סוף הזמן עוצר את ההקלטה. עושים את זה כאן ולא בתוך פונקציית העדכון של
  // הטיימר, כי פונקציית עדכון ב-React חייבת להיות נקייה מתופעות לוואי -
  // ב-StrictMode היא רצה פעמיים, ואז recorder.stop() היה נקרא פעמיים.
  useEffect(() => {
    if (status === "recording" && secondsLeft === 0) stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, secondsLeft]);

  // אם המסך מתחלף באמצע הקלטה (רענון/מעבר שלב) - לעצור את הטיימר.
  useEffect(
    () => () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    },
    [],
  );

  async function handleUpload() {
    setStatus("uploading");
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    // עותק מקומי **לפני** ההעלאה: גם אם הרשת או הסינון יפילו את ההעלאה,
    // ההקלטה כבר קיימת ותוכל להיות מוצגת (ראו src/lib/localClips.ts).
    await saveLocalClip(clipKey(workshopId, myGroup.id), blob);
    // ועותק כקובץ בתוך הפרויקט (public/recordings) - כך ההקלטות נוסעות עם
    // תיקיית הפרויקט לכל מחשב, ונטענות משם בלי אינטרנט ובלי סינון.
    await saveClipToProject(workshopId, myGroup.id, blob);
    const path = `${workshopId}/${myGroup.id}-${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage.from("media").upload(path, blob);
    if (uploadError) {
      setStatus("error");
      setError(uploadError.message);
      return;
    }
    const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
    await supabase
      .from("media")
      .insert({
        workshop_id: workshopId,
        group_id: myGroup.id,
        stage_number: 7,
        url: urlData.publicUrl,
      })
      .then();
    // תמלול לכתוביות - רץ ברקע, לא מעכב את המעבר למסך ההמתנה
    requestTranscript(workshopId, myGroup.id);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onDone();
  }

  /*
    גלילה אוטומטית במסך ההוראות: בכל פעם שהוראה (או תיבת הפתרון והכפתור)
    מופיעה, האזור גולל אליה בעדינות. התזמון זהה לאנימציית ההופעה.
  */
  const stepsScrollRef = useRef<HTMLElement>(null);
  /*
    גלילה רכה משלנו ולא scrollIntoView: הגלילה של הדפדפן מהירה וקופצנית
    ("צולעת"). כאן - 1.1 שניות עם האטה בהתחלה ובסוף (ease-in-out), עד
    שההוראה החדשה מגיעה למרכז האזור. אם כבר רואים אותה, לא זזים.
  */
  const glideFrameRef = useRef(0);
  function glideTo(box: HTMLElement, el: HTMLElement) {
    const boxRect = box.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const target = Math.max(
      0,
      Math.min(
        box.scrollHeight - box.clientHeight,
        box.scrollTop + (elRect.top + elRect.height / 2) - (boxRect.top + boxRect.height / 2),
      ),
    );
    const from = box.scrollTop;
    if (Math.abs(target - from) < 4) return;
    cancelAnimationFrame(glideFrameRef.current);
    const duration = 1100;
    const t0 = performance.now();
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      box.scrollTop = from + (target - from) * ease(t);
      if (t < 1) glideFrameRef.current = requestAnimationFrame(step);
    };
    glideFrameRef.current = requestAnimationFrame(step);
  }
  useEffect(() => {
    if (phase !== "solution") return;
    const timers = Array.from({ length: SIMULATION_STEPS.length + 2 }, (_, i) =>
      window.setTimeout(
        () => {
          const box = stepsScrollRef.current;
          const el = box?.querySelector<HTMLElement>(`[data-step="${i}"]`);
          if (box && el) glideTo(box, el);
        },
        ((i + 1) * STEP_DELAY_SECONDS + (i >= SIMULATION_STEPS.length ? 0.4 : 0.3)) * 1000,
      ),
    );
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(glideFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "solution") {
    const inputDelay = (SIMULATION_STEPS.length + 1) * STEP_DELAY_SECONDS;

    return (
      <main
        /*
          כל הדף גולל כיחידה אחת (התג, הכותרת וההוראות יחד), וגולל מעצמו
          אל כל הוראה שמופיעה. קודם רק האזור התחתון גלל מתחת לכותרת קבועה,
          וההוראות נחתכו מתחתיה - זה נראה תקוע.
        */
        ref={stepsScrollRef}
        className="glass-scroll relative flex h-dvh flex-col items-center gap-5 overflow-x-hidden overflow-y-auto px-8 pt-20 pb-6 text-center"
      >
        <style>{`
          @keyframes step-in {
            from { opacity: 0; transform: translateY(22px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        <BackgroundLayers variant="deep" />

        <div className="relative flex flex-col items-center gap-3" style={{ animation: "fade-up 0.7s ease-out both" }}>
          <LevelBadge value={7} progress={0.7} size={88} />
          <span className="glass glass-chip text-accent-soft gap-2">
            <Icon name="camera" size={15} />
            סימולציות
          </span>
          <ConclusionInHeader />
          <h1 className="glass-title text-4xl sm:text-5xl">הוראות לעריכת הסימולציה</h1>
        </div>

        {/*
          טור אחד (כמו בעיצוב המקורי): העדשה, ההוראות, תיבת הפתרון והכפתור.
          האזור הזה גולל בתוך עצמו, ו**גולל מעצמו** אל כל הוראה ברגע שהיא
          מופיעה (ראו autoScroll למטה) - כך אף אחד לא צריך לגלול ביד.
        */}
        {/* pb-40: גם ההוראה האחרונה והכפתור עולים מעל הפאנלים שבפינות */}
        <div className="relative flex w-full flex-none flex-col items-center gap-6 pb-40">
        <div className="relative flex-none" style={{ animation: "fade-up 0.9s 0.15s ease-out both" }}>
          <RecordingLens />
        </div>

        {/* ההוראות נחשפות אחת אחרי השנייה. כל אחת היא לבנה בפני עצמה -
            קודם הן היו שורות טקסט עם עיגול צבעוני, וחמישה צבעים שונים
            רמזו על היררכיה שלא קיימת: כל ההוראות שוות בחשיבותן. */}
        <ol className="relative flex w-full max-w-2xl flex-none flex-col gap-3 text-right">
          {SIMULATION_STEPS.map((step, i) => (
            <li
              key={i}
              data-step={i}
              className="glass glass-dim glass-raised flex items-center gap-4 rounded-lg px-5 py-3.5"
              style={{ animation: `step-in 0.6s ${(i + 1) * STEP_DELAY_SECONDS}s cubic-bezier(0.22, 1, 0.36, 1) both` }}
            >
              <span
                aria-hidden="true"
                className="glass glass-active flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
              >
                {i + 1}
              </span>
              <span className="text-ink text-lg font-bold sm:text-xl">{step.text}</span>
            </li>
          ))}
        </ol>

        <div
          data-step={SIMULATION_STEPS.length}
          className="relative w-full max-w-2xl flex-none text-right"
          style={{ animation: `step-in 0.7s ${inputDelay}s cubic-bezier(0.22, 1, 0.36, 1) both` }}
        >
          <label
            htmlFor="stage7-solution"
            className="text-ink-2 mb-3 flex items-center gap-2 px-2 text-sm font-bold"
          >
            <Icon name="edit" size={15} className="text-accent-soft" />
            הקלידו את הפתרון שגיבשתם
          </label>
          <textarea
            id="stage7-solution"
            className="glass-input h-32 w-full resize-none !rounded-2xl py-4 !text-lg"
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            placeholder="הקלידו כאן..."
          />
        </div>

        <div
          data-step={SIMULATION_STEPS.length + 1}
          className="flex-none"
          style={{ animation: `step-in 0.7s ${inputDelay + 0.35}s cubic-bezier(0.22, 1, 0.36, 1) both` }}
        >
          <GlassButton
            variant="primary"
            size="lg"
            iconAfter="arrowNext"
            onClick={handleSaveSolution}
            disabled={!solution.trim()}
          >
            המשך להקלטה
          </GlassButton>
        </div>
        </div>
      </main>
    );
  }

  // הנגן מוגדר כמשתנה כדי שאפשר יהיה לרנדר אותו בשני מקומות: במקומו
  // הרגיל בתוך העמוד, או - במצב מסך מלא - ישירות על body דרך portal.
  // בלי זה "מסך מלא" נשבר: ההורה של הנגן מונפש ב-transform, וזה הופך
  // אותו לנקודת הייחוס של position:fixed במקום החלון. ברגע שהנגן יוצא
  // מהזרימה ההורה מתכווץ לגובה אפס, ואיתו הנגן - כלומר "מסך מלא" דווקא
  // העלים את הווידאו. relative מופיע רק כשלא מורחבים, מאותה סיבה: שתי
  // מחלקות מיקום יחד נקבעות לפי סדר הכללים בגיליון ולא לפי סדר המחלקות.
  const playerBox = (
          <div
            ref={playerRef}
            className={`glass !bg-black overflow-hidden shadow-glass-lg ${
              expanded ? "fixed inset-0 z-50 rounded-none" : "relative rounded-[2rem]"
            }`}
          >
            <video
              ref={attachVideo}
              autoPlay
              muted
              playsInline
              className={expanded ? "h-full w-full object-contain" : "aspect-video object-cover"}
              style={{
                ...(mirrored ? { transform: "scaleX(-1)" } : null),
                /*
                  הרוחב הוא הקטן מבין: 68rem, הרוחב שבין מד ההתקדמות לטיימר
                  (שבפינות התחתונות), והרוחב שמתאים לגובה הפנוי ב-16:9.
                  קודם הנגן היה ברוחב 86vw, והפאנל של מד ההתקדמות כיסה את
                  כפתור ההקלטה שבפינה התחתונה שלו - אי אפשר היה להקליט.
                */
                ...(expanded
                  ? null
                  : { width: "min(68rem, calc(100vw - 42rem), (100dvh - 25rem) * 16 / 9)", minWidth: "22rem" }),
              }}
            />

            {/* כיתוב - הפתרון שהקבוצה הקלידה במסך הקודם, בסגנון כתוביות של סרט:
                טקסט לבן על רצועה כהה בתחתית המסך. בזמן ההקלטה הוא משמש כטלפרומפטר,
                ולכן הוא גדול ומרווח - צריך להיות קריא ממרחק של כמה מטרים. */}
            {/* כתוביות של מה שנאמר **עכשיו** בלבד. הפתרון שהוקלד במסך הקודם
                לא מוצג כאן כלל, לפי בקשת הלקוחה - הוא לא קשור למה שמצולם. */}
            {showCaption && liveCaption !== "" && (
              <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center px-12">
                <p className="max-w-[80%] rounded-xl bg-black/75 px-6 py-3 text-center text-2xl leading-relaxed font-bold text-white backdrop-blur-[2px]">
                  {liveCaption}
                </p>
              </div>
            )}

            {/* חיווי קטן שהכתוביות החיות מאזינות - כדי שיהיה ברור שהטקסט זז
                כי מדברים, ולא סתם. */}
            {status === "recording" && captionState === "listening" && (
              <div className="pointer-events-none absolute top-5 left-5 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-bold text-ink-2">
                <span className="h-2 w-2 rounded-full bg-ok" style={{ animation: "rec-dot 1.4s ease-in-out infinite" }} />
                כתוביות חיות
              </div>
            )}

            {/* סרגל השליטה. dir="ltr" בכוונה - סדר הכפתורים בנגן וידאו זהה בכל
                השפות, וזו בדיוק ה"חתימה" החזותית שמזהים מיד. שאר המסך נשאר RTL. */}
            <div
              dir="ltr"
              className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/95 via-black/60 to-transparent px-6 pt-24 pb-5"
            >
              {/* ציר הזמן - הרוחב מצויר ישירות ב-requestAnimationFrame (ראו
                  ה-effect למעלה), ולכן הוא זוחל ברציפות ולא קופץ פעם בשנייה. */}
              <div className="relative mx-1 h-2 rounded-full bg-white/20">
                <div ref={barRef} className="h-full w-0 rounded-full bg-record" />
                <span
                  ref={knobRef}
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-record shadow-md transition-opacity duration-200"
                  style={{ left: "0%", opacity: status === "recording" ? 1 : 0 }}
                />
              </div>

              <div className="mt-3 flex items-center gap-3">
                {/* הקלטה / עצירה */}
                <button
                  type="button"
                  onClick={status === "recording" ? stopRecording : startRecording}
                  disabled={!streamReady || status === "uploading" || status === "error"}
                  title={status === "recording" ? "עצירת הקלטה" : "התחלת הקלטה"}
                  aria-label={status === "recording" ? "עצירת הקלטה" : "התחלת הקלטה"}
                  className="flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-150 hover:bg-white/12 active:scale-90 disabled:opacity-40"
                >
                  {status === "recording" ? (
                    <span className="h-5 w-5 rounded-[3px] bg-white" />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-record shadow-[0_0_14px_var(--ds-record-glow)]" />
                  )}
                </button>

                <span className="text-base font-bold text-ink tabular-nums">
                  <span ref={elapsedRef}>{fmtTime(0)}</span> / {fmtTime(RECORD_SECONDS)}
                </span>

                {/* מד קליטת המיקרופון - חמישה פסים שמתמלאים לפי העוצמה */}
                <span className="flex items-center gap-2 px-2" title={micSilent ? "המיקרופון לא קולט" : "קליטת מיקרופון"}>
                  <svg viewBox="0 0 24 24" className={`h-5 w-5 ${micSilent ? "text-record" : "text-ink-2"}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  </svg>
                  <span className="flex items-end gap-[3px]">
                    {[0.06, 0.14, 0.26, 0.42, 0.6].map((threshold, i) => (
                      <span
                        key={threshold}
                        className={`w-[3px] rounded-full transition-colors duration-75 ${
                          micLevel > threshold ? "bg-ok" : "bg-white/20"
                        }`}
                        style={{ height: 6 + i * 3 }}
                      />
                    ))}
                  </span>
                </span>

                {status === "recording" && (
                  <span className="flex items-center gap-2 rounded-full bg-record/20 px-3 py-1 text-sm font-black text-record">
                    <span
                      className="h-2.5 w-2.5 rounded-full bg-record"
                      style={{ animation: "rec-dot 1.1s ease-in-out infinite" }}
                    />
                    REC
                  </span>
                )}

                <div className="flex-1" />

                <PlayerButton
                  label="תצוגת מראה"
                  icon="mirror"
                  active={mirrored}
                  onClick={() => setMirrored((m) => !m)}
                />

                <PlayerButton
                  label="כיתוב"
                  text="CC"
                  active={showCaption}
                  onClick={() => setShowCaption((c) => !c)}
                />

                <PlayerButton
                  label={expanded ? "יציאה ממסך מלא" : "מסך מלא"}
                  icon={expanded ? "fullscreenExit" : "fullscreen"}
                  active={expanded}
                  onClick={() => setExpanded((e) => !e)}
                />
              </div>
            </div>
          </div>
  );

  return (
    <main
      className="relative flex h-dvh flex-col items-center justify-center gap-3 overflow-hidden px-8 pt-16 pb-4 text-center"
    >
      <style>{`
        @keyframes rec-dot {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.25); }
        }
        @keyframes rec-halo {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes film-roll-x {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes rec-ring {
          0%, 100% { opacity: 0.85; box-shadow: 0 0 18px 2px var(--ds-record-glow); }
          50% { opacity: 1; box-shadow: 0 0 36px 7px var(--ds-record-glow); }
        }
        @keyframes ring-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>

      {/* כתמי אור מטושטשים בפינות - קו העיצוב הקבוע של כל מסכי הסדנה */}
      <div className="pointer-events-none absolute top-[-12%] right-[8%] h-96 w-96 rounded-full bg-glow-soft blur-[110px]" />
      <div className="pointer-events-none absolute bottom-[-16%] left-[6%] h-96 w-96 rounded-full bg-glow-soft blur-[120px]" />

      {/* זרקור רך מלמעלה - כמו על סט צילום, מאיר את אזור המצלמה */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-[70vh] w-[80vw] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse 50% 70% at 50% 0%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 45%, transparent 75%)",
        }}
      />

      {/* סרטי הצילום יושבים על שכבה צמודה לגבולות **המסך** (fixed) ולא
          לגובה התוכן, כדי שלעולם לא ייחתכו אם התוכן גבוה מהמסך */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <FilmStrip edge="top" />
        <FilmStrip edge="bottom" />
      </div>

      <div className="relative flex flex-col items-center gap-3" style={{ animation: "fade-up 0.7s ease-out both" }}>
        <LevelBadge value={7} progress={0.7} size={88} />
        <span className="glass glass-chip text-accent-soft gap-2">
          <Icon name="record" size={15} />
          הקלטה
        </span>
        <ConclusionInHeader />
        <h1 className="glass-title text-3xl sm:text-4xl">היכונו להקלטה מול המצלמה</h1>
      </div>

      <div className="relative" style={{ animation: "fade-up 0.9s 0.15s ease-out both" }}>
        {/* הילת אורורה - אותו מניפת צבעים מסתובבת, מטושטשת מאוד, שגולשת
            מאחורי התצוגה ונושמת אל הרקע. זה מה שנותן את ה"וואו" בלי להוסיף
            שום אלמנט חדש למסך */}
        <div className="pointer-events-none absolute -inset-20 overflow-hidden rounded-[6rem] opacity-20 blur-[110px]">
          <div
            className="absolute top-1/2 left-1/2 aspect-square w-[130%]"
            style={{
              background: `conic-gradient(${PALETTE.join(", ")}, ${PALETTE[0]})`,
              animation: "ring-spin 40s linear infinite",
            }}
          />
        </div>

        {/* טבעת הצבעים סביב התצוגה - גרדיאנט חרוטי שמסתובב לאט, כך שנראה
            שהאור **זורם** סביב המסגרת. הטבעת הסטטית נשארת מתחת כגיבוי
            לדפדפנים ישנים שלא תומכים ב-conic-gradient */}
        {/* המסגרת סביב התצוגה. במנוחה - גרדיאנט הצבעים של הסדנה, מסתובב לאט
            מאוד כדי שיהיה נוכח אבל לא מסיח. בזמן הקלטה הוא מתחלף באדום נושם,
            כך שהמצב "מקליטים עכשיו" ברור מכל מקום בחדר. */}
        {status === "recording" ? (
          <div
            className="absolute -inset-[2px] rounded-[2.1rem] bg-record"
            style={{ animation: "rec-ring 2.4s ease-in-out infinite" }}
          />
        ) : (
          <>
            <div
              className="absolute -inset-[3px] rounded-[2.2rem]"
              style={{ background: `linear-gradient(135deg, ${PALETTE[0]}, ${PALETTE[2]}, ${PALETTE[4]})` }}
            />
            <div className="absolute -inset-[3px] overflow-hidden rounded-[2.2rem]">
              <div
                className="absolute top-1/2 left-1/2 aspect-square w-[160%]"
                style={{
                  background: `conic-gradient(${PALETTE.join(", ")}, ${PALETTE[0]})`,
                  animation: "ring-spin 22s linear infinite",
                }}
              />
            </div>
          </>
        )}

        {/* ===== נגן התצוגה המקדימה =====
            בנוי בשפה של נגן וידאו מוכר (יוטיוב): פס אדום שמתמלא, כפתור
            הקלטה עגול, כיתוב (CC) ומסך מלא. המשתתפות מכירות את הסמלים האלה
            מהטלפון, ולכן אין צורך להסביר אותם.

            "מסך מלא" כאן הוא הגדלה ב-CSS (fixed inset-0) ולא Fullscreen API:
            הדף כולו כבר במסך מלא ממצב הקיוסק, ובקשת מסך מלא על אלמנט פנימי
            עלולה להוציא אותו ממנו בדפדפני אנדרואיד ישנים - ראו סעיף 2
            ב-CLAUDE.md. הגדלה ב-CSS נותנת בדיוק את אותה תוצאה בלי הסיכון. */}
        {expanded ? createPortal(playerBox, document.body) : playerBox}

      </div>

      {error && (
        <div className="relative flex max-w-xl flex-col items-center gap-1 rounded-2xl border border-danger/40 bg-danger-fill px-6 py-4">
          <p className="font-bold text-danger">לא הצלחנו לגשת למצלמה</p>
          <p className="text-sm text-ink-3">{error}</p>
        </div>
      )}

      <div className="relative" style={{ animation: "fade-up 0.9s 0.3s ease-out both" }}>
        {status === "idle" && (
          // הכפתור האדום הגדול הוסר לפי בקשת הלקוחה - ההקלטה מתחילה
          // מהכפתור העגול שבסרגל הנגן, כמו בכל נגן וידאו.
          <p className="glass glass-pill text-ink-2 gap-2.5 px-6 py-3 text-lg font-bold">
            <Icon
              name={streamReady ? "record" : "camera"}
              size={18}
              className={streamReady ? "text-record" : "text-accent-soft"}
            />
            {streamReady ? "להקלטה - כפתור ההקלטה האדום בסרגל שמתחת לתצוגה" : "מפעיל מצלמה..."}
          </p>
        )}

        {status === "recording" && (
          <div className="flex items-center gap-4">
            <p className="glass glass-pill text-record gap-2.5 px-6 py-3 text-2xl font-extrabold tabular-nums">
              <span
                aria-hidden="true"
                className="bg-record h-3 w-3 rounded-full"
                style={{ animation: "rec-dot 1.1s ease-in-out infinite" }}
              />
              מקליט... {secondsLeft}
            </p>
            <GlassButton icon="stop" size="lg" onClick={stopRecording}>
              סיימתי
            </GlassButton>
          </div>
        )}

        {status === "review" && (
          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* הקלטה חוזרת = לחיצה שוב על הכפתור האדום בסרגל, בלי כפתור נפרד */}
            <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={handleUpload}>
              שליחה
            </GlassButton>
          </div>
        )}

        {status === "uploading" && (
          <div className="glass glass-pill gap-3 px-6 py-3">
            <Spinner size={22} />
            <p className="text-ink-2 text-xl font-bold">מעלה...</p>
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * סרטון של קבוצה אחת. סדר הניסיונות: קודם העותק המקומי מה-IndexedDB (מיידי,
 * בלי רשת ולכן גם בלי הסינון), ורק אם אין - הכתובת מה-Storage. התצוגה עצמה
 * היא ClipPlayer, אותו נגן בדיוק שמופיע במסך ההקלטה.
 */
/*
  גובה סרטון בצפייה המשותפת: מה שנשאר אחרי הכותרת (כ-25rem) ואחרי הרצועה
  התחתונה שבה יושבים מד ההתקדמות והטיימר (כ-14rem), עד 22rem.
*/
const CLIP_H = "clamp(9rem, calc(100dvh - 39rem), 22rem)";

function GroupClip({
  workshopId,
  groupId,
  url,
  title,
  inProject,
  segments,
}: {
  workshopId: string;
  groupId: string;
  url: string;
  title?: string;
  inProject: boolean;
  segments?: TranscriptSegment[];
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [captionsUrl, setCaptionsUrl] = useState<string | null>(null);

  // הכתוביות נבנות כקובץ WebVTT בזיכרון ומוצמדות לסרטון כ-<track>. ככה הן
  // כתוביות אמיתיות של הנגן - עם כפתור CC משלו - ולא טקסט שמצויר מעל הווידאו.
  useEffect(() => {
    if (!segments || segments.length === 0) {
      setCaptionsUrl(null);
      return;
    }
    const blob = new Blob([segmentsToVtt(segments)], { type: "text/vtt" });
    const objectUrl = URL.createObjectURL(blob);
    setCaptionsUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [segments]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    // סדר העדיפויות: קובץ בתוך הפרויקט (עובר עם התיקייה בין מחשבים), אחר כך
    // עותק בדפדפן הזה, ורק בסוף הענן - שהסינון חוסם את ההורדה ממנו.
    if (inProject) {
      setSrc(projectClipUrl(workshopId, groupId));
      return;
    }

    getLocalClip(clipKey(workshopId, groupId)).then((blob) => {
      if (cancelled) return;
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } else {
        setSrc(url);
      }
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [workshopId, groupId, url, inProject]);

  if (failed) {
    return (
      <div className="glass glass-dim flex h-[min(34vh,22rem)] w-full flex-col items-center justify-center gap-2 rounded-2xl px-4 text-center">
        <Icon name="alert" size={26} className="text-warn" />
        <p className="text-warn text-sm font-bold">הסרטון לא נטען</p>
        <p className="text-ink-3 text-xs">ההקלטה נשמרה, אבל הדפדפן לא הצליח להוריד אותה</p>
      </div>
    );
  }

  if (!src) return <Skeleton className="h-[min(34vh,22rem)] w-full !rounded-2xl" />;

  // נגן ברירת המחדל של הדפדפן, לפי בקשת הלקוחה - חזרה לעיצוב שהיה קודם.
  // בקרות הקול והמסך המלא של הדפדפן זמינות כאן כרגיל.
  return (
    <video
      src={src}
      controls
      playsInline
      preload="metadata"
      title={title}
      onError={() => setFailed(true)}
      // object-cover ממלא את המסגרת: ההקלטה היא 4:3 והמסגרת רחבה יותר, ובלי
      // זה נוספים פסים שחורים בצדדים.
      // הגובה נגזר מהגובה הפנוי (בין הכותרת לפאנלים שבפינות), לא קבוע.
      className="block w-full object-cover"
      style={{ height: CLIP_H }}
    >
      {captionsUrl && <track kind="captions" srcLang="he" label="עברית" src={captionsUrl} default />}
    </video>
  );
}

/**
 * שדה הכוכבים שברקע מסך הצפייה - פרוס על כל שטח המסך ומנצנץ במקום. המיקומים
 * קבועים ולא אקראיים בזמן ריצה, כדי שהכוכבים לא "יקפצו" בכל רינדור מחדש.
 */
const STAR_FIELD: {
  left: number;
  top: number;
  size: number;
  min: number;
  max: number;
  duration: number;
  delay: number;
}[] = [
  { left: 44.7, top: 53.9, size: 13, min: 0.1, max: 0.42, duration: 6.3, delay: 6.4 },
  { left: 46.9, top: 58.9, size: 9, min: 0.07, max: 0.29, duration: 5.6, delay: 6.5 },
  { left: 67.7, top: 6.8, size: 13, min: 0.14, max: 0.37, duration: 9.3, delay: 1.3 },
  { left: 2.9, top: 51.1, size: 7, min: 0.06, max: 0.42, duration: 9.2, delay: 6.2 },
  { left: 32.7, top: 56.8, size: 9, min: 0.1, max: 0.37, duration: 8.5, delay: 5.3 },
  { left: 45.2, top: 28.3, size: 16, min: 0.14, max: 0.41, duration: 10.0, delay: 2.5 },
  { left: 23.4, top: 29.3, size: 7, min: 0.11, max: 0.24, duration: 5.8, delay: 2.3 },
  { left: 7.9, top: 4.5, size: 20, min: 0.06, max: 0.27, duration: 11.4, delay: 3.8 },
  { left: 95.1, top: 39.2, size: 7, min: 0.11, max: 0.27, duration: 9.7, delay: 2.7 },
  { left: 31.2, top: 4.4, size: 13, min: 0.12, max: 0.25, duration: 6.7, delay: 0.8 },
  { left: 7.2, top: 75.5, size: 9, min: 0.11, max: 0.26, duration: 8.6, delay: 7.9 },
  { left: 75.0, top: 41.1, size: 13, min: 0.07, max: 0.32, duration: 6.5, delay: 2.2 },
  { left: 94.2, top: 76.1, size: 11, min: 0.14, max: 0.22, duration: 6.3, delay: 8.0 },
  { left: 59.0, top: 55.5, size: 7, min: 0.14, max: 0.27, duration: 6.8, delay: 6.2 },
  { left: 32.9, top: 30.0, size: 7, min: 0.07, max: 0.27, duration: 9.5, delay: 0.1 },
  { left: 36.7, top: 59.6, size: 9, min: 0.14, max: 0.33, duration: 9.0, delay: 6.9 },
  { left: 19.0, top: 17.0, size: 9, min: 0.13, max: 0.28, duration: 6.3, delay: 5.9 },
  { left: 91.3, top: 20.9, size: 13, min: 0.13, max: 0.36, duration: 8.0, delay: 0.8 },
  { left: 5.2, top: 90.6, size: 9, min: 0.12, max: 0.31, duration: 7.9, delay: 7.2 },
  { left: 48.4, top: 50.3, size: 20, min: 0.14, max: 0.25, duration: 8.4, delay: 5.2 },
  { left: 60.3, top: 9.7, size: 9, min: 0.13, max: 0.27, duration: 5.1, delay: 2.2 },
  { left: 44.1, top: 8.5, size: 9, min: 0.08, max: 0.34, duration: 11.8, delay: 0.7 },
  { left: 14.7, top: 44.0, size: 11, min: 0.11, max: 0.38, duration: 9.1, delay: 1.1 },
  { left: 4.9, top: 4.6, size: 11, min: 0.12, max: 0.44, duration: 5.1, delay: 5.1 },
  { left: 47.6, top: 69.5, size: 11, min: 0.07, max: 0.24, duration: 8.2, delay: 2.9 },
  { left: 5.7, top: 88.2, size: 20, min: 0.12, max: 0.4, duration: 11.4, delay: 2.8 },
  { left: 66.9, top: 85.0, size: 13, min: 0.14, max: 0.23, duration: 8.5, delay: 0.1 },
  { left: 64.7, top: 37.5, size: 7, min: 0.11, max: 0.24, duration: 9.5, delay: 7.9 },
  { left: 85.5, top: 69.3, size: 13, min: 0.13, max: 0.38, duration: 8.2, delay: 3.7 },
  { left: 53.2, top: 50.2, size: 16, min: 0.06, max: 0.36, duration: 8.4, delay: 1.8 },
  { left: 68.2, top: 48.2, size: 16, min: 0.11, max: 0.33, duration: 11.3, delay: 2.9 },
  { left: 15.2, top: 58.7, size: 16, min: 0.07, max: 0.43, duration: 9.6, delay: 3.5 },
  { left: 86.7, top: 32.8, size: 20, min: 0.08, max: 0.37, duration: 10.6, delay: 6.0 },
  { left: 20.6, top: 22.5, size: 9, min: 0.11, max: 0.29, duration: 6.0, delay: 4.0 },
];

/**
 * דירוג בכוכב אחד, בתבנית של "לייק": כל בת בקבוצה לוחצת פעם אחת, והמונה
 * שצמוד לכוכב עולה. מספר הלחיצות המותר למסך הוא מספר המשתתפות שנרשמו
 * בקבוצה שלו (שלב 2) - זה הכלל שקבעה הלקוחה.
 *
 * המספר שמוצג הוא **סך הלייקים מכל המסכים**, כדי שרואים את ההתלהבות של כל
 * החדר מצטברת בזמן אמת. כוכב שעף כלפי מעלה בכל לחיצה נותן את המשוב המיידי,
 * כמו התגובות בזום.
 */
function LikeStar({
  totalLikes,
  myVotes,
  votesLeft,
  onVote,
}: {
  totalLikes: number;
  /** כמה מהבנות של המסך הזה סימנו דווקא את הסרטון הזה */
  myVotes: number;
  /** כמה סימונים נשארו למסך בכל העמוד יחד */
  votesLeft: number;
  onVote: () => void;
}) {
  const [floats, setFloats] = useState<{ id: number; offset: number }[]>([]);
  const full = votesLeft <= 0;

  function like() {
    if (full) return;
    onVote();
    const id = Date.now() + Math.random();
    setFloats((current) => [...current, { id, offset: Math.random() * 50 - 25 }]);
    window.setTimeout(() => setFloats((current) => current.filter((f) => f.id !== id)), 1500);
  }

  return (
    <div className="relative mt-auto flex flex-col items-center gap-1">
      {/* הכוכבים המעופפים - מרחפים מעל הכפתור */}
      <div className="pointer-events-none absolute inset-x-0 bottom-full flex justify-center">
        {floats.map((f) => (
          <span
            key={f.id}
            aria-hidden="true"
            className="text-accent absolute"
            style={{
              marginInlineStart: f.offset,
              filter: "drop-shadow(0 0 10px var(--ds-glow))",
              animation: "star-rise 1.5s ease-out forwards",
            }}
          >
            <Icon name="star" size={30} filled />
          </span>
        ))}
      </div>

      {/* כוכב קו דק, כמו סימון "מועדף" - בלי רקע ובלי מסגרת. הוא נצבע
          בטורקיז ברגע שסימנו, והמונה הקטן יושב לידו ישירות על הסרטון. */}
      <button
        onClick={like}
        disabled={full}
        aria-label={full ? "כל הסימונים נוצלו" : "אהבנו"}
        className={`flex items-center gap-1.5 transition-transform duration-150 ${
          full ? "cursor-not-allowed opacity-70" : "hover:scale-110 active:scale-90"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7"
          fill={myVotes > 0 ? "var(--ds-accent)" : "none"}
          stroke={myVotes > 0 ? "var(--ds-accent)" : "currentColor"}
          strokeWidth={1.6}
          strokeLinejoin="round"
        >
          <path d="M12 3.2l2.62 5.31 5.86.85-4.24 4.13 1 5.84L12 16.58l-5.24 2.75 1-5.84-4.24-4.13 5.86-.85z" />
        </svg>
        <span
          key={totalLikes}
          className="text-base font-bold text-white tabular-nums drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
          style={{ animation: "count-pop 0.35s ease-out" }}
        >
          {totalLikes}
        </span>
      </button>

    </div>
  );
}

function SharedViewing({
  workshopId,
  myGroup,
  allGroups,
  media,
}: {
  workshopId: string;
  myGroup: Group;
  allGroups: Group[];
  media: MediaItem[];
  onAdvance: () => void;
}) {
  const { rows, myVotes, pending, castVote } = useRatings(workshopId, myGroup.id);

  // סך הלייקים לכל קבוצה, מכל המסכים יחד
  const likesByGroup = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of rows) {
      for (const [groupId, votes] of Object.entries(normalizeVotes(row.data))) {
        totals[groupId] = (totals[groupId] ?? 0) + votes.length;
      }
    }
    return totals;
  }, [rows]);
  // מספר הבנות בקבוצה שלנו הוא גם מספר ההצבעות המותר לכל סרטון
  const participants = useParticipants([myGroup.id]);
  // מכסת הסימונים של המסך היא מספר הבנות בקבוצה, ו**לכל העמוד יחד** - לא לכל
  // סרטון בנפרד. כלומר הבנות יכולות לחלק את הסימונים איך שירצו: כולן על אותו
  // סרטון, או מפוזר. אם לא נרשמו משתתפות (בדיקה שדילגה על שלב 2) - סימון אחד,
  // כדי שהמסך לא ייתקע במצב שאי אפשר לדרג בו בכלל.
  const maxVotes = participants.length > 0 ? participants.length : 1;
  const usedVotes = Object.values(myVotes).reduce((sum, votes) => sum + votes.length, 0);
  const votesLeft = Math.max(0, maxVotes - usedVotes);
  const transcripts = useClipTranscripts(workshopId);
  // אילו הקלטות שמורות כקבצים בתוך הפרויקט (ראו src/lib/projectClips.ts)
  const [projectClips, setProjectClips] = useState<string[]>([]);

  useEffect(() => {
    listProjectClips(workshopId).then(setProjectClips);
  }, [workshopId]);


  return (
    <main
      // אותה פריסה כמו StageShell: נעול לגובה המסך ומתחיל מלמעלה (pt-20 -
      // מתחת לסרגל העליון), ולא ממורכז - מרכוז דחף את הסרטונים למטה, אל
      // מתחת למד ההתקדמות ולטיימר שבפינות.
      className="relative flex h-dvh flex-col items-center gap-5 overflow-hidden px-8 pt-20 pb-6 text-center"
    >
      <BackgroundLayers variant="deep" />

      {/* שדה כוכבים על כל המסך - אותו מוטיב של הדירוג, בצבעי הפלטה. הם
          מרחפים לאט מלמטה למעלה בכל רוחב העמוד, בשקיפות נמוכה, כדי שייתנו
          עומק לרקע בלי למשוך את העין מהסרטונים. */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {STAR_FIELD.map((star, i) => (
          <span
            key={`${star.left}-${star.top}`}
            aria-hidden="true"
            className="absolute select-none"
            style={
              {
                insetInlineStart: `${star.left}%`,
                top: `${star.top}%`,
                color: PALETTE[i % PALETTE.length],
                filter: `drop-shadow(0 0 ${star.size / 2}px currentColor)`,
                "--star-min": star.min,
                "--star-max": star.max,
                animation: `star-twinkle ${star.duration}s ${star.delay}s ease-in-out infinite`,
              } as CSSProperties
            }
          >
            <Icon name="star" size={star.size} filled />
          </span>
        ))}
      </div>

      {/* קו צבעים דק בראש העמוד - אותה פלטה של טבעת ההקלטה, כחתימה של השלב */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(90deg, ${PALETTE.join(", ")})`, opacity: 0.55 }}
      />

      <div
        className="relative flex flex-col items-center gap-2"
        style={{ animation: "fade-up 0.7s ease-out both" }}
      >
        <LevelBadge value={7} progress={0.7} size={88} />
        <span className="glass glass-chip text-accent-soft gap-2">
          <Icon name="film" size={15} />
          צפייה משותפת
        </span>
        <ConclusionInHeader />
        <h1 className="glass-title text-3xl sm:text-4xl lg:text-5xl">צפייה משותפת בכל ההסרטות</h1>
        <p className="text-ink-2 text-lg">
          צפו בהקלטות של שאר הקבוצות וסמנו בכוכב את מה שאהבתן.
        </p>
        {/* מונה הסימונים הוא מד ולא רק טקסט: כמה כבר סומן נקרא גם בפס
            שמתמלא, בלי לקרוא את המספר. */}
        <div className="glass glass-pill gap-3 px-5 py-2">
          <Icon name="star" size={16} className="text-accent" filled />
          <span className="text-ink text-sm font-bold">
            {votesLeft > 0
              ? votesLeft === 1
                ? `נותר לכן סימון אחד מתוך ${maxVotes}`
                : `נותרו לכן ${votesLeft} סימונים מתוך ${maxVotes}`
              : maxVotes === 1
                ? "ניצלתן את הסימון שלכן"
                : `ניצלתן את כל ${maxVotes} הסימונים`}
          </span>
          {/* הפס מתמלא ככל שמסמנות (כמו כל פס התקדמות במערכת), ולא
              מתרוקן - פס ריק ליד "ניצלתן הכול" נקרא הפוך. */}
          <span
            className="glass-slider glass-slider--x h-2 w-20"
            style={{ ["--fill" as string]: maxVotes > 0 ? ((maxVotes - votesLeft) / maxVotes) * 100 : 0 }}
          >
            <span className="glass-slider__fill" />
          </span>
        </div>
      </div>

      {/* ריווח תחתון במסך רחב: מד ההתקדמות והטיימר יושבים בפינות התחתונות,
          והסרטונים צריכים להיגמר מעליהם ולא מתחתם. */}
      <div className="relative flex w-full max-w-[108rem] flex-wrap items-start justify-center gap-6">
        {allGroups
          .slice()
          .sort((a, b) => a.screen_number - b.screen_number)
          .map((g, i) => {
            const clip = media.find((m) => m.group_id === g.id);
            const votes = myVotes[g.id] ?? [];
            return (
              <div
                key={g.id}
                className="group flex flex-col gap-2 transition-transform duration-200 hover:-translate-y-1"
                style={{
                  animation: `fade-up 0.8s ${0.15 + i * 0.12}s ease-out both`,
                  // רוחב 16:9 מהגובה של הסרטון (ראו CLIP_H) - כך כל השורה
                  // נגמרת מעל מד ההתקדמות והטיימר שבפינות, וכל הכפתורים נגישים.
                  width: `min(30vw, 32rem, ${CLIP_H} * 16 / 9)`,
                }}
              >
                <p className="text-ink text-2xl font-extrabold">
                  {g.name ?? `מסך ${g.screen_number}`}
                </p>
                {clip ? (
                  <div
                    className="glass glass-raised relative rounded-2xl p-[3px] transition-shadow duration-300 group-hover:shadow-[0_0_46px_-4px_var(--ds-glow)]"
                  >
                    {/* בלי bg-black: הרקע השחור בצבץ בפינות המעוגלות */}
                    <div className="overflow-hidden rounded-[calc(1rem-2px)]">
                      <GroupClip
                    workshopId={workshopId}
                    groupId={g.id}
                    url={clip.url}
                    title={g.name ?? `מסך ${g.screen_number}`}
                        inProject={projectClips.includes(g.id)}
                        segments={transcripts[g.id]}
                      />
                    </div>

                    {/* הדירוג יושב על הסרטון, בשורה של סרגל הנגן וקצת מעליו -
                        ממש ליד סמל הרמקול, כמו סימון מועדף על מדיה. */}
                    <div className="absolute right-[9.5rem] bottom-[1.9rem] z-10">
                      <LikeStar
                        totalLikes={(likesByGroup[g.id] ?? 0) + (pending[g.id]?.length ?? 0)}
                        myVotes={votes.length}
                        votesLeft={votesLeft}
                        onVote={() => castVote(g.id, 1)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="glass glass-dim flex h-[min(34vh,22rem)] w-full flex-col items-center justify-center gap-3 rounded-2xl text-base">
                    <span
                      className="glass glass-icon-btn text-accent-soft"
                      style={{ animation: "soft-pulse 2.2s ease-in-out infinite" }}
                    >
                      <Icon name="record" size={24} />
                    </span>
                    <span className="text-ink-3 font-bold">מקליט...</span>
                  </div>
                )}

                {clip && votes.length > 0 && (
                  <p className="text-xs font-bold text-ink-3">
                    {votes.length === 1 ? "בת אחת מכן סימנה" : `${votes.length} מכן סימנו`}
                  </p>
                )}
              </div>
            );
          })}
      </div>

    </main>
  );
}

function Stage7Simulation({ workshopId, myGroup, allGroups, onAdvance }: Props) {
  const { items: media, loading: mediaLoading } = useMedia(workshopId, 7);
  const [myClipReady, setMyClipReady] = useState(false);
  const allReady = allGroups.every((g) => media.some((m) => m.group_id === g.id));

  const myClipExists = media.some((m) => m.group_id === myGroup.id);

  // ממתינים לשליפה הראשונה לפני שמחליטים איזה מסך להציג. בלי זה הרשימה
  // ריקה לרגע, מסך ההוראות נפתח, ומיד כשהנתונים מגיעים הוא מוחלף - מה
  // שנראה כאילו השקופית "נעלמה אחרי שנייה".
  if (mediaLoading) {
    return <LoadingState title="רגע אחד" description="טוען..." />;
  }

  if (!myClipExists && !myClipReady) {
    return (
      <SolutionAndRecord
        workshopId={workshopId}
        myGroup={myGroup}
        onDone={() => setMyClipReady(true)}
      />
    );
  }

  // מסך ההמתנה להקלטות. קודם הוא היה שורת כותרת ושלוש שורות עם אמוג'י,
  // וזה המסך שקבוצה שסיימה ראשונה תבהה בו הכי הרבה זמן בכל הסדנה - לכן
  // הוא מקבל את אותו טיפול כמו שער הסנכרון: מד התקדמות מפורש וכרטיס
  // לכל קבוצה, כדי שההמתנה תיראה כמו החדר עובד ולא כמו מסך תקוע.
  if (!allReady) {
    const sorted = allGroups.slice().sort((a, b) => a.screen_number - b.screen_number);
    const doneCount = sorted.filter((g) => media.some((m) => m.group_id === g.id)).length;

    return (
      <StageShell
        stage={7}
        kicker="סימולציות"
        icon="film"
        title="ממתינים לשאר ההקלטות"
        subtitle="ההקלטה שלכן נשמרה. הצפייה המשותפת תתחיל כשכל הקבוצות יסיימו."
        background="ripple"
      >
        <div className="glass glass-brick mb-8 flex w-full max-w-md flex-col gap-3 rounded-xl p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-ink-2 text-sm font-bold">הקלטות שהושלמו</span>
            <span className="text-accent text-2xl font-extrabold tabular-nums">
              {doneCount}
              <span className="text-ink-3 text-base"> / {sorted.length}</span>
            </span>
          </div>
          <div
            className="glass-slider glass-slider--x h-3"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={sorted.length}
            style={{
              ["--fill" as string]:
                sorted.length > 0 ? (doneCount / sorted.length) * 100 : 0,
            }}
          >
            <span className="glass-slider__fill" />
          </div>
        </div>

        <ul className="flex w-full flex-wrap justify-center gap-4">
          {sorted.map((g, i) => {
            const done = media.some((m) => m.group_id === g.id);
            return (
              <li
                key={g.id}
                className="glass glass-brick flex w-56 flex-col items-center gap-3 rounded-xl p-5 text-center"
                style={{
                  animation: `glass-in var(--ds-dur-slow) ${140 + i * 110}ms var(--ds-ease) both`,
                }}
              >
                <span
                  className={done ? "glass glass-icon-btn glass-active" : "glass glass-icon-btn text-ink-3"}
                  style={done ? undefined : { animation: "soft-pulse 2.2s ease-in-out infinite" }}
                >
                  <Icon name={done ? "check" : "record"} size={26} />
                </span>
                <span className="text-ink text-lg font-extrabold">
                  {g.name ?? `מסך ${g.screen_number}`}
                </span>
                <span className={done ? "text-ok text-xs font-bold" : "text-ink-3 text-xs font-bold"}>
                  {done ? "ההקלטה נשמרה" : "מקליט..."}
                </span>
              </li>
            );
          })}
        </ul>
      </StageShell>
    );
  }

  return (
    <SharedViewing
      workshopId={workshopId}
      myGroup={myGroup}
      allGroups={allGroups}
      media={media}
      onAdvance={onAdvance}
    />
  );
}

export default Stage7Simulation;
