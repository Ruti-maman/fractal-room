import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { useMedia } from "../../hooks/useMedia";
import { useRatings } from "../../hooks/useRatings";
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

const RECORD_SECONDS = 10;

/** פלטת הצבעים של הסדנה - אותה פלטה שמשמשת את שעון החול בשלב 6. */
const PALETTE = ["#6fcf7e", "#9ed75b", "#5bc0eb", "#f5a25d", "#f07b7b"];

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
            <stop offset="55%" stopColor="#5bc0eb" stopOpacity={0.12} />
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
        <circle cx="100" cy="100" r="9" fill="#f07b7b"
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
  const [status, setStatus] = useState<"idle" | "recording" | "uploading" | "error">("idle");
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
    recorder.onstop = handleUpload;
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

  if (phase === "solution") {
    const inputDelay = (SIMULATION_STEPS.length + 1) * STEP_DELAY_SECONDS;

    return (
      <main
        className="relative flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden px-8 py-12 text-center"
        style={{
          background:
            "radial-gradient(circle at 50% 12%, var(--color-smoke-blue) 0%, var(--color-smoke-blue-dark) 62%, var(--color-smoke-blue-darker) 100%)",
        }}
      >
        <style>{`
          @keyframes step-in {
            from { opacity: 0; transform: translateY(22px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* כתמי אור רכים - בלי עיגולים מסתובבים, לפי בקשת הלקוחה */}
        <div className="pointer-events-none absolute top-[-12%] right-[8%] h-96 w-96 rounded-full bg-wood-light/10 blur-[110px]" />
        <div className="pointer-events-none absolute bottom-[-16%] left-[6%] h-96 w-96 rounded-full bg-smoke-blue/25 blur-[120px]" />

        <div className="relative flex flex-col items-center gap-3" style={{ animation: "fade-up 0.7s ease-out both" }}>
          <span className="rounded-full border border-white/15 bg-white/5 px-5 py-1.5 text-xs font-bold tracking-widest text-white/50 uppercase">
            שלב 7 · סימולציות
          </span>
          <h1 className="text-4xl font-black tracking-tight">הוראות לעריכת הסימולציה</h1>
        </div>

        {/* העדשה - הלב החזותי, כמו שעון החול בשלב 6 */}
        <div className="relative" style={{ animation: "fade-up 0.9s 0.15s ease-out both" }}>
          <RecordingLens />
        </div>

        {/* ההוראות נחשפות אחת אחרי השנייה */}
        <ol className="relative flex w-full max-w-2xl flex-col gap-4 text-right">
          {SIMULATION_STEPS.map((step, i) => (
            <li
              key={i}
              className="flex items-center gap-4"
              style={{ animation: `step-in 0.6s ${(i + 1) * STEP_DELAY_SECONDS}s cubic-bezier(0.22, 1, 0.36, 1) both` }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black"
                style={{ borderColor: step.color, color: step.color }}
              >
                {i + 1}
              </span>
              <span className="text-xl font-bold text-white/90">{step.text}</span>
            </li>
          ))}
        </ol>

        <div
          className="relative w-full max-w-2xl"
          style={{ animation: `step-in 0.7s ${inputDelay}s cubic-bezier(0.22, 1, 0.36, 1) both` }}
        >
          <p className="mb-3 text-sm font-bold text-white/50">הקלידו את הפתרון שגיבשתם</p>
          <textarea
            className="focus:border-wood-light/60 h-28 w-full rounded-2xl border border-white/15 bg-black/25 p-5 text-lg text-white shadow-inner shadow-black/40 outline-none placeholder:text-white/30"
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            placeholder="הקלידו כאן..."
          />
        </div>

        <button
          className="group relative flex w-full max-w-2xl items-center justify-center gap-3 rounded-full bg-white/10 px-8 py-5 text-xl font-bold transition-all duration-200 hover:bg-white/15 active:scale-95 disabled:opacity-40"
          style={{ animation: `step-in 0.7s ${inputDelay + 0.35}s cubic-bezier(0.22, 1, 0.36, 1) both` }}
          onClick={handleSaveSolution}
          disabled={!solution.trim()}
        >
          המשך להקלטה
          <span className="transition-transform duration-200 group-hover:-translate-x-1" aria-hidden="true">
            ←
          </span>
        </button>
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
            className={`overflow-hidden border border-white/10 bg-black shadow-[0_40px_90px_-25px_rgba(0,0,0,0.9)] ${
              expanded ? "fixed inset-0 z-50 rounded-none" : "relative rounded-[2rem]"
            }`}
          >
            <video
              ref={attachVideo}
              autoPlay
              muted
              playsInline
              className={expanded ? "h-full w-full object-contain" : "h-[min(58vh,38rem)] w-[min(86vw,68rem)] object-cover"}
              style={mirrored ? { transform: "scaleX(-1)" } : undefined}
            />

            {/* כיתוב - הפתרון שהקבוצה הקלידה במסך הקודם, בסגנון כתוביות של סרט:
                טקסט לבן על רצועה כהה בתחתית המסך. בזמן ההקלטה הוא משמש כטלפרומפטר,
                ולכן הוא גדול ומרווח - צריך להיות קריא ממרחק של כמה מטרים. */}
            {showCaption && (liveCaption !== "" || solution.trim() !== "") && (
              <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center px-12">
                <p className="max-w-[80%] rounded-xl bg-black/75 px-6 py-3 text-center text-2xl leading-relaxed font-bold text-white backdrop-blur-[2px]">
                  {/* בזמן הקלטה מוצג מה שנאמר עכשיו; לפניה ואחריה - הפתרון שהוקלד,
                      שמשמש כטלפרומפטר. */}
                  {liveCaption !== "" ? liveCaption : solution}
                </p>
              </div>
            )}

            {/* חיווי קטן שהכתוביות החיות מאזינות - כדי שיהיה ברור שהטקסט זז
                כי מדברים, ולא סתם. */}
            {status === "recording" && captionState === "listening" && (
              <div className="pointer-events-none absolute top-5 left-5 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-bold text-white/80">
                <span className="h-2 w-2 rounded-full bg-[#6fcf7e]" style={{ animation: "rec-dot 1.4s ease-in-out infinite" }} />
                כתוביות חיות
              </div>
            )}

            {/* סרגל השליטה. dir="ltr" בכוונה - סדר הכפתורים בנגן וידאו זהה בכל
                השפות, וזו בדיוק ה"חתימה" החזותית שמזהים מיד. שאר המסך נשאר RTL. */}
            <div
              dir="ltr"
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-6 pt-24 pb-5"
            >
              {/* ציר הזמן - הרוחב מצויר ישירות ב-requestAnimationFrame (ראו
                  ה-effect למעלה), ולכן הוא זוחל ברציפות ולא קופץ פעם בשנייה. */}
              <div className="relative mx-1 h-2 rounded-full bg-white/20">
                <div ref={barRef} className="h-full w-0 rounded-full bg-[#ff2d2d]" />
                <span
                  ref={knobRef}
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff2d2d] shadow-md transition-opacity duration-200"
                  style={{ left: "0%", opacity: status === "recording" ? 1 : 0 }}
                />
              </div>

              <div className="mt-3 flex items-center gap-3">
                {/* הקלטה / עצירה */}
                <button
                  type="button"
                  onClick={status === "recording" ? stopRecording : startRecording}
                  disabled={!streamReady || status === "uploading" || status === "error"}
                  title={status === "recording" ? "עצרי הקלטה" : "התחילי הקלטה"}
                  aria-label={status === "recording" ? "עצרי הקלטה" : "התחילי הקלטה"}
                  className="flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-150 hover:bg-white/12 active:scale-90 disabled:opacity-40"
                >
                  {status === "recording" ? (
                    <span className="h-5 w-5 rounded-[3px] bg-white" />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-[#ff2d2d] shadow-[0_0_12px_rgba(255,45,45,0.9)]" />
                  )}
                </button>

                <span className="text-base font-bold text-white/90 tabular-nums">
                  <span ref={elapsedRef}>{fmtTime(0)}</span> / {fmtTime(RECORD_SECONDS)}
                </span>

                {/* מד קליטת המיקרופון - חמישה פסים שמתמלאים לפי העוצמה */}
                <span className="flex items-center gap-2 px-2" title={micSilent ? "המיקרופון לא קולט" : "קליטת מיקרופון"}>
                  <svg viewBox="0 0 24 24" className={`h-5 w-5 ${micSilent ? "text-[#ff8a8a]" : "text-white/70"}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  </svg>
                  <span className="flex items-end gap-[3px]">
                    {[0.06, 0.14, 0.26, 0.42, 0.6].map((threshold, i) => (
                      <span
                        key={threshold}
                        className={`w-[3px] rounded-full transition-colors duration-75 ${
                          micLevel > threshold ? "bg-[#6fcf7e]" : "bg-white/20"
                        }`}
                        style={{ height: 6 + i * 3 }}
                      />
                    ))}
                  </span>
                </span>

                {status === "recording" && (
                  <span className="flex items-center gap-2 rounded-full bg-[#ff2d2d]/20 px-3 py-1 text-sm font-black text-[#ff8a8a]">
                    <span
                      className="h-2.5 w-2.5 rounded-full bg-[#ff2d2d]"
                      style={{ animation: "rec-dot 1.1s ease-in-out infinite" }}
                    />
                    REC
                  </span>
                )}

                <div className="flex-1" />

                <PlayerButton label="תצוגת מראה" active={mirrored} onClick={() => setMirrored((m) => !m)}>
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v18" strokeDasharray="3 3" />
                    <path d="M9 7 3.5 12 9 17z" />
                    <path d="M15 7l5.5 5L15 17z" />
                  </svg>
                </PlayerButton>

                <PlayerButton
                  label="כיתוב"
                  active={showCaption}
                  onClick={() => setShowCaption((c) => !c)}
                >
                  <span className="text-base font-black tracking-tight">CC</span>
                </PlayerButton>

                <PlayerButton
                  label={expanded ? "יציאה ממסך מלא" : "מסך מלא"}
                  active={expanded}
                  onClick={() => setExpanded((e) => !e)}
                >
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    {expanded ? (
                      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                    ) : (
                      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                    )}
                  </svg>
                </PlayerButton>
              </div>
            </div>
          </div>
  );

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-8 py-8 text-center"
      style={{
        background:
          "radial-gradient(circle at 50% 12%, var(--color-smoke-blue) 0%, var(--color-smoke-blue-dark) 62%, var(--color-smoke-blue-darker) 100%)",
      }}
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
          0%, 100% { opacity: 0.85; box-shadow: 0 0 18px 2px rgba(255,45,45,0.35); }
          50% { opacity: 1; box-shadow: 0 0 34px 6px rgba(255,45,45,0.55); }
        }
        @keyframes ring-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>

      {/* כתמי אור מטושטשים בפינות - קו העיצוב הקבוע של כל מסכי הסדנה */}
      <div className="pointer-events-none absolute top-[-12%] right-[8%] h-96 w-96 rounded-full bg-wood-light/10 blur-[110px]" />
      <div className="pointer-events-none absolute bottom-[-16%] left-[6%] h-96 w-96 rounded-full bg-smoke-blue/25 blur-[120px]" />

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
        <span className="rounded-full border border-white/15 bg-white/5 px-5 py-1.5 text-xs font-bold tracking-widest text-white/50 uppercase">
          שלב 7 · הקלטה
        </span>
        <h1 className="text-3xl font-black tracking-tight">היכונו להקלטה מול המצלמה</h1>
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
            className="absolute -inset-[2px] rounded-[2.1rem] bg-[#ff2d2d]"
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

      {micSilent && !error && (
        <div className="relative flex max-w-2xl flex-col items-center gap-1 rounded-2xl border border-[#f5a25d]/50 bg-[#f5a25d]/10 px-6 py-3 text-center">
          <p className="font-bold text-[#f5a25d]">המיקרופון לא קולט קול</p>
          <p className="text-sm text-white/60">
            אפשר להקליט, אבל הסרטון יישמר בלי סאונד. כדאי לבדוק את הגדרות המיקרופון של המחשב
            ואת ההרשאה שניתנה לדפדפן.
          </p>
        </div>
      )}

      {error && (
        <div className="relative flex max-w-xl flex-col items-center gap-1 rounded-2xl border border-[#f07b7b]/40 bg-[#f07b7b]/10 px-6 py-4">
          <p className="font-bold text-[#ff9bae]">לא הצלחנו לגשת למצלמה</p>
          <p className="text-sm text-white/50">{error}</p>
        </div>
      )}

      <div className="relative" style={{ animation: "fade-up 0.9s 0.3s ease-out both" }}>
        {status === "idle" && (
          // הכפתור האדום הגדול הוסר לפי בקשת הלקוחה - ההקלטה מתחילה
          // מהכפתור העגול שבסרגל הנגן, כמו בכל נגן וידאו.
          <p className="text-lg font-bold text-white/60">
            {streamReady ? "לחצי על כפתור ההקלטה האדום בסרגל שמתחת לתצוגה" : "מפעילה מצלמה..."}
          </p>
        )}

        {status === "recording" && (
          <div className="flex items-center gap-5">
            <p className="text-2xl font-black text-[#ff9bae]">מקליטה... {secondsLeft}</p>
            <button
              className="flex items-center gap-3 rounded-full border-2 border-white/25 px-8 py-4 text-lg font-bold text-white transition-colors duration-150 hover:bg-white/10 active:scale-95"
              onClick={stopRecording}
            >
              <span className="h-4 w-4 rounded-[3px] bg-white" />
              סיימתי
            </button>
          </div>
        )}

        {status === "uploading" && (
          <div className="flex items-center gap-3">
            <div className="border-t-wood-light h-6 w-6 animate-spin rounded-full border-2 border-white/20" />
            <p className="text-xl font-bold text-white/80">מעלה את ההקלטה...</p>
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
      <div className="flex h-40 w-full flex-col items-center justify-center gap-1 rounded-lg bg-black/40 px-3 text-center">
        <p className="text-sm font-bold text-[#ff9bae]">הסרטון לא נטען</p>
        <p className="text-xs text-white/50">ההקלטה נשמרה, אבל הדפדפן לא הצליח להוריד אותה</p>
      </div>
    );
  }

  if (!src) return <div className="h-40 w-full animate-pulse rounded-lg bg-black/40" />;

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
      className="h-40 w-full rounded-lg bg-black"
    >
      {captionsUrl && <track kind="captions" srcLang="he" label="עברית" src={captionsUrl} default />}
    </video>
  );
}

