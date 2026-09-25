import AnimatedHourglass from "../AnimatedHourglass";
import type { Stage6Content } from "../../types/stage6Content";

/**
 * עיגולים דקורטיביים ברקע - בדיוק אותה צורה של אייקוני מצב-הרוח ברפרנס:
 * עיגול בקו דק, שקוף מבפנים, בצבע אחד. הם מסתובבים סביב מרכז הדף בשתי
 * שכבות הפוכות ובקצב שונה, כך שהתנועה מרגישה אורגנית ולא מכנית.
 * radius באחוזים מגודל השכבה, angle במעלות.
 */
const ORBIT_INNER = [
  { size: 90, radius: 26, angle: 15, color: "#6fcf7e" },
  { size: 58, radius: 30, angle: 62, color: "#9ed75b" },
  { size: 76, radius: 28, angle: 118, color: "#5bc0eb" },
  { size: 44, radius: 32, angle: 168, color: "#f07b7b" },
  { size: 120, radius: 24, angle: 218, color: "#f5a25d" },
  { size: 52, radius: 33, angle: 262, color: "#6fcf7e" },
  { size: 70, radius: 31, angle: 300, color: "#f07b7b" },
  { size: 38, radius: 29, angle: 340, color: "#9ed75b" },
];

const ORBIT_OUTER = [
  { size: 150, radius: 40, angle: 55, color: "#9ed75b" },
  { size: 72, radius: 44, angle: 100, color: "#6fcf7e" },
  { size: 96, radius: 43, angle: 145, color: "#f07b7b" },
  { size: 54, radius: 46, angle: 192, color: "#f5a25d" },
  { size: 190, radius: 38, angle: 240, color: "#5bc0eb" },
  { size: 80, radius: 45, angle: 288, color: "#9ed75b" },
  { size: 110, radius: 42, angle: 330, color: "#6fcf7e" },
  { size: 64, radius: 45, angle: 10, color: "#f5a25d" },
];

/** שכבה שלישית, רחוקה וזעירה - נותנת עומק בלי להעמיס. */
const ORBIT_FAR = [
  { size: 30, radius: 54, angle: 35, color: "#5bc0eb" },
  { size: 42, radius: 52, angle: 95, color: "#f07b7b" },
  { size: 26, radius: 56, angle: 160, color: "#9ed75b" },
  { size: 38, radius: 53, angle: 215, color: "#f5a25d" },
  { size: 30, radius: 55, angle: 275, color: "#6fcf7e" },
  { size: 46, radius: 51, angle: 320, color: "#5bc0eb" },
];

