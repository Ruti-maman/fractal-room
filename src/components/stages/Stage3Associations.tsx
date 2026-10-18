import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Group } from "../../types/group";
import type { Stage3Content, InspirationItem, Stage3IntroTexts } from "../../types/stage3Content";
import { useInspirations } from "../../hooks/useInspirations";
import { useInspirationSelection } from "../../hooks/useInspirationSelection";
import StageShell from "../StageShell";
import Icon from "../ui/Icon";
import { SwipeToAdvanceLayer, useSwipeToAdvance } from "../SwipeToAdvance";
import StageIntro from "../StageIntro";
import { Spinner } from "../ui/Glass";
import { cx } from "../../lib/cx";

const MAX_SELECTED = 4;

/* ברירות מחדל - הנוסח של הלקוחה מהאפיון (נדרס מ-content.intro ב-DB). */
const INTRO_DEFAULTS: Stage3IntroTexts = {
  lines: [
    { text: "מצאנו את הצורה." },
    { text: "עכשיו — איפה היא נשברת? יש דילמה?" },
    { text: "מצוין." },
    { text: "כי לפני שמשנים צורה," },
    { text: "צריך להבין איפה היא לא עובדת.", bold: true },
    { text: "כתבו כל מה שעולה לכן עכשיו בראש," },
    { text: "אחת שתיים שלוש ו -", bold: true },
    { text: "רעיון / שאלה / תחושה / כיוון." },
    { text: "בשלב הזה לא מסדרים את המחשבות," },
    { text: "כאן נותנים להן לצאת." },
  ],
  start_label: "התחלנו",
  step1: "השלימו את כיווני המחשבה סביב השמש,",
  step2: "לאחר מכן לחצו על ארבעה כיוונים נבחרים שיוכלו לסייע לכן בהמשך המחקר",
  strip_hint: "לחצו על כיוון מחשבה כדי שתיבחר",
  swipe_hint: "גררו את המסך ימינה או שמאלה כדי להמשיך",
};
const FLY_DURATION_MS = 550;

/**
 * זוויות 7 הקרניים סביב השמש (מעלות, 0=ימין, סיבוב נגד כיוון השעון) - חולצו
 * ישירות ממיקומי הצורות בשקף 5 במצגת (docs/מצגת.pptx). שימו לב לפער למעלה -
 * זה במקור, לא טעות. **אסור לשנות** - זה המיקום המדויק מהמצגת של הלקוחה.
 */
const RAY_ANGLES = [42, 4, -32, -90, -148, 176, 143];
/*
  השמש היא **אליפסה** ולא עיגול: על מסך רחב ונמוך (פלזמה, או מחשב עם
  הגדלה של 125%) הגובה הוא מה שמגביל אותה, ועיגול מלא בזבז גובה על
  משבצות שאפשר לפרוש לרוחב. רדיוס אנכי קטן = שמש גדולה יותר בפועל.
*/
// מרחק המשבצות מהליבה: לרוחב 360 (חצי משבצת 112 + ליבה עם טבעת ~190 +
// מרווח), לגובה 260 - כדי שאף משבצת לא תיגע בעיגול המרכזי.
const RADIUS = 360;
const RADIUS_Y = 260;
/* המידות הטבעיות של השמש (לפני הקטנה) - ממנן נגזר יחס ההקטנה. */
const SUN_W = RADIUS * 2 + 240;
const SUN_H = RADIUS_Y * 2 + 90;
/*
  הקרניים לא סימטריות: המשבצת התחתונה (-90°) יורדת עד הרדיוס המלא, אבל
  העליונות (42°) עולות רק לכ-2/3 ממנו. החלק העליון של הקופסה היה רצועה
  ריקה שהקטינה את השמש סתם - כאן היא נחתכת מהמסגרת הנראית.
*/
const SUN_TOP_CROP = 75;
const SUN_VISIBLE_H = SUN_H - SUN_TOP_CROP;
/** השמש גדלה מעבר לגודל הטבעי כשיש מקום - עד 25%. */
const SUN_MAX_SCALE = 1.25;

/** טבעת הטעינה סביב הליבה - רדיוס והיקף, לחישוב ה-strokeDasharray. */
const CORE_RING = 128;
const CORE_CIRC = 2 * Math.PI * CORE_RING;

