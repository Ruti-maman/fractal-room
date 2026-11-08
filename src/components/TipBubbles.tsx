import type { Tip } from "./TipPopups";
import GlassModal from "./ui/GlassModal";

/*
 * ============================================================================
 *  פופ-אפ טיפים לשם הקבוצה (שלב 2) - "מסלול השלבים"
 * ============================================================================
 *
 *  דרישת הלקוחה: "שיקפצו חלוניות פופאפ" עם ההוראות - ברור, מובן, חוויתי
 *  וחדשני. לכן הפופ-אפ בנוי כמו **מפת שלבים במשחק**: חמש בועות צבעוניות
 *  ממוספרות יושבות על שביל זיגזג מקווקו, מימין לשמאל, כמו תחנות בדרך
 *  לשם מנצח.
 *
 *  הכול נבנה מול העיניים: השביל נמתח לאורכו, וכל בועה "נוחתת" על התחנה
 *  שלה בתורה, עם שם הטיפ בצבע שלה וההסבר מתחתיו. כך הסדר נקרא כמסלול
 *  (קודם קצר, אחר כך קליט...), וכל חמשת הטיפים גלויים יחד.
 *
 *  כפתור אחד בלבד - "הבנו, בואו נבחר שם!" (בלי "סגירה" ובלי ×, שעשו אותו דבר).
 *  משמש גם בשלב 6 (טיפים לדיון טוב), עם כפתור בנוסח משלו.
 */

/** מרכזי התחנות על השביל: x באחוזים (RTL - הראשונה מימין), y בפיקסלים. */
const STOPS = [
  { x: 90, y: 34 },
  { x: 70, y: 86 },
  { x: 50, y: 34 },
  { x: 30, y: 86 },
  { x: 10, y: 34 },
];
const TRACK_H = 120;
const BUBBLE = 68;

function TipBubbles({
  open,
  onClose,
  title,
  tips,
  confirmLabel = "הבנו, בואו נבחר שם!",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  tips: Tip[];
  /** הכפתור היחיד בפופ-אפ (משמש גם בשלב 6, עם נוסח משלו). */
  confirmLabel?: string;
}) {
  const stops = STOPS.slice(0, tips.length);
  // שביל מעוגל בין התחנות (קשתות בזיגזג)
  const path = stops
    .map((s, i) => {
      if (i === 0) return `M ${s.x * 10} ${s.y}`;
      const p = stops[i - 1];
      const mx = ((p.x + s.x) / 2) * 10;
      return `C ${mx} ${p.y}, ${mx} ${s.y}, ${s.x * 10} ${s.y}`;
    })
    .join(" ");

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={title}
      icon="lightbulb"
      confirmLabel={confirmLabel}
      onConfirm={onClose}
      hideCancel
      // גם בלי ×: הוא עשה בדיוק מה שהכפתור עושה (דרישת הלקוחה - אין שני
      // כפתורים עם אותה פעולה)
      dismissable={false}
      className="!max-w-5xl"
    >
      <div className="relative">
        {/* השביל - נמתח פנימה */}
        <svg
          viewBox={`0 0 1000 ${TRACK_H}`}
          preserveAspectRatio="none"
          className="absolute inset-x-0 top-0 w-full"
          style={{ height: TRACK_H }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="tips-trail" gradientUnits="userSpaceOnUse" x1="1000" y1="0" x2="0" y2="0">
              <stop offset="0%" style={{ stopColor: "var(--ds-rainbow-1)" }} />
              <stop offset="50%" style={{ stopColor: "var(--ds-rainbow-3)" }} />
              <stop offset="100%" style={{ stopColor: "var(--ds-rainbow-5)" }} />
            </linearGradient>
          </defs>
          <path
            d={path}
            fill="none"
            stroke="url(#tips-trail)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray="2 14"
            vectorEffect="non-scaling-stroke"
            style={{ ["--dash" as string]: 1400, animation: "tips-trail 1.4s 0.2s var(--ds-ease) both" }}
          />
        </svg>

        {/* התחנות - כל עמודה: בועה על השביל, ומתחתיה הטיפ */}
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${tips.length}, minmax(0, 1fr))` }}>
          {tips.map((tip, i) => {
            const color = `var(--ds-bubble-${(i % 5) + 1})`;
            const delay = 0.35 + i * 0.28;
            return (
              <li key={tip.title} className="flex flex-col items-center px-2 text-center">
                <div className="relative w-full" style={{ height: TRACK_H }}>
                  <span
                    aria-hidden="true"
                    className={`bubble bubble--${(i % 5) + 1} absolute left-1/2 flex items-center justify-center text-2xl font-extrabold text-white`}
                    style={{
                      width: BUBBLE,
                      height: BUBBLE,
                      top: stops[i].y - BUBBLE / 2,
                      marginLeft: -BUBBLE / 2,
                      textShadow: "0 1px 3px rgba(0,0,0,0.35)",
                      boxShadow: `0 10px 26px -10px ${color}`,
                      animation: `tip-pop 0.6s ${delay}s var(--ds-ease-spring) both`,
                    }}
                  >
                    {i + 1}
                  </span>
                </div>
                <div style={{ animation: `fade-up 0.5s ${delay + 0.2}s var(--ds-ease) both` }}>
                  <p className="text-xl leading-tight font-extrabold" style={{ color }}>
                    {tip.title}
                  </p>
                  <p className="text-ink mt-1 text-base leading-snug font-semibold">{tip.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </GlassModal>
  );
}

export default TipBubbles;
