/**
 * שעון חול מונפש - SVG/CSS טהור, בלי שום ספרייה חיצונית (אילוץ הסינון,
 * סעיף 2 ב-CLAUDE.md) ובלי תמונה: החול באמת יורד.
 *
 * שפת העיצוב לפי הרפרנס שהלקוחה שלחה (אייקוני מצב-הרוח): קו דק ואחיד הוא
 * הגיבור, הפנים כמעט שקופים, קצוות מעוגלים, וכל חמשת צבעי הפלטה נוכחים -
 * אבל **כמעבר רך ורציף** ולא כגושי צבע נפרדים: גרדיאנט אחד משותף
 * (userSpaceOnUse) פרוס על כל גובה השעון, וכל אלמנט דוגם ממנו את הצבע לפי
 * מיקומו.
 *
 * מה שנותן את תחושת התלת-ממד בלי לשבור את הקו הנקי:
 * - **שפות אליפטיות** למעלה ולמטה, עם שפה פנימית שנייה שנותנת עובי, וכל
 *   שפה מצוירת פעמיים: חלשה במלואה (הדופן הרחוקה שנראית דרך הזכוכית)
 *   וחזקה בחצי הקרוב בלבד. זה הרמז החזק ביותר לנפח גלילי.
 * - **נצנוץ ספקולרי** בפינה העליונה-שמאלית, והצללה שמתחזקת לצד הנגדי.
 * - **פני החול הם אליפסה** שמתכווצת ויורדת - משטח אופקי שנראה בפרספקטיבה,
 *   וזה מה שהופך את החול מכתם שטוח לנפח אמיתי בתוך הכלי.
 * - **הצללה עדינה** בצד אחד של כל תא, ו**צל על הרצפה** מתחת לשעון.
 *
 * ומה שגורם לזרימה להיראות אמיתית ולא כמו מד-טעינה:
 * - **גומה** שמעמיקה למעלה (החול נשאב מהמרכז) ו**תלולית** שנערמת למטה.
 * - הצורות ממורפות ב-SMIL (animate על d), כי רק כך אפשר להזיז קו פני-שטח
 *   *מעוקם* בצורה חלקה. הצורה מצוירת רחבה מהתא ו-clipPath חותך אותה לצורת
 *   הזכוכית, כך שהנתיב לא צריך לעקוב אחרי הדפנות בעצמו.
 *
 * תזמון: החול מסיים לרדת ב-86% מהמחזור וההיפוך מתחיל **מיד אחריו** (87%),
 * כך שהשעון אף פעם לא מתהפך כשעוד יש בו חול בשני התאים.
 *
 * ה-viewBox רחב בהרבה מהשעון עצמו בכוונה: בזמן הסיבוב האובייקט "יוצא"
 * מהמלבן הצר שלו, ובלי המרווח הזה הוא נחתך משני הצדדים בדיוק באמצע
 * ההיפוך. המרווח מחושב לפי המרחק מציר הסיבוב (100,150) לפינה הרחוקה.
 *
 * ההיפוך עצמו: אין איפוס של החול. הסיבוב ב-180 מעלות עושה את העבודה בעצמו -
 * התא המלא שהיה למטה נמצא אחרי הסיבוב למעלה, בדיוק כמו במציאות. לכן גם אין
 * "קפיצה" בלולאה: הפריים שלפני הסוף זהה לפריים הראשון.
 */

const CYCLE_SECONDS = 9;

/**
 * סולם הטורקיז של לבנת הזכוכית, מהפנים המואר שלה ועד לקצה העבה - אותם
 * חמישה ערכים שנדגמו ב-styles/tokens.css. מוגדר פעם אחת כאן ומשמש את כל
 * חלקי השעון: הגרדיאנט של החול, הקווים והגרגרים.
 *
 * הסדר הוא בהיר -> כהה, והגרדיאנט פרוס על גובה השעון, כך שהחול נראה כמו
 * נוזל זכוכית שמתעבה כלפי מטה במקום כמו חמישה פסי צבע.
 *
 * (הערכים כתובים כאן ולא נקראים מהטוקנים כי SVG gradient מקבל צבע ולא
 * var(), ומכאן הם נצרכים בתוך מחרוזות אנימציה.)
 */
const PALETTE = ["#f4c7bc", "#f3846e", "#f26a50", "#c8955f", "#283d5b"];