interface Props {
  workshopId: string;
  myGroup: Group;
  content: Stage3Content;
  onAdvance: () => void;
}

interface FlyingChip {
  key: number;
  text: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

function fillSlots(items: InspirationItem[]) {
  return Array.from({ length: 7 }, (_, i) => items[i] ?? { text: "" });
}

/** צ'יפ שמדמה "תעופה" מהקרן שנבחרה אל תוך תיבת ההשראות למטה. */
function FlyingChipEl({ chip }: { chip: FlyingChip }) {
  const [atTarget, setAtTarget] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAtTarget(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const pos = atTarget ? chip.to : chip.from;

  return (
    <span
      className="glass glass-active pointer-events-none fixed z-50 rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all ease-in"
      style={{
        left: pos.x,
        top: pos.y,
        transform: `translate(-50%, -50%) scale(${atTarget ? 0.5 : 1})`,
        opacity: atTarget ? 0 : 1,
        transitionDuration: `${FLY_DURATION_MS}ms`,
      }}
    >
      {chip.text}
    </span>
  );
}

/**
 * שלב 3 - שמש האסוציאציות (שקף 5 במצגת).
 *
 * ההשראות עצמן **משותפות לשלוש הקבוצות** (מה שקבוצה אחת מקלידה מופיע אצל
 * כולן), אבל ה**בחירה** היא של כל קבוצה בנפרד, וכך גם המעבר לשלב הבא.
 * ראו ההסבר המלא בסעיף 8.5 ב-CLAUDE.md.
 *
 * ----------------------------------------------------------------------------
 * העיצוב: טעינת מקור אור
 * ----------------------------------------------------------------------------
 * זה המסך הכי "משחקי" בסדנה, והמכניקה שלו היא **טעינה**: הליבה במרכז
 * מתחילה עמומה, וכל השראה שנבחרת מזינה אותה. שלושה דברים זזים יחד עם
 * `charge` (0 עד 1):
 *   - טבעת טעינה סביב הליבה מתמלאת,
 *   - ההילה גדלה והליבה מתנפחת קלות וזוהרת חזק יותר,
 *   - הקרן שנבחרה נדלקת, ופולס אור רץ לאורכה **פנימה** אל הליבה.
 *
 * זה הופך את הבחירה מ"לחצתי על כפתור" ל"הזנתי את השמש", וזה גם מה שעונה
 * בלי מילים על "כמה עוד נשאר".
 *
 * הרדיוס והזוויות נשארו בדיוק כפי שחולצו מהמצגת. כדי שזה לא יישבר על מסך
 * צר, השמש כולה מוקטנת פרופורציונלית (`scale`) במקום לשנות את הגאומטריה -
 * כך המיקום היחסי של כל קרן נשמר מדויק בכל רוחב מסך.
 */
function Stage3Associations({ workshopId, myGroup, content, onAdvance }: Props) {
  /*
    השמש מוקטנת לפי **השטח הפנוי בפועל** - רוחב וגם גובה - ולא לפי
    breakpoint של רוחב. בגרסה הקודמת (scale קבוע לכל רוחב) מסך רחב ונמוך
    קיבל שמש מלאה, והחצי התחתון שלה נחתך. גם ה-scale לבד לא הספיק:
    transform לא מקטין את המקום שהאלמנט תופס, ולכן העוטף מקבל במפורש את
    המידות המוקטנות.
  */
  // ref כ-state ולא useRef: השמש לא קיימת בזמן הטעינה, ו-effect שתלוי
  // באלמנט עצמו רץ שוב ברגע שהוא נוצר.
  const [sunArea, setSunArea] = useState<HTMLDivElement | null>(null);
  const [sunScale, setSunScale] = useState(1);
  useEffect(() => {
    const area = sunArea;
    if (!area) return;
    const fit = () => {
      const scale = Math.min(area.clientWidth / SUN_W, area.clientHeight / SUN_VISIBLE_H, SUN_MAX_SCALE);
      setSunScale(Math.max(0.3, scale));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(area);
    return () => ro.disconnect();
  }, [sunArea]);

  const { items, loading: loadingText, mutate: mutateText } = useInspirations(workshopId);
  const { selected, loading: loadingSelection, mutate } = useInspirationSelection(workshopId, myGroup.id);
  const [flyingChips, setFlyingChips] = useState<FlyingChip[]>([]);
  const stripRef = useRef<HTMLDivElement>(null);
  const flyKeyRef = useRef(0);

  // 7 משבצות קבועות (כמו במצגת) - items[i] קיים רק אחרי שנכתב בו משהו.
  const slots = fillSlots(items);
  const [introDone, setIntroDone] = useState(false);
  const selectedCount = selected.length;
  const loading = loadingText || loadingSelection;

  function updateSlotText(index: number, text: string) {
    if (!text.trim()) return;
    // קוראים מחדש את המצב העדכני של הטקסט המשותף ממש לפני הכתיבה - כדי לא לדרוס מסך אחר שכתב כמעט באותו רגע.
    mutateText(myGroup.id, (current) => {
      const fresh = fillSlots(current);
      const prev = fresh[index];
      // השראה של קבוצה אחרת לא נדרסת, גם אם נשלחה עריכה (מרוץ בין מסכים)
      if (prev.text.trim() && prev.author && prev.author !== myGroup.id) return fresh;
      fresh[index] = { ...prev, text, author: prev.author ?? myGroup.id };
      return fresh;
    });
  }

  /** עריכה - רק לקבוצה שכתבה (או השראה ישנה בלי כותבת ידועה). */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const canEdit = (item: InspirationItem) => !item.author || item.author === myGroup.id;

  function toggleSelected(index: number, e: MouseEvent<HTMLButtonElement>) {
    const localItem = slots[index];
    if (!localItem.text.trim()) return;

    const isSelected = selected.includes(index);
    if (!isSelected && stripRef.current) {
      const fromRect = e.currentTarget.getBoundingClientRect();
      const toRect = stripRef.current.getBoundingClientRect();
      const key = flyKeyRef.current++;
      setFlyingChips((chips) => [
        ...chips,
        {
          key,
          text: localItem.text,
          from: { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 },
          to: { x: toRect.left + 24, y: toRect.top + toRect.height / 2 },
        },
      ]);
      setTimeout(() => setFlyingChips((chips) => chips.filter((c) => c.key !== key)), FLY_DURATION_MS + 100);
    }

    mutate((current) => {
      if (current.includes(index)) return current.filter((i) => i !== index);
      if (current.length >= MAX_SELECTED) return current;
      return [...current, index];
    });
  }

  // ברגע שהקבוצה שלנו בחרה את ההשראה הרביעית - מופיע משפט חזק, והקבוצה
  // גוררת את המסך ימינה או שמאלה כדי לעבור הלאה (במקום פופ-אפ עם כפתור -
  // בקשת הלקוחה, שקף 6 במצגת האפליקציה). לפני ההחזרות המוקדמות, כי זה hook.
  const swipe = useSwipeToAdvance(selectedCount === MAX_SELECTED, onAdvance);

  if (loading) {
    return (
      <StageShell stage={3} kicker="שמש אסוציאציות" icon="sun" title="טוען...">
        <Spinner size={56} />
      </StageShell>
    );
  }

  const intro = { ...INTRO_DEFAULTS, ...(content.intro ?? {}) };
  // צעד I עד שכל המשבצות סביב השמש מלאות, ואז צעד II (בחירת ארבעה)
  const allFilled = slots.every((s) => s.text.trim().length > 0);

  /*
    מסך הפתיחה (לפי האפיון): הטקסט המלא, ובסופו "התחלנו". מקומי לכל
    מסך - קבוצה שכבר בחרה השראות (למשל אחרי רענון) לא רואה אותו שוב.
  */
  if (!introDone && selectedCount === 0) {
    return (
      <StageIntro
        stage={3}
        kicker="שמש אסוציאציות"
        icon="sun"
        background="radiant"
        lines={intro.lines}
        startLabel={intro.start_label}
        onStart={() => setIntroDone(true)}
      />
    );
  }

  const remaining = MAX_SELECTED - selectedCount;
  // 0 עד 1. זה מה שמניע את טבעת הטעינה, גודל ההילה ועוצמת הזוהר של
  // הליבה - כך שהשלב מרגיש כמו טעינת מקור אור ולא כמו מילוי טופס.
  const charge = selectedCount / MAX_SELECTED;

  return (
    <StageShell
      style={swipe.shellStyle}
      compactHeader
      clipContent={false}
      stage={3}
      kicker="שמש אסוציאציות"
      icon="sun"
      title="מה עולה לכן מהדילמה?"
      // שני הצעדים מהאפיון; הצעד הנוכחי מודגש
      subtitle={
        <span className="flex flex-col items-center gap-1">
          {[intro.step1, intro.step2].map((text, i) => {
            const active = (i === 0 && !allFilled) || (i === 1 && allFilled);
            return (
              <span
                key={i}
                className={cx(
                  "flex items-center gap-2 transition-all duration-300",
                  active ? "text-ink text-xl font-extrabold" : "text-ink-3 text-lg",
                )}
              >
                <span
                  className={cx(
                    "flex h-7 w-7 flex-none items-center justify-center text-[11px] font-extrabold",
                    active ? `bubble bubble--${i + 1}` : "bubble bubble-hollow",
                  )}
                >
                  {i === 0 ? "I" : "II"}
                </span>
                {text}
              </span>
            );
          })}
        </span>
      }
      background="radiant"
      width="full"
      // בלי ריווח תחתון מיוחד: היה כאן !pb-56 (224px) שהשאיר רצועה ריקה
      // מתחת לשמש והקטין אותה. רצועת "נבחרו" צריכה רק את lg:pb-24 הרגיל.
      className="max-lg:!pb-56"
      overlay={
        <>
          {/*
            תיבת ההשראות שנבחרו.

            היא יושבת כאן, ב-overlay, ולא בתוך גוף השלב - וזה הכרחי ולא
            עניין של סדר: גוף השלב מונפש ב-transform (fade-up), ואלמנט
            עם transform הופך לנקודת הייחוס של position:fixed במקום
            החלון. כשהרצועה הייתה שם, ה-bottom שלה נמדד מתחתית התוכן
            המונפש והיא ריחפה באמצע השמש במקום להיצמד לתחתית המסך.
          */}
          <div
            ref={stripRef}
            // bottom משתנה לפי רוחב: על מסך רחב הרצועה יושבת בשורה התחתונה,
            // בין מד ההתקדמות לטיימר שבקצוות - שם היא לא לוקחת גובה מהשמש.
            // על מסך צר אין ביניהם מקום, ולכן היא עולה מעליהם.
            className="glass glass-brick glass-raised fixed bottom-[12rem] left-1/2 z-30 flex min-h-[4.25rem] w-[min(92vw,44rem)] -translate-x-1/2 items-center gap-3 rounded-xl px-5 py-3 lg:bottom-6 lg:w-[min(44rem,calc(100vw-40rem))]"
          >
            <span className="text-ink-3 flex flex-none items-center gap-1.5 text-[11px] font-bold">
              <Icon name="star" size={14} className="text-accent-soft" />
              נבחרו
              <span className="text-accent text-sm tabular-nums">
                {selectedCount}/{MAX_SELECTED}
              </span>
            </span>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {selected.length === 0 ? (
                <span className="text-ink-2 text-sm font-bold">{intro.strip_hint}</span>
              ) : (
                selected.map((index) => (
                  <span
                    key={index}
                    className="glass glass-active glass-chip !text-[13px]"
                    style={{ animation: "pop-in var(--ds-dur) var(--ds-ease-spring) both" }}
                  >
                    {slots[index].text}
                  </span>
                ))
              )}
            </div>

            {remaining > 0 && remaining <= 2 && (
              <span className="text-accent-soft flex-none text-xs font-bold">
                {remaining === 1 ? "עוד בחירה אחת, ונמשיך!" : `עוד ${remaining}`}
              </span>
            )}
          </div>

          {flyingChips.map((chip) => (
            <FlyingChipEl key={chip.key} chip={chip} />
          ))}

          <SwipeToAdvanceLayer
            swipe={swipe}
            title={content.transition_text ?? "בחרתן את ההשראות שלכן"}
            hint={intro.swipe_hint}
          />
        </>
      }
    >
      {/* --- השמש ---
          העוטף ממלא את הגובה הפנוי; הריווח התחתון שומר מקום לרצועת
          "נבחרו" במסך צר; במסך רחב היא יושבת בשורה התחתונה ולא צריך. */}
      <div
        ref={setSunArea}
        className="flex min-h-0 w-full flex-1 items-center justify-center pb-24 lg:pb-14"
      >
        {/* העוטף בגודל המוקטן, והשמש בתוכו ממוקמת absolute משמאל-למעלה:
            בכיוון RTL ילד רחב מההורה נדחף שמאלה, והשמש יצאה מהמרכז. */}
        <div
          className="relative flex-none"
          style={{ width: SUN_W * sunScale, height: SUN_VISIBLE_H * sunScale }}
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{
              width: SUN_W,
              height: SUN_H,
              transform: `scale(${sunScale}) translateY(-${SUN_TOP_CROP}px)`,
            }}
          >
            {/* ההילה גדלה ומתחזקת ככל שהליבה נטענת */}
            <div
              aria-hidden="true"
              className="bg-glow-soft absolute top-1/2 left-1/2 rounded-full blur-[90px] transition-all duration-700"
              style={{
                width: 460 + charge * 160,
                height: 460 + charge * 160,
                transform: "translate(-50%, -50%)",
                opacity: 0.45 + charge * 0.45,
                animation: "soft-pulse 6s ease-in-out infinite",
              }}
            />

            {/* קווי הקרניים. קרן שנבחרה **נדלקת** ופולסת פנימה אל הליבה -
                זה מה שהופך את הבחירה לפעולה שמזינה את השמש, ולא רק
                לכפתור שמשנה צבע. */}
            {RAY_ANGLES.map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              // מתחילות בשפת הליבה (רדיוס 160) ונעצרות לפני המשבצת
              const x1 = 178 * Math.cos(rad);
              const y1 = -178 * Math.sin(rad);
              // נעצרות בשפת המשבצת: חצי רוחב (112) לרוחב, חצי גובה (40) לגובה
              const x2 = (RADIUS - 112) * Math.cos(rad);
              const y2 = -(RADIUS_Y - 40) * Math.sin(rad);
              const length = Math.hypot(x2 - x1, y2 - y1);
              const lineAngle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
              const lit = selected.includes(i);

              return (
                <div
                  key={`line-${i}`}
                  aria-hidden="true"
                  className="absolute overflow-hidden rounded-full transition-all duration-500"
                  style={{
                    left: "50%",
                    top: "50%",
                    width: length,
                    height: lit ? 6 : 2,
                    background: lit
                      ? "linear-gradient(90deg, var(--ds-accent-pale), var(--ds-accent))"
                      : "var(--ds-edge)",
                    boxShadow: lit ? "0 0 18px 1px var(--ds-glow)" : "none",
                    opacity: lit ? 1 : 0.45,
                    transform: `translate(${x1}px, ${y1}px) rotate(${lineAngle}deg) translateY(${lit ? -3 : -1}px)`,
                    transformOrigin: "0 0",
                  }}
                >
                  {/* פולס האנרגיה שרץ לאורך הקרן פנימה */}
                  {lit && (
                    <span
                      className="absolute inset-y-0 w-1/3"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent, #ffffff, transparent)",
                        opacity: 0.85,
                        animation: `ray-pulse 2.4s ${i * 0.3}s linear infinite`,
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* --- הליבה --- */}
            {/* ה-scale של הטעינה יושב על העוטף ולא על העיגול: כשרק העיגול
                גדל, הוא כיסה חלקים מהטבעת והיא נראתה עקומה. */}
            <div
              className="absolute transition-transform duration-500"
              style={{
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) scale(${1 + charge * 0.06})`,
              }}
            >
              {/* טבעת הטעינה סביב הליבה - מד ההתקדמות של השלב. מעל העיגול
                  (z-10) ובמרווח ממנו, כדי שהצל שלו לא יבלע אותה. */}
              <svg
                viewBox="0 0 280 280"
                // מידות מפורשות ולא רק inset: ל-svg יש גודל טבעי, ועם inset
                // לבד הדפדפן לא מותח אותו - הטבעת יצאה קטנה ומוזזת הצידה.
                className="pointer-events-none absolute z-10 -rotate-90"
                // maxWidth: ה-preflight של Tailwind מגביל svg ל-100% רוחב - זה מה
                // שמעך את הטבעת לאליפסה והזיז אותה מהמרכז.
                style={{ top: -28, left: -28, width: "calc(100% + 56px)", height: "calc(100% + 56px)", maxWidth: "none" }}
                aria-hidden="true"
              >
                <circle
                  cx="140"
                  cy="140"
                  r={CORE_RING}
                  fill="none"
                  stroke="var(--ds-glass-strong)"
                  strokeWidth="5"
                />
                <circle
                  cx="140"
                  cy="140"
                  r={CORE_RING}
                  fill="none"
                  stroke="var(--ds-accent)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={CORE_CIRC}
                  strokeDashoffset={CORE_CIRC * (1 - charge)}
                  style={{
                    transition: "stroke-dashoffset 600ms var(--ds-ease-spring)",
                    filter: "drop-shadow(0 0 8px var(--ds-glow))",
                  }}
                />
              </svg>

              <div
                className="glass glass-brick relative flex h-80 w-80 items-center justify-center rounded-full p-9 text-center transition-all duration-500"
                style={{
                  boxShadow: `var(--ds-shadow-lg), 0 0 ${40 + charge * 70}px -6px var(--ds-glow), var(--ds-inset-top)`,
                }}
              >
                <span
                  className={cx(
                    "font-extrabold leading-snug",
                    content.dilemma_text ? "text-2xl" : "text-3xl",
                  )}
                >
                  {content.dilemma_text || "הדילמה שלנו"}
                </span>
              </div>
            </div>

            {/* 7 משבצות ההשראה */}
            {RAY_ANGLES.map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              const x = RADIUS * Math.cos(rad);
              const y = -RADIUS_Y * Math.sin(rad);
              const item = slots[i];
              const style = { left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` };
              const isSelected = selected.includes(i);

              const isEditing = editingIndex === i;
              if (!item.text.trim() || isEditing) {
                return (
                  /*
                    textarea ולא input: טקסט ארוך יורד שורה תוך כדי הקלדה
                    ונראה כולו, במקום להיגלל הצידה בתוך שורה אחת. הגובה גדל
                    עם הטקסט (field-sizing, ובדפדפן ישן - onInput למטה).
                    `slot-input` במקום glass-input: בלי המילוי הלבן שנראה
                    כמו שכבה מעל השדה - רק מסגרת דקה, כמו המשבצות המלאות.
                  */
                  <textarea
                    key={i}
                    rows={1}
                    className="slot-input absolute w-56 -translate-x-1/2 -translate-y-1/2 px-4 py-4 text-center text-lg leading-snug font-bold"
                    style={style}
                    placeholder="כתבו כאן"
                    defaultValue={isEditing ? item.text : undefined}
                    autoFocus={isEditing}
                    aria-label={`השראה ${i + 1}`}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    onBlur={(e) => {
                      updateSlotText(i, e.target.value);
                      setEditingIndex(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.target as HTMLTextAreaElement).blur();
                      }
                    }}
                  />
                );
              }

              return (
                <div
                  key={i}
                  className="absolute w-56 -translate-x-1/2 -translate-y-1/2"
                  style={style}
                >
                <button
                  type="button"
                  aria-pressed={isSelected}
                  className={cx(
                    "glass glass-interactive glass-3d w-full rounded-[2rem] px-4 py-4 text-center leading-snug font-bold",
                    // עד 4 שורות במשבצת; הטקסט המלא נראה בעריכה
                    "line-clamp-4",
                    // טקסט ארוך קטן מעט, כדי שהמשבצת לא תתארך לגובה ותעלה על השכנות
                    // בלי הגבלת אורך (לבקשת הלקוחה) - טקסט ארוך פשוט קטן בהדרגה
                    item.text.length > 90 ? "text-sm" : item.text.length > 40 ? "text-base" : "text-lg",
                    isSelected && "glass-active",
                  )}
                  onClick={(e) => toggleSelected(i, e)}
                >
                  {item.text}
                </button>
                {canEdit(item) && (
                  <button
                    type="button"
                    aria-label="עריכת ההשראה"
                    title="עריכה"
                    onClick={() => setEditingIndex(i)}
                    className="glass glass-raised text-ink-2 hover:text-ink absolute -top-2 -left-2 z-10 flex h-9 w-9 items-center justify-center rounded-full"
                  >
                    <Icon name="edit" size={15} />
                  </button>
                )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </StageShell>
  );
}

export default Stage3Associations;
