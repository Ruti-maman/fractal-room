/*
 * ============================================================================
 *  שבילי אור
 * ============================================================================
 *
 *  הרקע של הסדנה: קווי אור ארוכים, דקים ומתעקלים, שחוצים את המסך בכמה
 *  כיוונים וזורמים לאט. צפופים ובהירים בחלק העליון, נמוגים כלפי מטה.
 *
 *  ----------------------------------------------------------------------
 *  למה דווקא זה, ומה הוחלף
 *  ----------------------------------------------------------------------
 *  קדמו לזה שתי גרסאות שנפסלו, ושתיהן בגלל **חזרתיות**:
 *    - פסים אופקיים (`repeating-linear-gradient`) נראו כמו טפט ישן.
 *    - טבעות קונצנטריות (`repeating-radial-gradient`) נקראו כמטרה.
 *
 *  דוגמה שחוזרת על עצמה בקצב קבוע היא בדיוק מה שהורג תחושת חלל. כאן
 *  אין שום חזרה: כל קו הוא עקומה בפני עצמה, באורך, בזווית ובעובי משלה,
 *  והם נחתכים זה בזה בזוויות משתנות - וזה מה שנותן עומק.
 *
 *  ----------------------------------------------------------------------
 *  ביצועים
 *  ----------------------------------------------------------------------
 *  SVG עם ~40 נתיבים דקים הוא זול: אין filter, אין blur, ואין צל. התנועה
 *  היא `transform` על שלוש קבוצות בלבד (לא על קו בודד), בשלושה קצבים -
 *  וזה גם מה שיוצר את הפרלקסה. הכל רץ על ה-compositor.
 *
 *  הקווים נוצרים פעם אחת מתוך זרע קבוע ולא באקראי בזמן ריצה, אחרת הם
 *  היו "מתערבבים" מחדש בכל רינדור.
 */

/** אותו "אקראי" בכל טעינה - זרע קבוע. */
function seeded(i: number, salt: number) {
  return (Math.sin((i + 1) * salt) + 1) / 2;
}

interface Trail {
  d: string;
  width: number;
  opacity: number;
}

/**
 * שכבה אחת של קווים. `drift` קובע כמה היא נעה, וכך השכבות הרחוקות
 * זזות פחות מהקרובות - פרלקסה.
 */
function buildLayer(count: number, salt: number, spread: number): Trail[] {
  return Array.from({ length: count }, (_, i) => {
    // נקודת התחלה בקצה כלשהו, נקודת סיום בקצה אחר, ושתי נקודות בקרה
    // שמכופפות את הקו. זה מה שהופך קו ישר לעקומה שנראית כמו מסלול אור.
    const x1 = seeded(i, salt) * 140 - 20;
    const y1 = seeded(i, salt * 1.7) * 40 - 20;
    const x2 = seeded(i, salt * 2.3) * 140 - 20;
    const y2 = 60 + seeded(i, salt * 3.1) * 70;
    const cx1 = x1 + (seeded(i, salt * 4.7) - 0.5) * spread;
    const cy1 = y1 + 20 + seeded(i, salt * 5.3) * 40;
    const cx2 = x2 + (seeded(i, salt * 6.1) - 0.5) * spread;
    const cy2 = y2 - 20 - seeded(i, salt * 7.9) * 40;

    return {
      d: `M${x1.toFixed(1)} ${y1.toFixed(1)} C${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      width: 0.08 + seeded(i, salt * 8.3) * 0.22,
      opacity: 0.18 + seeded(i, salt * 9.7) * 0.5,
    };
  });
}

const FAR = buildLayer(16, 12.9898, 60);
const MID = buildLayer(14, 41.77, 90);
const NEAR = buildLayer(9, 78.233, 120);

const LAYERS: { trails: Trail[]; duration: number; shift: number }[] = [
  { trails: FAR, duration: 90, shift: 1.5 },
  { trails: MID, duration: 64, shift: 3 },
  { trails: NEAR, duration: 46, shift: 5 },
];

function LightTrails() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        {/* הקווים בוהקים למעלה ונמוגים כלפי מטה - זה מה שנותן לרקע
            "אופק" במקום להיראות כמו רשת אחידה. */}
        <linearGradient id="trail-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ds-accent-soft)" stopOpacity="0.85" />
          <stop offset="45%" stopColor="var(--ds-accent)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--ds-accent-deep)" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {LAYERS.map((layer, li) => (
        <g
          key={li}
          style={{
            animation: `trail-flow ${layer.duration}s ease-in-out infinite alternate`,
            ["--shift" as string]: `${layer.shift}%`,
            animationDelay: `${li * -8}s`,
          }}
        >
          {layer.trails.map((t, i) => (
            <path
              key={i}
              d={t.d}
              fill="none"
              stroke="url(#trail-fade)"
              strokeWidth={t.width}
              strokeOpacity={t.opacity}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

export default LightTrails;