/** שכבת עיגולים אחת שמסתובבת כולה סביב מרכז הדף. */
function OrbitLayer({
  circles,
  duration,
  reverse = false,
}: {
  circles: { size: number; radius: number; angle: number; color: string }[];
  duration: number;
  reverse?: boolean;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ animation: `orbit-spin ${duration}s linear infinite${reverse ? " reverse" : ""}` }}
    >
      {circles.map((c, i) => {
        const rad = (c.angle * Math.PI) / 180;
        return (
          <div
            key={i}
            className="absolute rounded-full border-2"
            style={{
              height: c.size,
              width: c.size,
              borderColor: c.color,
              opacity: 0.22,
              left: `calc(50% + ${Math.cos(rad) * c.radius}% - ${c.size / 2}px)`,
              top: `calc(50% + ${Math.sin(rad) * c.radius}% - ${c.size / 2}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

interface Props {
  content: Stage6Content;
  onAdvance: () => void;
}

/**
 * שלב 6 - דיון קבוצתי מונחה (שקף 10 במצגת). שלב עצמאי ופשוט מבחינת מנגנון:
 * משפט השראה (מה-DB) + שעון חול, והדיון עצמו מתנהל בעל-פה בחדר ולא במסך.
 *
 * קו העיצוב לפי הרפרנס שהלקוחה שלחה: **קווים דקים, צורות רכות ופלטת
 * הצבעים הידידותית** משם (תכלת, ירוק, כתום, אלמוג) - בלי זוהר נאון ובלי
 * מסגרות כבדות. הרקע עצמו נשאר הכהה של שאר השקופיות, לפי בקשתה המפורשת,
 * כך שהשלב משתלב עם הסדנה ורק השפה הגרפית התרעננה.
 *
 * הפריסה לפי בקשת הלקוחה: המשפט למעלה, ורוב הדף הוא שעון החול המרכזי.
 */
function Stage6Discussion({ content }: Props) {
  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden px-8 py-12 text-center"
      style={{
        background:
          "radial-gradient(circle at 50% 15%, var(--color-smoke-blue) 0%, var(--color-smoke-blue-dark) 45%, var(--color-smoke-blue-darker) 100%)",
      }}
    >
      <style>{`
        @keyframes orbit-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* קרני אור שיוצאות מהשעון - conic-gradient של פסי אור, מרוכך
          ב-mask רדיאלי כך שהקרניים נמוגות לקצוות במקום להיחתך בריבוע.
          מסתובב לאט מאוד, כך שהאור "נושם" סביב השעון. */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 h-[70rem] w-[70rem] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.055) 7deg, transparent 16deg, transparent 45deg, rgba(91,192,235,0.05) 52deg, transparent 62deg, transparent 90deg, rgba(255,255,255,0.045) 97deg, transparent 106deg, transparent 140deg, rgba(158,215,91,0.045) 147deg, transparent 156deg, transparent 190deg, rgba(255,255,255,0.05) 197deg, transparent 206deg, transparent 240deg, rgba(245,162,93,0.045) 247deg, transparent 256deg, transparent 290deg, rgba(255,255,255,0.05) 297deg, transparent 306deg, transparent 340deg, rgba(240,123,123,0.045) 347deg, transparent 356deg)",
          WebkitMaskImage: "radial-gradient(circle, #000 12%, rgba(0,0,0,0.6) 38%, transparent 68%)",
          maskImage: "radial-gradient(circle, #000 12%, rgba(0,0,0,0.6) 38%, transparent 68%)",
          animation: "orbit-spin 90s linear infinite",
        }}
      />

      {/* עיגולים בקו דק שמסתובבים סביב מרכז הדף, בשלוש שכבות בקצב שונה */}
      <OrbitLayer circles={ORBIT_FAR} duration={110} />
      <OrbitLayer circles={ORBIT_OUTER} duration={70} />
      <OrbitLayer circles={ORBIT_INNER} duration={48} reverse />

      {/* כתמי פסטל רכים מאוד ברקע - נותנים חיים בלי להכביד */}
      <div className="pointer-events-none absolute top-[-14%] left-[-6%] h-[30rem] w-[30rem] rounded-full bg-[#5bc0eb]/12 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-8%] bottom-[-16%] h-[32rem] w-[32rem] rounded-full bg-[#f5a25d]/10 blur-[130px]" />

      {/* המשפט למעלה */}
      <div
        className="relative flex w-full max-w-3xl flex-col items-center gap-5"
        style={{ animation: "fade-up 0.7s ease-out both" }}
      >
        <span className="rounded-full border border-[#5bc0eb]/40 px-5 py-1.5 text-xs font-bold tracking-widest text-[#5bc0eb] uppercase">
          שלב 6 · זמן דיון קבוצתי מונחה
        </span>

        <p className="text-3xl leading-relaxed font-bold text-white/95">{content.quote}</p>
      </div>

      {/* שעון החול - הלב של השקף */}
      <div
        className="relative flex flex-1 items-center justify-center py-6"
        style={{ animation: "fade-up 0.9s 0.15s ease-out both" }}
      >
        <AnimatedHourglass />
      </div>

      <div
        className="relative flex flex-col items-center gap-7"
        style={{ animation: "fade-up 0.9s 0.3s ease-out both" }}
      >
        <p className="text-sm text-white/45">הדיון מהווה את הבסיס המקדים לשלב הסימולציות הבא.</p>

      </div>
    </main>
  );
}

export default Stage6Discussion;