/** גרגרים בזרם - ערכים קבועים ולא אקראיים, שלא יתאפסו בכל רינדור. */
const GRAINS = [
  { x: 100, delay: 0, dur: 1.05, r: 1.5, color: PALETTE[2] },
  { x: 98.8, delay: 0.24, dur: 0.95, r: 1.1, color: PALETTE[0] },
  { x: 101.2, delay: 0.42, dur: 1.15, r: 1.3, color: PALETTE[3] },
  { x: 99.6, delay: 0.62, dur: 1, r: 1, color: PALETTE[1] },
  { x: 100.5, delay: 0.8, dur: 1.1, r: 1.35, color: PALETTE[4] },
];

/** נקודות הזמן של כל האנימציות - החול נגמר ב-86%, ההיפוך מיד אחריו. */
const KEY_TIMES = "0;0.45;0.86;1";

interface Props {
  className?: string;
}

function AnimatedHourglass({ className = "h-[34rem] w-auto" }: Props) {
  const dur = `${CYCLE_SECONDS}s`;

  const TOP_BULB = "M42 38 C42 100 88 130 97 150 L103 150 C112 130 158 100 158 38 Z";
  const BOTTOM_BULB = "M42 262 C42 200 88 170 97 150 L103 150 C112 170 158 200 158 262 Z";

  return (
    <div className="relative flex items-center justify-center">
      <style>{`
        @keyframes hgl-fall {
          0% { transform: translateY(0); opacity: 0; }
          12% { opacity: 1; }
          88% { opacity: 1; }
          100% { transform: translateY(100px); opacity: 0; }
        }
      `}</style>

      {/* הילה רכה מאחורי השעון - בטורקיז של הפלטה ולא בתכלת הישן */}
      <div
        className="pointer-events-none absolute h-[34rem] w-[34rem] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.12) 0%, var(--ds-glow-soft) 42%, transparent 72%)",
          animation: "soft-pulse 9s ease-in-out infinite",
        }}
      />

      {/*
        הבסיס שעליו השעון עומד.

        בלעדיו השעון פשוט ריחף באמצע הדף כמו איור מודבק. אליפסה אחת
        בפרספקטיבה מספיקה כדי שהעין תקרא "חפץ שמונח על משטח", וזה גם מה
        שמחבר אותו לשאר הסדנה: הבסיס עשוי מאותה זכוכית כמו כל השאר.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[3%] flex w-[46%] flex-col items-center"
      >
        {/* ברכת האור שמתחת לשעון - כאילו הוא מאיר על המשטח */}
        <div
          className="h-10 w-full rounded-[50%] blur-xl"
          style={{ background: "var(--ds-glow-soft)" }}
        />
        {/* משטח הזכוכית עצמו */}
        <div
          className="-mt-7 h-6 w-[78%] rounded-[50%]"
          style={{
            background:
              "linear-gradient(180deg, var(--ds-glass-strong), transparent 85%)",
            boxShadow:
              "inset 0 1px 0 0 var(--ds-edge), 0 10px 26px -10px rgba(40, 61, 91, 0.45)",
          }}
        />
        {/* הצל שהחפץ מטיל */}
        <div
          className="-mt-2 h-4 w-[52%] rounded-[50%] blur-md"
          style={{ background: "rgba(40, 61, 91, 0.3)" }}
        />
      </div>

      <svg viewBox="-50 -2 300 304" className={`relative ${className}`} overflow="visible">
        <defs>
          <clipPath id="hgl-top">
            <path d={TOP_BULB} />
          </clipPath>
          <clipPath id="hgl-bottom">
            <path d={BOTTOM_BULB} />
          </clipPath>

          {/* גרדיאנט אחד משותף לכל השעון (userSpaceOnUse): כל אלמנט "דוגם"
              את הצבע לפי מיקומו בגובה, ולכן המעבר בין חמשת הצבעים רציף ורך
              על פני האובייקט כולו - ולא קפיצה חדה בין אלמנט לאלמנט. */}
          <linearGradient id="hgl-line" gradientUnits="userSpaceOnUse" x1="0" y1="28" x2="0" y2="272">
            <stop offset="0%" stopColor={PALETTE[0]} />
            <stop offset="25%" stopColor={PALETTE[1]} />
            <stop offset="50%" stopColor={PALETTE[2]} />
            <stop offset="75%" stopColor={PALETTE[3]} />
            <stop offset="100%" stopColor={PALETTE[4]} />
          </linearGradient>

          {/* אותו מעבר בדיוק לחול, רק בשקיפות נמוכה כדי שהקו יישאר הגיבור */}
          <linearGradient id="hgl-sand" gradientUnits="userSpaceOnUse" x1="0" y1="28" x2="0" y2="272">
            <stop offset="0%" stopColor={PALETTE[0]} stopOpacity={0.45} />
            <stop offset="25%" stopColor={PALETTE[1]} stopOpacity={0.45} />
            <stop offset="50%" stopColor={PALETTE[2]} stopOpacity={0.47} />
            <stop offset="75%" stopColor={PALETTE[3]} stopOpacity={0.5} />
            <stop offset="100%" stopColor={PALETTE[4]} stopOpacity={0.5} />
          </linearGradient>

          {/* חיתוך לחצי הקדמי של כל שפה: בציור קווי תלת-ממדי, הדופן
              *הקרובה* של טבעת מצוירת חזק והרחוקה חלשה. זה הרמז החזק ביותר
              לנפח גלילי - בלעדיו הטבעת נקראת כעיגול שטוח. */}
          <clipPath id="hgl-front-top">
            <rect x="-60" y="38" width="320" height="120" />
          </clipPath>
          <clipPath id="hgl-front-bottom">
            <rect x="-60" y="262" width="320" height="120" />
          </clipPath>

          {/* נצנוץ ספקולרי - כתם אור על הזכוכית */}
          <radialGradient id="hgl-spec" cx="0.32" cy="0.28" r="0.42">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </radialGradient>

          {/* הצללה צדדית - נותנת לזכוכית נפח גלילי במקום מראה שטוח */}
          <linearGradient id="hgl-shade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.2} />
            <stop offset="30%" stopColor="#ffffff" stopOpacity={0.04} />
            <stop offset="70%" stopColor="#000000" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.3} />
          </linearGradient>
        </defs>

        {/* כל השעון מסתובב כאן ב-SMIL ולא ב-CSS. זה קריטי: אנימציית CSS
            ואנימציות SMIL רצות על שני שעונים נפרדים שמתחילים ברגעים שונים
            ונסחפים זה מזה, ולכן ההיפוך "זז" ולא נשאר נעול בדיוק על הרגע שבו
            החול נגמר. כשהכל על אותו ציר זמן, ההיפוך תמיד מתרחש בדיוק ב-87%,
            מיד אחרי שהתא העליון התרוקן ב-86%. */}
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            dur={dur}
            repeatCount="indefinite"
            calcMode="spline"
            keyTimes="0;0.87;1"
            keySplines="0 0 1 1;0.45 0 0.25 1"
            values="0 100 150;0 100 150;180 100 150"
          />

        {/* החול בתא העליון - המפלס יורד והגומה במרכז מעמיקה */}
        <g clipPath="url(#hgl-top)">
          <path fill="url(#hgl-sand)" d="M0 36 Q100 36 200 36 L200 300 L0 300 Z">
            <animate
              attributeName="d"
              dur={dur}
              repeatCount="indefinite"
              calcMode="linear"
              keyTimes={KEY_TIMES}
              values="
                M0 36 Q100 36 200 36 L200 300 L0 300 Z;
                M0 86 Q100 106 200 86 L200 300 L0 300 Z;
                M0 150 Q100 152 200 150 L200 300 L0 300 Z;
                M0 150 Q100 152 200 150 L200 300 L0 300 Z"
            />
          </path>

          {/* פני החול כאליפסה - משטח אופקי שנראה בפרספקטיבה */}
          <ellipse cx="100" cy="36" rx="58" ry="7" fill="#ffffff" opacity={0.22}>
            <animate attributeName="cy" dur={dur} repeatCount="indefinite" calcMode="linear" keyTimes={KEY_TIMES} values="36;92;150;150" />
            <animate attributeName="rx" dur={dur} repeatCount="indefinite" calcMode="linear" keyTimes={KEY_TIMES} values="58;46;5;5" />
            <animate attributeName="ry" dur={dur} repeatCount="indefinite" calcMode="linear" keyTimes={KEY_TIMES} values="7;6;1;1" />
          </ellipse>
        </g>

        {/* הזרם והגרגרים - כל גרגר בצבע אחר מהפלטה */}
        <g>
          <animate
            attributeName="opacity"
            dur={dur}
            repeatCount="indefinite"
            calcMode="discrete"
            keyTimes="0;0.86"
            values="1;0"
          />
          <rect x="99.4" y="150" width="1.4" height="102" fill="url(#hgl-line)" opacity={0.55} />
          <g clipPath="url(#hgl-bottom)">
            {GRAINS.map((g, i) => (
              <circle
                key={i}
                cx={g.x}
                cy="153"
                r={g.r}
                fill={g.color}
                style={{ animation: `hgl-fall ${g.dur}s ${g.delay}s linear infinite` }}
              />
            ))}
          </g>
        </g>

        {/* החול בתא התחתון - נערם כתלולית */}
        <g clipPath="url(#hgl-bottom)">
          <path fill="url(#hgl-sand)" d="M0 264 Q100 264 200 264 L200 300 L0 300 Z">
            <animate
              attributeName="d"
              dur={dur}
              repeatCount="indefinite"
              calcMode="linear"
              keyTimes={KEY_TIMES}
              values="
                M0 264 Q100 264 200 264 L200 300 L0 300 Z;
                M0 234 Q100 206 200 234 L200 300 L0 300 Z;
                M0 196 Q100 151 200 196 L200 300 L0 300 Z;
                M0 196 Q100 151 200 196 L200 300 L0 300 Z"
            />
          </path>

          {/* פני התלולית כאליפסה */}
          <ellipse cx="100" cy="264" rx="57" ry="7" fill="#ffffff" opacity={0.18}>
            <animate attributeName="cy" dur={dur} repeatCount="indefinite" calcMode="linear" keyTimes={KEY_TIMES} values="264;224;178;178" />
            <animate attributeName="rx" dur={dur} repeatCount="indefinite" calcMode="linear" keyTimes={KEY_TIMES} values="57;44;30;30" />
            <animate attributeName="ry" dur={dur} repeatCount="indefinite" calcMode="linear" keyTimes={KEY_TIMES} values="7;6;5;5" />
          </ellipse>
        </g>

        {/* הצללה ונצנוץ על הזכוכית - נפח וחומר */}
        <path d={TOP_BULB} fill="url(#hgl-shade)" />
        <path d={BOTTOM_BULB} fill="url(#hgl-shade)" />
        <path d={TOP_BULB} fill="url(#hgl-spec)" />
        <path d={BOTTOM_BULB} fill="url(#hgl-spec)" />

        {/* קו המתאר - כל האלמנטים לוקחים מאותו גרדיאנט משותף, כך שהצבע
            זורם רך מירוק למעלה עד אלמוג למטה, בלי גבולות חדים. */}
        <g fill="none" stroke="url(#hgl-line)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M42 38 C42 100 88 130 97 150 L103 150 C112 130 158 100 158 38" />
          <path d="M42 262 C42 200 88 170 97 150 L103 150 C112 170 158 200 158 262" />
          <ellipse cx="100" cy="149" rx="9" ry="3" strokeWidth={2} opacity={0.5} />
          <ellipse cx="100" cy="151" rx="9" ry="3" strokeWidth={2.5} />

          {/* שפות: קודם האליפסה המלאה בעוצמה נמוכה (הדופן הרחוקה שנראית
              דרך הזכוכית), ומעליה החצי הקרוב בעוצמה מלאה. זה מה שהופך את
              הטבעת מעיגול שטוח לשפה של גוף תלת-ממדי. */}
          <ellipse cx="100" cy="38" rx="58" ry="9" opacity={0.35} strokeWidth={2} />
          <ellipse cx="100" cy="33" rx="58" ry="9" opacity={0.25} strokeWidth={1.5} />
          <g clipPath="url(#hgl-front-top)">
            <ellipse cx="100" cy="38" rx="58" ry="9" />
            <ellipse cx="100" cy="33" rx="58" ry="9" opacity={0.6} strokeWidth={2} />
          </g>

          <ellipse cx="100" cy="262" rx="58" ry="9" opacity={0.35} strokeWidth={2} />
          <ellipse cx="100" cy="267" rx="58" ry="9" opacity={0.25} strokeWidth={1.5} />
          <g clipPath="url(#hgl-front-bottom)">
            <ellipse cx="100" cy="262" rx="58" ry="9" />
            <ellipse cx="100" cy="267" rx="58" ry="9" opacity={0.6} strokeWidth={2} />
          </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

export default AnimatedHourglass;