function SharedViewing({
  workshopId,
  myGroup,
  allGroups,
  media,
  onAdvance,
}: {
  workshopId: string;
  myGroup: Group;
  allGroups: Group[];
  media: MediaItem[];
  onAdvance: () => void;
}) {
  const { myRatings, rate } = useRatings(workshopId, myGroup.id);
  const transcripts = useClipTranscripts(workshopId);
  // אילו הקלטות שמורות כקבצים בתוך הפרויקט (ראו src/lib/projectClips.ts)
  const [projectClips, setProjectClips] = useState<string[]>([]);

  useEffect(() => {
    listProjectClips(workshopId).then(setProjectClips);
  }, [workshopId]);


  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-bold">צפייה משותפת בכל ההסרטות</h1>

      <div className="flex flex-wrap justify-center gap-6">
        {allGroups
          .slice()
          .sort((a, b) => a.screen_number - b.screen_number)
          .map((g) => {
            const clip = media.find((m) => m.group_id === g.id);
            const myStars = myRatings[g.id] ?? 0;
            return (
              <div key={g.id} className="w-64 rounded-xl bg-white/10 p-4">
                <div className="mb-2 font-bold">{g.name ?? `מסך ${g.screen_number}`}</div>
                {clip ? (
                  <GroupClip
                    workshopId={workshopId}
                    groupId={g.id}
                    url={clip.url}
                    title={g.name ?? `מסך ${g.screen_number}`}
                    inProject={projectClips.includes(g.id)}
                    segments={transcripts[g.id]}
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center rounded-lg bg-black/40 text-sm text-white/50">
                    עדיין מקליטה...
                  </div>
                )}
                <div className="mt-2 flex justify-center gap-1 text-2xl">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => rate(g.id, n)}>
                      {n <= myStars ? "★" : "☆"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      <button
        className="bg-smoke-blue active:bg-smoke-blue-dark rounded-xl px-10 py-5 text-xl font-bold active:scale-90"
        onClick={onAdvance}
      >
        הבא
      </button>
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
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{
          background:
            "radial-gradient(circle at 50% 12%, var(--color-smoke-blue) 0%, var(--color-smoke-blue-dark) 62%, var(--color-smoke-blue-darker) 100%)",
        }}
      >
        <div className="border-t-wood-light h-10 w-10 animate-spin rounded-full border-4 border-white/20" />
      </main>
    );
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

  if (!allReady) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold">ממתינים שכל הקבוצות יסיימו להקליט...</h1>
        <div className="flex flex-col gap-2">
          {allGroups
            .slice()
            .sort((a, b) => a.screen_number - b.screen_number)
            .map((g) => (
              <div key={g.id}>
                {media.some((m) => m.group_id === g.id) ? "✅" : "⏳"} {g.name ?? `מסך ${g.screen_number}`}
              </div>
            ))}
        </div>
      </main>
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
