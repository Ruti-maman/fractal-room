import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Group } from "../../types/group";
import { cleanAiHebrew } from "../../lib/hebrewText";
import type { Stage4Content, Stage4IntroTexts } from "../../types/stage4Content";
import StageShell from "../StageShell";
import StageIntro from "../StageIntro";
import ZoomIntro from "../ZoomIntro";
import Icon from "../ui/Icon";
import GlassModal from "../ui/GlassModal";
import { GlassButton, Spinner } from "../ui/Glass";
import { InlineNotice, LoadingState } from "../ui/Feedback";
import { cx } from "../../lib/cx";
import { useTextMarking, type MarkColor, type TaggedPhrase } from "../../hooks/useTextMarking";
import { useFunctioningPicture } from "../../hooks/useFunctioningPicture";

interface Props {
  workshopId: string;
  myGroup: Group;
  content: Stage4Content;
  onAdvance: () => void;
}

type Tool = "green" | "red" | "eraser";

// צבעי מרקר חזקים כמו טקסטמרקר אמיתי - עכשיו שהטקסט (ראו z-10 על ה-<p>
// למטה) מצויר מעל שכבת הצביעה ולא מתערבב איתה, הרקע יכול להיות מלא/רווי
// בלי לפגוע בקריאות: האות עצמה תמיד נשארת בצבע שלה, מלאה וברורה, מעל
// המלבן הצבוע. כפתורי הכלים עצמם (MarkerTool) נשארים בצבע בולט לזיהוי נוח
// מרחוק - אותה משפחת צבעים, רק שהצביעה בפועל בהירה יותר (pastel) כדי
// שתישאר קריאה גם כרקע מלא.
const STROKE_COLOR: Record<"green" | "red", string> = {
  green: "#a8e08f",
  red: "#ff9e8c",
};
const STROKE_ALPHA = 1;
// טשטוש עדין מאוד בקצוות - קצת רכות של קצה לבד, בלי לטשטש את הריבוע עד
// שהוא מאבד את הצורה שתפורה לאות. אם הדפדפן לא תומך ב-ctx.filter (מסך ישן)
// הוא פשוט מתעלם ממנו ומצייר בלי טשטוש - לא נשבר, רק פחות רך.
const STROKE_BLUR_PX = 1.5;
const ERASER_CURSOR_COLOR = "#d5e8e4";

/**
 * הופכת את סמן העכבר עצמו למרקר קטן בצבע הכלי הפעיל, מוטה באלכסון (כמו
 * מרקר אמיתי ביד, לא עומד זקוף) - כדי שהתנועה על הטקסט תיתן הרגשה אמיתית
 * של הדגשה. הסיבוב (rotate) מתבצע סביב החוד עצמו (15,38), ה-hotspot
 * (הנקודה שבאמת "לוחצת"), כך שהחוד תמיד נשאר בדיוק במקום שעליו מצביעים
 * גם כשהגוף של המרקר מוטה מאחוריו - בדיוק כמו עט ביד אמיתית.
 */
function brushCursor(color: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">` +
    `<g transform="rotate(30 15 38)">` +
    `<rect x="7" y="6" width="16" height="19" rx="3" fill="${color}" stroke="white" stroke-width="2"/>` +
    `<polygon points="7,25 23,25 15,38" fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>` +
    `</g>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 15 38, auto`;
}
// סלחנות למגע לא מדויק - רדיוס בפיקסלים מסביב לאות שעדיין "תופס" אותה, כי
// אצבע אמיתית על מסך ענק אף פעם לא נוגעת בול במרכז אות בודדת (בשונה מעכבר).
// קטן יותר מהסלחנות שהייתה ברמת מילה (28px) כי אות בודדת צרה בהרבה ממילה,
// וסלחנות גדולה מדי הייתה תמיד "תופסת" את האות השכנה בטעות.
const TOUCH_TOLERANCE_PX = 16;
// הרחבה קטנה של צורת המילוי מעבר לגבול המדויק של כל אות, כדי שאותיות
// שכנות שסומנו באותו צבע יתחברו לכתם רציף אחד (כמו מרקר אמיתי) ולא ייראו
// כרצף של ריבועים קטנים עם רווחים ביניהם.
const CHAR_FILL_PADDING_PX = 3;
// מרחק בפיקסלים בין דגימות לאורך קו הגרירה - תזוזת עכבר/אצבע מהירה קופצת
// בין שתי אירועי pointermove מעבר לכמה אותיות ברצף; דוגמים נקודות ביניים
// כדי שכל אות שהאצבע "עברה מעליה" בדרך תיצבע בפועל, לא רק נקודת הקצה.
const DRAG_SAMPLE_STEP_PX = 6;

/**
 * כמה זמן היד צריכה לעמוד במקום באמצע הדגשה כדי שפופ-אפ התיוג יקפוץ
 * (בלי להרים את האצבע), וכמה תזוזה עדיין נחשבת "רעד" ולא המשך הדגשה.
 */
const DWELL_MS = 700;
const DWELL_JITTER_PX = 5;

/*
 * ============================================================================
 *  ארגז הכלים: מרקרים ומחק
 * ============================================================================
 *
 *  הכלים מצוירים ב-SVG ולא מורכבים מערימת divים. הגרסה הקודמת הייתה
 *  מלבן-מלבן-משולש, וזה נקרא כמו סכמה של טוש ולא כמו טוש: אין כתף, אין
 *  ברק על הפלסטיק, והחוד היה משולש חד במקום **חוד אלכסוני (chisel)** -
 *  שזו בדיוק הצורה שמזהים כ"מרקר".
 *
 *  ----------------------------------------------------------------------
 *  מה מרכיב מרקר אחד
 *  ----------------------------------------------------------------------
 *  פקק עם קליפס · טבעת צווארון · גוף עם הצרה קלה כלפי מטה · חלונית דיו
 *  שמראה את הצבע · ברק אנכי לאורך הפלסטיק · שרוול מתכת · חוד אלכסוני.
 *  השם כתוב על הגוף לאורך, כמו על טוש אמיתי.
 *
 *  ----------------------------------------------------------------------
 *  המיקרו-אינטראקציה
 *  ----------------------------------------------------------------------
 *  כלי פעיל **מורם ומוטה קלות**, כאילו נשלף מהמגש והוחזק ביד, והדיו שלו
 *  זוהר מאחוריו. כלי כבוי שוכב ישר ועמום. זה מה שהופך את הבחירה למוחשית
 *  במקום להיות עוד כפתור שמשנה גוון.
 *
 *  הצבע תמיד נגזר מ-STROKE_COLOR - אותו קבוע שצובע בפועל על הדף - כדי
 *  שהכלי ביד "מבטיח" את התוצאה ולא יוכל להיפרד ממנה בטעות.
 */

/**
 * כלי סימון - בשפה של כל הפרויקט ולא ציור של טוש: גלולת זכוכית תלת-ממדית,
 * ובתוכה בועה בצבע הדיו עם סמל (מרקר / מחק) ושם הכלי. הכלי הפעיל
 * "נדלק": מסגרת בצבע הדיו, זוהר רך, ורקע בגוון הדיו. כך רואים במבט
 * אחד באיזה צבע מסמנים עכשיו.
 */
function ToolButton({
  active,
  onClick,
  color,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  /** צבע הדיו - אותו STROKE_COLOR שצובע בפועל על הדף. */
  color: string;
  icon: "marker" | "eraser";
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      // לבן, טקסט כחול, מסגרת אדומה (בקשת הלקוחה, 2026-11-08). הכלי הפעיל
      // מורם ומקבל טבעת לבנה עבה מסביב - בולטת על המגש האדום
      className={cx(
        "glass glass-interactive glass-3d glass-pill btn-rect frame-red flex w-full min-w-[11rem] items-center gap-3.5 py-2.5 ps-2.5 pe-5 transition-all duration-300",
        active && "-translate-y-0.5 scale-[1.04]",
      )}
      style={active ? { outline: "4px solid var(--ds-on-active)", outlineOffset: "3px" } : undefined}
    >
      {/* האייקון גדול יותר (בקשת הלקוחה) - 64 במקום 44 */}
      <span
        aria-hidden="true"
        className="flex h-16 w-16 flex-none items-center justify-center diamond text-white"
        style={{
          background: `radial-gradient(circle at 32% 26%, color-mix(in srgb, ${color} 45%, white) 0%, ${color} 50%, color-mix(in srgb, ${color} 65%, #0b2a2a) 100%)`,
          boxShadow: `inset 0 -3px 6px -2px rgba(0,0,0,0.25), inset 0 2px 3px rgba(255,255,255,0.6), 0 4px 10px -3px color-mix(in srgb, ${color} 70%, transparent)`,
        }}
      >
        <Icon name={icon} size={30} />
      </span>
      <span className={cx("text-ink text-xl", active ? "font-extrabold" : "font-bold")}>
        {label}
      </span>
    </button>
  );
}

function MarkerTool({
  tool,
  label,
  active,
  onClick,
}: {
  tool: "green" | "red";
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <ToolButton active={active} onClick={onClick} color={STROKE_COLOR[tool]} icon="marker" label={label} />
  );
}

function EraserTool({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <ToolButton active={active} onClick={onClick} color="#8fa3ab" icon="eraser" label="מחק" />
  );
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * צובעת מלבן מעוגל שתפור למידות אות ספציפית - לא עיגול גנרי בנקודת מגע וגם
 * לא קו חופשי (freehand) שזז חופשי ביחס לאותיות. זו הדרך היחידה שבה משהו
 * נצבע בקומפוננטה הזו: כל אות שנוגעים/גוררים עליה מקבלת בדיוק את המלבן
 * שתפור למידות שלה, כך שהתחושה היא צביעה אות-אות ולא כתם עגול חופשי.
 * הריפוד (CHAR_FILL_PADDING_PX) מעבר לגבול המדויק של האות גורם לאותיות
 * שכנות מאותו צבע להיראות כמשיכת מרקר רציפה אחת, לא כריבועים נפרדים עם
 * רווחים דקים ביניהם.
 */
function fillCharShape(
  ctx: CanvasRenderingContext2D,
  charEl: HTMLElement,
  paperRect: DOMRect,
  tool: "green" | "red" | "eraser",
) {
  const r = charEl.getBoundingClientRect();
  ctx.save();
  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000000";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = STROKE_ALPHA;
    ctx.filter = `blur(${STROKE_BLUR_PX}px)`;
    ctx.fillStyle = STROKE_COLOR[tool];
  }
  roundRectPath(
    ctx,
    r.left - paperRect.left - CHAR_FILL_PADDING_PX,
    r.top - paperRect.top + r.height * 0.12,
    r.width + CHAR_FILL_PADDING_PX * 2,
    r.height * 0.76,
    3,
  );
  ctx.fill();
  ctx.restore();
}

interface CharCell {
  ch: string;
  index: number;
}

/** קטע שסומן זה עתה בגרירה, וממתין לבחירת קטגוריה (עוד לא נשמר כ-TaggedPhrase). */
interface PendingPhrase {
  color: "green" | "red";
  startIndex: number;
  endIndex: number;
  text: string;
}

/** חלון קטן שקופץ מיד בסיום כל גרירה שצבעה טקסט - הקבוצה בוחרת קטגוריה מרשימה סגורה (מהתוכן), לא מקלידה חופשי. */
function CategoryPopup({
  pending,
  categories,
  onChoose,
  onCancel,
}: {
  pending: PendingPhrase;
  categories: string[];
  onChoose: (category: string) => void;
  onCancel: () => void;
}) {
  /*
    במסך מגע, אחרי הרמת האצבע הדפדפן שולח "click" באותה נקודה - ועד אז
    הפופ-אפ כבר נפתח מתחת לאצבע, כך שהקליק נחת על הרקע הכהה וסגר אותו מיד.
    הקבוצה ראתה הבהוב (או כלום) ונאלצה לגעת שוב. לכן חצי השנייה הראשונה
    אחרי הפתיחה מתעלמת מסגירה. הכפתורים עצמם (הקטגוריות) לא מושפעים.
  */
  const openedAt = useRef(Date.now());
  const tooSoon = () => Date.now() - openedAt.current < 500;
  const guardedCancel = () => {
    if (!tooSoon()) onCancel();
  };
  // אותו קליק-רפאים עלול לנחות על כפתור קטגוריה ולתייג בטעות
  const guardedChoose = (category: string) => {
    if (!tooSoon()) onChoose(category);
  };
  return (
    <GlassModal
      open
      onClose={guardedCancel}
      tone={pending.color === "green" ? "ok" : "warn"}
      icon="marker"
      title={pending.color === "green" ? "סימנתן חוזקה" : "סימנתן חסם"}
      description="מה המונח המקצועי התואם ביותר?"
      cancelLabel="ביטול (להשאיר מסומן בלי תיוג)"
    >
      <p className="glass glass-dim text-ink rounded-lg px-5 py-4 text-xl font-bold">
        "{pending.text}"
      </p>

      {categories.length === 0 ? (
        <InlineNotice tone="warn" className="mt-5">
          לא הוגדרו קטגוריות בתוכן השלב.
        </InlineNotice>
      ) : (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {categories.map((category) => (
            <GlassButton key={category} size="sm" onClick={() => guardedChoose(category)}>
              {category}
            </GlassButton>
          ))}
        </div>
      )}
    </GlassModal>
  );
}

// כותרת הקטגוריה בטבלה מודגשת במסגרת שצמודה לצורת האות עצמה - לא תיבה/
// מלבן מסביבה (כמו מסגרת תמונה), אלא קו שעוקב אחרי קו המתאר של האות עצמה
// (כמו מסגרת שיש לצורה) - ר' FramedCategoryLabel למטה.
const PHRASE_COLUMN_STYLES: Record<
  "green" | "red",
  { header: string; icon: "check" | "alert"; strokeColor: string; fillColor: string }
> = {
  green: {
    header: "text-ok",
    icon: "check",
    strokeColor: STROKE_COLOR.green,
    fillColor: "#effef6",
  },
  red: {
    header: "text-warn",
    icon: "alert",
    strokeColor: STROKE_COLOR.red,
    fillColor: "#fff3f0",
  },
};

/**
 * מציגה מחרוזת קטגוריה עם מסגרת (stroke) שצמודה לצורת כל אות עצמה - לא
 * תיבה מלבנית מסביבה. text-stroke מצייר קו מתאר לאורך הצורה הגרפית
 * האמיתית של הגליף, בדיוק כמו מסגרת סביב צורה ב-SVG, לא מלבן גנרי.
 */
function FramedCategoryLabel({ text }: { text: string; color: "green" | "red" }) {
  // טקסט מודגש בלבד, בלי רקע צבעוני - לבקשת הלקוחה
  return <span className="text-ink text-lg font-extrabold">{text}</span>;
}

/** טור אחד בטבלת הסנכרון (שקף 7) - חוזקות או חסמים, כל שורה מחולקת למונח המקצועי (מימין, מודגש) ולנתון עצמו (משמאל). */
function PhraseColumn({
  title,
  color,
  phrases,
}: {
  title: string;
  color: "green" | "red";
  phrases: TaggedPhrase[];
}) {
  const styles = PHRASE_COLUMN_STYLES[color];
  // קיבוץ לפי תחום: כל תחום מופיע פעם אחת, וכל המשפטים שתויגו בו מתחתיו.
  // סדר התחומים - לפי הפעם הראשונה שסומן בהם, כדי שהטבלה תלך עם הטקסט.
  const groups: { category: string; items: TaggedPhrase[] }[] = [];
  for (const p of phrases) {
    const group = groups.find((g) => g.category === p.category);
    if (group) group.items.push(p);
    else groups.push({ category: p.category, items: [p] });
  }
  return (
    // לבן, כותרות אדומות, טקסט כחול, מסגרות אדומות (בקשת הלקוחה, 2026-11-08)
    <div className="glass glass-brick glass-raised frame-red flex max-h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
      {/* כותרת הטור: אדומה, על הלבן של הכרטיס, עם קו אדום מתחתיה */}
      <div className="text-red-head border-pal-3 flex flex-none items-center gap-2.5 border-b-2 px-5 py-4 text-2xl font-extrabold">
        <Icon name={styles.icon} size={24} />
        {title}
        <span className="text-ink-3 ms-auto text-sm font-bold tabular-nums">
          {phrases.length}
        </span>
      </div>

      {phrases.length === 0 ? (
        <p className="text-ink-3 px-5 py-8 text-center text-sm">עדיין לא סומן כאן כלום</p>
      ) : (
        // mx/mb: המסגרת הצבעונית של הכרטיס (::after) יושבת מתחת לתוכן -
        // בלי הרווח הזה הרקע של שורת הכותרות הקבועה כיסה אותה והמסגרת
        // נראתה חתוכה. rounded-b: שורות שגוללות לא בולטות מהפינות המעוגלות.
        <div className="glass-scroll mx-0.5 mb-0.5 min-h-0 flex-1 overflow-y-auto rounded-b-2xl">
        <table className="w-full border-collapse text-right">
          <thead>
            <tr className="text-red-head text-base">
              {/* המונח המקצועי מימין (נקרא ראשון, טור קצר ואחיד שקל לסרוק) והנתון
                  - המשפט מהטקסט - משמאלו. אושר ע"י המפתחת, 2026-10-20. */}
              {/* sticky: שורת הכותרות נשארת קבועה כשהשורות גוללות מתחתיה */}
              <th className="border-pal-3 sticky top-0 z-10 border-b bg-white px-4 py-2 font-extrabold">
                מונח מקצועי
              </th>
              <th className="border-pal-3 sticky top-0 z-10 border-b bg-white px-4 py-2 font-extrabold">
                נתון
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) =>
              g.items.map((p, i) => (
                <tr
                  key={p.id}
                  // קו מפריד רק בין תחומים; בתוך תחום - קו עדין בין המשפטים בלבד
                  className={cx(
                    i === g.items.length - 1 ? "border-pal-5 border-b" : "border-pal-6 border-b border-dashed",
                    "last:border-b-0",
                  )}
                >
                  {i === 0 && (
                    <td rowSpan={g.items.length} className="px-4 py-3.5 align-top whitespace-nowrap">
                      {/* נצמד מתחת לשורת הכותרות בגלילה, עד שהתחום הבא דוחף אותו */}
                      <div className="sticky top-14">
                        <FramedCategoryLabel text={g.category} color={color} />
                      </div>
                    </td>
                  )}
                  <td className="text-ink px-4 py-3.5 align-middle text-lg leading-snug">{p.text}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

/**
 * מסך שלישי בתוך שלב 4 (שקף 8) - "תמונת תפקוד כוללת" ו"מסקנה מעשית".
 * שני משפטי הניסוח (ממוספרים 1/2) מנוסחים ב-AI (Google Gemini, ראו
 * supabase/functions/generate-functioning-picture) על סמך ההשראות
 * המשותפות משלב 3 והביטויים המתויגים מהטבלה שלפני זה - תמצית המשמעות של
 * מה שנבחר, לא חזרה מילולית על המילים שסומנו. מייצרת פעם אחת בלבד ברגע
 * שנכנסים למסך (אם עוד לא נוצרה - useFunctioningPicture כבר קורא מה-DB,
 * ולא מייצרת שוב בטעות אם התוצאה כבר שם, גם אחרי רענון).
 *
 * המסקנה המעשית **אינה** AI - זו תיבת הקלדה ריקה שהקבוצה עצמה ממלאת (לפי
 * בקשת הלקוחה במפורש: לא הצעת AI מוצגת שם). מה שהוקלד נשמר עם saveGroupConclusion
 * ברגע לחיצת "המשך", וממשיך ללוות את כל השלבים הבאים כרצועה קבועה
 * (PracticalConclusionBanner, מוזרק גלובלית מ-StageRouter) - לא רק מוצג
 * כאן חד-פעמית.
 */
function FunctioningPictureStep({
  workshopId,
  groupId,
  onAdvance,
}: {
  workshopId: string;
  groupId: string;
  onAdvance: () => void;
}) {
  const { result, loading, generating, error, generate, saveGroupConclusion } = useFunctioningPicture(
    workshopId,
    groupId,
  );
  const startedRef = useRef(false);
  const [groupConclusion, setGroupConclusion] = useState("");
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    if (loading || result || startedRef.current) return;
    startedRef.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, result]);

  // טוענת לתיבת ההקלדה מה שכבר נשמר (אם הקבוצה כבר הקלידה ואז רעננה את
  // המסך) - לא את הצעת ה-AI, שאף פעם לא מוצגת כאן (ראו group_conclusion).
  useEffect(() => {
    if (result?.group_conclusion) setGroupConclusion(result.group_conclusion);
  }, [result?.group_conclusion]);

  /*
    שמירה תוך כדי הקלדה (כשנעצרים לרגע), ולא רק בלחיצה על "המשך": כשהטיימר
    נגמר הוא מעביר לשלב הבא בלי לעבור דרך handleAdvance, והמסקנה שהוקלדה
    אבדה - והרצועה בשלבים הבאים לא הופיעה.
  */
  const lastSavedRef = useRef<string | null>(null);
  useEffect(() => {
    const text = groupConclusion.trim();
    if (!text || text === lastSavedRef.current || text === result?.group_conclusion) return;
    const t = window.setTimeout(() => {
      lastSavedRef.current = text;
      saveGroupConclusion(text);
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupConclusion]);

  // אי אפשר לעבור הלאה בלי מסקנה: לחיצה על "המשך" כשהתיבה ריקה מדגישה את
  // מסגרת התיבה בטורקיז (ומנערת אותה) במקום לעבור - דרישת הלקוחה.
  const [conclusionMissing, setConclusionMissing] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const conclusionRef = useRef<HTMLTextAreaElement>(null);
  // key={shakeKey} בונה את התיבה מחדש כדי שהניעור ירוץ שוב בכל לחיצה -
  // ולכן המיקוד (שפותח גם את המקלדת) נעשה רק אחרי הבנייה
  useEffect(() => {
    if (shakeKey) conclusionRef.current?.focus();
  }, [shakeKey]);

  async function handleAdvance() {
    if (!groupConclusion.trim()) {
      setConclusionMissing(true);
      setShakeKey((k) => k + 1);
      return;
    }
    setAdvancing(true);
    await saveGroupConclusion(groupConclusion);
    onAdvance();
  }

  return (
    <StageShell
      stage={4}
      kicker="תמונת תפקוד"
      icon="lightbulb"
      title="תמונת תפקוד כוללת ומסקנה מעשית"
      subtitle={
        <>
          עכשיו מחברים את החלקים: בהתאם לנתונים שהזנתן, נבנתה לכן תמונת תפקוד.
          <br />
          כל פיסה מצטרפת לפיסה. הדילמה כבר לא נראית כמו נקודה. היא נראית כמו מערכת.
        </>
      }
      background="quiet"
      width="wide"
      compactHeader
      // ההסבר מוסיף שתי שורות לכותרת - הרצועה התחתונה (מיותרת, הטיימר והמד
      // בפינות) מתפנה כדי ששדה המסקנה לא ייחתך
      tightBottom
      actions={
        result && !generating ? (
          <GlassButton
            variant="primary"
            size="lg"
            iconAfter="arrowNext"
            onClick={handleAdvance}
            loading={advancing}
          >
            המשך
          </GlassButton>
        ) : null
      }
    >
      {(loading || generating) && (
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div
              className="bg-glow-soft absolute inset-0 rounded-full blur-xl"
              style={{ animation: "soft-pulse 2.4s ease-in-out infinite" }}
            />
            <Spinner size={52} className="relative" />
          </div>
          <p className="text-ink-2 text-xl">מנסח...</p>
        </div>
      )}

      {error && !generating && (
        <div className="flex w-full max-w-xl flex-col items-center gap-4">
          <InlineNotice tone="warn" title="לא הצלחנו לנסח">
            {error}
          </InlineNotice>
          <GlassButton icon="refresh" onClick={generate}>
            נסו שוב
          </GlassButton>
        </div>
      )}

      {result && !generating && (
        /*
          בלי גלילה ובלי להקטין את הטקסט: במסך רחב שני המשפטים יושבים זה
          לצד זה (ולא זה מעל זה), וזה מפנה את כל הגובה שהיה חסר לתיבת
          המסקנה. התיבה עצמה נמוכה יותר (2 שורות) - היא מתרחבת לרוחב.
        */
        <div className="flex w-full flex-col gap-5">
          {/* שני המשפטים שה-AI ניסח - ממוספרים כלבנים נפרדות, כדי שיהיה
              ברור שאלו שתי אמירות ולא פסקה אחת ארוכה. */}
          <ol className="grid gap-4 lg:grid-cols-2">
            {[result.sentence1, result.sentence2].map(cleanAiHebrew).map((sentence, i) => (
              <li
                key={i}
                // לבן, טקסט כחול, מסגרת אדומה (בקשת הלקוחה, 2026-11-08)
                className="glass glass-brick glass-raised frame-red flex items-start gap-4 rounded-2xl p-6"
                style={{
                  animation: `glass-in var(--ds-dur-slow) ${i * 120}ms var(--ds-ease) both`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="glass glass-active slot-chosen flex h-10 w-10 flex-none items-center justify-center diamond text-base font-extrabold"
                >
                  {i + 1}
                </span>
                <p className="text-ink text-xl leading-relaxed">{sentence}</p>
              </li>
            ))}
          </ol>

          {/* לפי בקשת הלקוחה: לא הצעת AI מוצגת כאן - תיבה ריקה שהקבוצה
              עצמה מקלידה לתוכה את המסקנה המעשית שלה. הלבנה הזו מודגשת
              (glass-strong) כי היא הפעולה היחידה במסך. */}
          <div className="glass glass-strong glass-brick glass-raised frame-red rounded-2xl p-5">
            {/* הכותרת באדום (בקשת הלקוחה, 2026-11-08) */}
            <label
              htmlFor="group-conclusion"
              className="text-red-head mb-3 flex items-center justify-center gap-2 text-center text-lg font-extrabold"
            >
              <Icon name="lightbulb" size={20} />
              על סמך ההבנות למעלה - כתבו מסקנה מעשית שתלווה את כל השלבים הבאים
            </label>
            <textarea
              key={shakeKey}
              ref={conclusionRef}
              id="group-conclusion"
              className={cx(
                "glass-input !border-pal-4 text-navy h-24 w-full resize-none !rounded-xl !border-2 !bg-white py-4 !text-xl",
                conclusionMissing && !groupConclusion.trim() && "!border-accent ring-accent/35 !border-2 ring-4",
              )}
              style={
                conclusionMissing && !groupConclusion.trim()
                  ? { animation: "shake-x 420ms var(--ds-ease) both" }
                  : undefined
              }
              rows={2}
              value={groupConclusion}
              onChange={(e) => setGroupConclusion(e.target.value)}
              // ההסבר בתוך התיבה ולא בשורה נוספת מתחתיה - המסך כבר מלא עד הסוף
              placeholder={conclusionMissing ? "כדי להמשיך, כתבו כאן קודם מסקנה מעשית..." : "הקלידו כאן..."}
              aria-invalid={conclusionMissing && !groupConclusion.trim()}
            />
          </div>
        </div>
      )}
    </StageShell>
  );
}

/**
 * שלב 4 - ניתוח דילמה. שלושה מסכים פנימיים (state מקומי `step`, לא
 * stage_number נפרד): "marking" (שקף 6), "table" (שקף 7 - טבלת הסנכרון
 * האוטומטית), ו-"functioning_picture" (שקף 8 - תמונת תפקוד ב-AI, ראו
 * FunctioningPictureStep למעלה).
 *
 * "סולם ההשראות" (InspirationsLadder) כבר לא חלק מהקומפוננטה הזו - מוזרק
 * גלובלית ב-StageRouter לכל השלבים משלב 4 ואילך (לפי בקשת הלקוחה).
 *
 * מסך marking - טקסט פרופיל (עדיין placeholder - התוכן האמיתי יגיע מהלקוחה) שכל קבוצה מסמנת בעצמה בגרירה -
 * ירוק לחוזקות, אדום לחסמים, עם כלי מחק נפרד (לפי ההחלטה בסעיף 12 ב-CLAUDE.md:
 * סימון בגרירה על פני הטקסט, לא בחירת התחלה/סוף). מיד בסיום כל גרירה שצבעה
 * טקסט (לא מחק) נפתח פופ-אפ (CategoryPopup) לבחירת קטגוריה מרשימה סגורה
 * (content.categories - גנרי, לא כתוב בקוד: היום פדגוגי, מחר תחום אחר) - כך
 * נוצר TaggedPhrase (useTextMarking). זו בחירה מפורשת של הלקוחה: לא AI/API,
 * לא הקלדה חופשית - רשימה קבועה מראש שהקבוצה בוחרת ממנה.
 *
 * מעבר בין המסכים: לחיצה "הבא" במסך marking לא מתקדמת לשלב 5 - היא עוברת
 * למסך table (מאפשר לתקן/למחוק סימונים לפני שהטבלה נקבעת, כפי שהלקוחה ביקשה
 * במפורש). הטבלה עצמה (PhraseColumn) נבנית מ-phrases שכבר נאספו, לא מחדש
 * מה-marks. "המשך לניסוח תמונת תפקוד כוללת" במסך table עובר למסך
 * functioning_picture (לא ל-onAdvance ישירות) - רק הכפתור "המשך" שם, אחרי
 * שהניסוח מוכן, מתקדם בפועל לשלב 5.
 *
 * הצביעה בפועל היא ציור על canvas שיושב *מתחת* לטקסט (z-0, מול הטקסט
 * שמעליו ב-z-10 - ראו ה-<p> למטה), ברמת אות בודדת (לא מילה שלמה): כל אות
 * מקבלת מלבן צבוע שתפור בדיוק למידות שלה (fillCharShape), כך שהתחושה היא
 * צביעה אות-אחרי-אות ממש כמו מרקר אמיתי - לא כתם עגול חופשי. אין ציור
 * freehand נפרד על ה-canvas (לא stroke עם קו עגול) - כל מה שנצבע הוא רק
 * ריבועי אותיות, כדי שהצורה הסופית תמיד תישאר מרובעת ותואמת לטקסט, ולא
 * תיצור כתמים עגולים שלא מתאימים לכלום מסביבם.
 * חשוב: הצבע מלא (STROKE_ALPHA=1), לא שקוף-למחצה - כמו רקע-הדגשה אמיתי
 * (ה-mark/highlight הרגיל בעיצוב טקסט), ולא כמו טשטוש-שכבות. זה עובד כי
 * סדר השכבות הפוך ממה שאפשר לחשוב: הטקסט מצויר *מעל* ה-canvas, אז הוא
 * תמיד חד וקריא במלואו בלי קשר לעוצמת הרקע מתחתיו - הרקע לא "מסתיר" כלום.
 * הציור עצמו הוא source-over רגיל, לא multiply - multiply-על-canvas גרם
 * בעבר לסימון להכהות עד שחור כשחוזרים על אותו מקום.
 * הנתון שנשמר הוא marks[i] - צבע האות מספר i בטקסט (לא ספירת רווחים); זה
 * מה שצריך לשלבים הבאים (למשל טבלת הסנכרון). ה-canvas רק מצייר, ומשוחזר
 * מ-marks בכל טעינה מחדש.
 *
 * נגישות למגע: זיהוי איזו אות האצבע "נוגעת בה" לא מתבסס על פגיעה פיקסלית
 * מדויקת (document.elementFromPoint) אלא על האות הקרובה ביותר בתוך רדיוס
 * סלחני (TOUCH_TOLERANCE_PX) - אצבע אמיתית על מסך ענק כמעט אף פעם לא נוגעת
 * בול במרכז אות בודדת וצרה. רשימת מיקומי האותיות נמדדת פעם אחת בתחילת כל
 * גרירה (cacheCharRects) ולא בכל תזוזה, כי המדידה (getBoundingClientRect)
 * יקרה יותר מהחישוב הגיאומטרי עצמו והטקסט לא זז באמצע סימון.
 *
 * גרירה מהירה: אירועי pointermove לא מגיעים על כל פיקסל בדרך, אז תזוזה
 * מהירה יכולה "לדלג" מעל כמה אותיות בין אירוע לאירוע. כדי שהתחושה עדיין
 * תהיה של צביעה רציפה (ולא אותיות מנוקדות שנפספסו), כל תזוזה דוגמת נקודות
 * ביניים במרווח קבוע (DRAG_SAMPLE_STEP_PX) ומסמנת את האות הקרובה לכל אחת
 * מהן - לא רק את נקודת הקצה של התזוזה.
 */
/*
  גבולות הגופן של הדף. הגודל בפועל נקבע אוטומטית (ראו fitPaper): הגדול
  ביותר שבו כל הטקסט נכנס בגובה הפנוי. 15px הוא הרצפה - מתחתיה הטקסט כבר
  לא קריא מרחוק, ועדיף גלילה פנימית מאשר טקסט שאי אפשר לקרוא.
*/
const PAPER_FONT_MAX = 30;
const PAPER_FONT_MIN = 15;

/* ברירות מחדל - הנוסח של הלקוחה מהתסריט (נדרס מ-content.intro ב-DB). */
const INTRO_DEFAULTS: Stage4IntroTexts = {
  lines: [
    { text: "לפני שאתן ממהרות לפתור, קחו את הדילמה ופרקו אותה לחלקים:", bold: true },
    { text: "מי התלמידה?", bold: true },
    { text: "רקע קצר." },
    { text: "סיכוי?", bold: true },
    { text: "חוזקות." },
    { text: "סיכון?", bold: true },
    { text: "חסמים." },
    { text: "ומה באמת קורה כאן?", bold: true },
    { text: "הדילמה.", bold: true },
    { text: "המטרה:" },
    { text: "לא לראות ״בעיה״.", bold: true },
    { text: "לראות מערכת שלמה של צורות וקשרים.", bold: true },
  ],
  start_label: "ועכשיו, זום אין",
  marking_hint:
    "לנוחיותכן! הדגישו קטע רלוונטי ע״י גרירה (זה עובד ממש פשוט כמו מרקר רגיל) והמערכת תציף לכן מאגר לבחירתכן של: חוזקות | חסמים | יכולות | מונחים מקצועיים שימקדו וידייקו אתכן בניסוח ובניתוח.",
};

/*
  זוכרים בדפדפן שהקבוצה כבר עברה את מסך הפתיחה, כדי שרענון באמצע הסימון
  יחזיר אותה לסימון ולא לפתיחה (סעיף 5: "מסך חוזר בדיוק למקום"). המפתח
  כולל את ההפעלה והקבוצה, כך שסדנה חדשה מתחילה שוב מהפתיחה.
*/
function introSeenKey(workshopId: string, groupId: string) {
  return `stage4-intro-seen:${workshopId}:${groupId}`;
}

function readIntroSeen(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/**
 * שלב 4 = מסך פתיחה, ואחריו הניתוח עצמו (Stage4Marking).
 *
 * הפתיחה היא רכיב נפרד ולא מסך בתוך Stage4Marking בכוונה: הדף המסומן מודד
 * את עצמו (גודל הגופן, ה-canvas) ב-effects שרצים בהרכבה. אילו הדף היה
 * מוסתר מאחורי החזרה מוקדמת, ה-effects היו רצים בלי אלמנטים למדוד ולא
 * רצים שוב כשהוא מופיע.
 */
function Stage4Analysis(props: Props) {
  const { workshopId, myGroup, content } = props;
  const key = introSeenKey(workshopId, myGroup.id);
  const [introSeen, setIntroSeen] = useState(() => readIntroSeen(key));
  // הצלילה לפרקטל רק במעבר מהפתיחה - לא אחרי רענון באמצע הסימון
  const [zoomIn, setZoomIn] = useState(false);
  const intro = { ...INTRO_DEFAULTS, ...(content.intro ?? {}) };

  if (!introSeen) {
    return (
      <StageIntro
        stage={4}
        kicker="זיהוי חוזקות וחסמים"
        icon="marker"
        background="quiet"
        lines={intro.lines}
        // "להפוך את הטקסט ליותר מעניין" (בקשת הלקוחה, 2026-11-08): אותו
        // נוסח, מוצג כפירוק - שאלות כאריחים שמתפרקים מהמרכז, ו"המטרה" בסוף
        layout="breakdown"
        startLabel={intro.start_label}
        onStart={() => {
          try {
            localStorage.setItem(key, "1");
          } catch {
            // בלי אחסון (חלון פרטי) - רק רענון יחזיר לפתיחה, וזה לא נורא
          }
          setZoomIn(true);
          setIntroSeen(true);
        }}
      />
    );
  }

  return <Stage4Marking {...props} markingHint={intro.marking_hint} zoomIn={zoomIn} />;
}

function Stage4Marking({
  workshopId,
  myGroup,
  content,
  onAdvance,
  markingHint,
  zoomIn,
}: Props & { markingHint: string; zoomIn: boolean }) {
  const { marks, phrases, loading: loadingMarks, mutate } = useTextMarking(workshopId, myGroup.id);
  const [activeTool, setActiveTool] = useState<Tool>("green");
  const [step, setStep] = useState<"marking" | "table" | "functioning_picture">("marking");
  const [pendingPhrase, setPendingPhrase] = useState<PendingPhrase | null>(null);
  const marksRef = useRef<MarkColor[]>([]);
  const phrasesRef = useRef<TaggedPhrase[]>([]);
  const isDraggingRef = useRef(false);
  const activeToolRef = useRef<Tool>("green");
  const dragToolRef = useRef<Tool>("green");
  const touchedIndicesRef = useRef<Set<number>>(new Set());
  const lastClientPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastCharIndexRef = useRef<number | null>(null);
  /** סיום הגרירה (אותה פונקציה של הרמת האצבע) - נקרא גם כשהיד נעצרת. */
  const finishDragRef = useRef<() => void>(() => {});
  const dwellTimerRef = useRef<number | null>(null);
  const capturedPointerRef = useRef<number | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** האזור הפנוי לדף (בין הכותרת לכפתור) - לפיו נקבע גודל הגופן. */
  const paperAreaRef = useRef<HTMLDivElement>(null);
  const paperFrameRef = useRef<HTMLDivElement>(null);
  const paperTextRef = useRef<HTMLParagraphElement>(null);
  const [paperFontPx, setPaperFontPx] = useState(PAPER_FONT_MAX);
  const charRectsRef = useRef<{ index: number; rect: DOMRect }[]>([]);

  const wordGroups = useMemo<CharCell[][]>(() => {
    const words = content.profile_text.split(/\s+/).filter(Boolean);
    let idx = 0;
    return words.map((word) => Array.from(word).map((ch) => ({ ch, index: idx++ })));
  }, [content.profile_text]);

  // ממפה כל אינדקס-אות לתו המקורי שלו ולסימון "יש רווח אחריי" - כדי שאפשר
  // יהיה לשחזר את הטקסט הרציף (עם רווחים בין מילים) של כל טווח אינדקסים,
  // בלי להסתמך על האינדקסים עצמם (שמדלגים על רווחים, ראו wordGroups למעלה).
  const { charByIndex, spaceAfterIndex } = useMemo(() => {
    const map: string[] = [];
    const spaces = new Set<number>();
    wordGroups.forEach((word, wi) => {
      word.forEach(({ ch, index }) => {
        map[index] = ch;
      });
      if (wi < wordGroups.length - 1 && word.length > 0) {
        spaces.add(word[word.length - 1].index);
      }
    });
    return { charByIndex: map, spaceAfterIndex: spaces };
  }, [wordGroups]);

  function textForRange(start: number, end: number): string {
    let out = "";
    for (let i = start; i <= end; i++) {
      out += charByIndex[i] ?? "";
      if (i < end && spaceAfterIndex.has(i)) out += " ";
    }
    return out;
  }

  /**
   * אחרי מחיקה שפגעה בקטע מתויג, בודקת אם נשאר ממנו "גדם" שעדיין מגיע עד
   * בדיוק אותה נקודת סיום (הפיסוק המקורי שלו, אם הוא עצמו לא נמחק) - זה
   * בדיוק כמו קטע שסומן זה עתה, וצריך לקפוץ עם אותו פופ-אפ לתיוג מחדש.
   * הבדיקה ממוסגרת בדיוק לתחום המקורי של הביטוי שנמחק (p.startIndex עד
   * p.endIndex בלבד) ולא סורקת מעבר לו - כדי שלא "תבלע" בטעות משפט שכן
   * צמוד באותו צבע ועדיין מתויג כרגיל.
   */
  function findErasedPhraseRemnant(
    p: TaggedPhrase,
    marksArray: MarkColor[],
  ): { color: "green" | "red"; startIndex: number; endIndex: number } | null {
    if (marksArray[p.endIndex] !== p.color) return null; // הפיסוק עצמו נמחק - אין מה לתייג
    let start = p.endIndex;
    while (start > p.startIndex && marksArray[start - 1] === p.color) start--;
    return { color: p.color, startIndex: start, endIndex: p.endIndex };
  }

  const loading = loadingMarks;

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // מסתנכרן מהשרת רק כשלא באמצע גרירה - כמו marksRef למטה, כדי לא לדרוס
  // תיוג מקומי טרי (מיד אחרי מיזוג/מחיקה בסיום גרירה) בתשובה ישנה מהשרת.
  useEffect(() => {
    if (!isDraggingRef.current) {
      phrasesRef.current = phrases;
    }
  }, [phrases]);

  function getContext() {
    const canvas = canvasRef.current;
    return canvas?.getContext("2d") ?? null;
  }

  /** מכינה את הרזולוציה הפנימית של ה-canvas לפי גודל התיבה בפועל ו-DPR, כדי שהקו ייצא חד גם על מסך מגע בחדות גבוהה. */
  function setupCanvas() {
    const canvas = canvasRef.current;
    const paper = paperRef.current;
    if (!canvas || !paper) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = paper.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** מציירת מחדש את כל הסימונים לפי marks[] - מלבן שתפור לכל אות מסומנת בנפרד. */
  function redrawFromMarks(marksArray: MarkColor[]) {
    const ctx = getContext();
    const paper = paperRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !paper || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const paperRect = paper.getBoundingClientRect();
    marksArray.forEach((color, i) => {
      if (!color) return;
      const charEl = paper.querySelector<HTMLElement>(`[data-char-index="${i}"]`);
      if (!charEl) return;
      fillCharShape(ctx, charEl, paperRect, color);
    });
    ctx.restore();
  }

  // מסתנכרן מהשרת רק כשלא באמצע גרירה - כדי לא לדרוס סימון שעדיין לא נשמר.
  useEffect(() => {
    if (!isDraggingRef.current) {
      marksRef.current = marks;
      // מחכה לפריים הבא כדי שה-DOM של האותיות כבר יהיה בגודל הסופי לפני שממדדים אותו.
      requestAnimationFrame(() => redrawFromMarks(marks));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks]);

  /*
    התאמת הדף לגובה המסך: **המסגרת עוטפת את הטקסט בדיוק, ואין גלילה.**

    קודם המסגרת מילאה את כל הגובה והטקסט גלל בתוכה - השורה האחרונה
    נחתכה, והמסגרת לא "ישבה" על הטקסט. כאן מחפשים את הגופן הגדול ביותר
    שבו המסגרת כולה נכנסת לאזור הפנוי. המדידה נעשית ישירות על ה-DOM
    (סינכרונית, לפני ציור), ורק התוצאה נכתבת ל-state.
  */
  useLayoutEffect(() => {
    if (loading) return;
    const area = paperAreaRef.current;
    const frame = paperFrameRef.current;
    const text = paperTextRef.current;
    if (!area || !frame || !text) return;

    function fitPaper() {
      if (!area || !frame || !text) return;
      const available = area.clientHeight;
      let size = PAPER_FONT_MAX;
      text.style.fontSize = `${size}px`;
      // המסגרת מוגבלת ב-max-h-full, ולכן גובהה לבדו לא יעבור את הפנוי -
      // גלישה נמדדת גם לפי scrollHeight מול clientHeight.
      const overflows = () =>
        frame.offsetHeight > available || frame.scrollHeight > frame.clientHeight + 1;
      while (size > PAPER_FONT_MIN && overflows()) {
        size -= 1;
        text.style.fontSize = `${size}px`;
      }
      setPaperFontPx(size);
    }

    fitPaper();
    const ro = new ResizeObserver(() => fitPaper());
    ro.observe(area);
    return () => ro.disconnect();
  }, [loading, wordGroups]);

  // אחרי שינוי גופן האותיות זזו - ה-canvas נמדד מחדש והסימונים מצוירים שוב.
  useEffect(() => {
    if (loading) return;
    setupCanvas();
    redrawFromMarks(marksRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperFontPx, loading]);

  // תלוי ב-loading בכוונה, לא ב-[]: בזמן הטעינה עדיין אין canvas/paper ב-DOM
  // בכלל (התצוגה שם היא "טוענת..."), אז effect עם [] היה נתפס לרגע ההוא -
  // ה-refs עדיין null אז setupCanvas היה עושה כלום, ובלי תלות זה לא היה
  // רץ שוב אף פעם. ברגע ש-loading הופך false, האלמנטים כבר קיימים באמת.
  useEffect(() => {
    if (loading) return;
    setupCanvas();
    redrawFromMarks(marksRef.current);
    function handleResize() {
      setupCanvas();
      redrawFromMarks(marksRef.current);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    function handleWindowPointerUp() {
      if (dwellTimerRef.current !== null) {
        window.clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      // משחררת את הלכידה מיד: כל עוד הדף "מחזיק" את העכבר, הסמן נשאר טוש
      // גם מעל הפופ-אפ (כשהוא קופץ מעצירת היד והכפתור עדיין לחוץ).
      if (capturedPointerRef.current !== null) {
        try {
          paperRef.current?.releasePointerCapture?.(capturedPointerRef.current);
        } catch {
          // הלכידה כבר שוחררה
        }
        capturedPointerRef.current = null;
      }
      lastClientPointRef.current = null;
      lastCharIndexRef.current = null;
      const tool = dragToolRef.current;
      const touched = touchedIndicesRef.current;
      touchedIndicesRef.current = new Set();

      if (tool === "eraser") {
        const marksSnapshot = marksRef.current;
        // כל קטע מתויג שנגעו באחד מהתווים שלו - התיוג כבר לא תקף (הטקסט
        // שמאחוריו נמחק/השתנה); הקבוצה יכולה לסמן ולתייג מחדש אם צריך.
        const surviving: TaggedPhrase[] = [];
        const erased: TaggedPhrase[] = [];
        for (const p of phrasesRef.current) {
          let hit = false;
          for (let i = p.startIndex; i <= p.endIndex; i++) {
            if (touched.has(i)) {
              hit = true;
              break;
            }
          }
          (hit ? erased : surviving).push(p);
        }
        phrasesRef.current = surviving;
        const survivingIds = new Set(surviving.map((p) => p.id));
        mutate((current) => ({
          marks: marksSnapshot,
          phrases: current.phrases.filter((p) => survivingIds.has(p.id)),
        }));

        // רק אם קטע שאיבד את התיוג שלו כרגע עדיין מגיע, בלי הפרעה, עד בדיוק
        // הפיסוק שהיה לו - קופצת שוב אותה שאלת תיוג, ורק עליו (לא על משפט
        // שכן צמוד שכבר יש לו תיוג משלו, וגם לא אם הפיסוק עצמו נמחק).
        let popped = false;
        for (const p of erased) {
          const remnant = findErasedPhraseRemnant(p, marksSnapshot);
          if (remnant) {
            setPendingPhrase({
              color: remnant.color,
              startIndex: remnant.startIndex,
              endIndex: remnant.endIndex,
              text: textForRange(remnant.startIndex, remnant.endIndex),
            });
            popped = true;
            break; // פופ-אפ אחד בכל פעם, כמו בכל שאר הזרימה
          }
        }

        // מקרה שני, בלי קשר לביטוי מתויג בכלל: אם המשיכו בטעות עם הצבע
        // מעבר לנקודה (הצביעה לא נעצרה בפיסוק, אז לא קפץ פופ-אפ מלכתחילה),
        // ואז מחקו אחורה בדיוק עד הנקודה - מה שנשאר עכשיו מסתיים בדיוק
        // בפיסוק, בדיוק כמו גרירה חדשה שהייתה נעצרת שם. התו הראשון שנמחק
        // (touched המוקדם ביותר, פחות 1) הוא הגבול - אם הוא בדיוק פיסוק
        // שעדיין צבוע ולא מתויג, זו בדיוק הסיטואציה.
        if (!popped) {
          const boundary = Math.min(...touched) - 1;
          const boundaryColor = boundary >= 0 ? marksSnapshot[boundary] : null;
          const boundaryIsPunctuation = charByIndex[boundary] === "," || charByIndex[boundary] === ".";
          const alreadyTagged =
            boundaryColor && surviving.some((p) => p.color === boundaryColor && p.endIndex === boundary);
          if (boundaryColor && boundaryIsPunctuation && !alreadyTagged) {
            const taggedIndices = new Set<number>();
            for (const p of surviving) {
              if (p.color !== boundaryColor) continue;
              for (let i = p.startIndex; i <= p.endIndex; i++) taggedIndices.add(i);
            }
            let start = boundary;
            while (start > 0 && marksSnapshot[start - 1] === boundaryColor && !taggedIndices.has(start - 1)) start--;
            setPendingPhrase({
              color: boundaryColor,
              startIndex: start,
              endIndex: boundary,
              text: textForRange(start, boundary),
            });
          }
        }
        return;
      }

      if (touched.size === 0) {
        mutate((current) => ({ marks: marksRef.current, phrases: current.phrases }));
        return;
      }

      // נקודת השחרור בפועל של הגרירה הזו (לפני ההרחבה כלפי חוץ למטה).
      let dragEnd = Math.max(...touched);

      // "הצמדה" לפיסוק: סימן פיסוק הוא תו צר וצמוד לאות שלפניו (אין רווח
      // ביניהם), וקל להחמיץ אותו באצבע/עכבר בלי לשים לב שעצרו תו אחד לפני
      // הסוף. אם התו הבא-בתור אחרי נקודת השחרור הוא בדיוק פסיק/נקודה - צובעים
      // גם אותו ומתייחסים אליו כאילו נגעו בו, כמו שכבר קורה לאותיות עם
      // TOUCH_TOLERANCE_PX.
      const nextChar = charByIndex[dragEnd + 1];
      if (nextChar === "," || nextChar === ".") {
        const snapIndex = dragEnd + 1;
        touched.add(snapIndex);
        markChar(snapIndex, tool);
        const ctx = getContext();
        const paper = paperRef.current;
        const charEl = paper?.querySelector<HTMLElement>(`[data-char-index="${snapIndex}"]`);
        if (ctx && paper && charEl) fillCharShape(ctx, charEl, paper.getBoundingClientRect(), tool);
        dragEnd = snapIndex;
      }

      // נלקח אחרי ה"הצמדה" למעלה, כדי ש-marksSnapshot יכלול גם את תו הפיסוק
      // שנצבע כרגע (אם היה).
      const marksSnapshot = marksRef.current;

      // התחום שאסור לחצות בהרחבה למטה: כל אינדקס ששייך לביטוי שכבר תויג
      // בקטגוריה (מאותו צבע) - לפי ההוראה המפורשת: "משפט שכבר יש לו כותרת
      // לא מתחבר למשפט הבא". בלי זה, גרירה חדשה שמתחילה צמוד למשפט קודם
      // שכבר תויג (בלי רווח מפריד באינדקסים, ראו charByIndex) הייתה "בולעת"
      // אותו בטעות לתוך הקטע החדש.
      const taggedIndices = new Set<number>();
      for (const p of phrasesRef.current) {
        if (p.color !== tool) continue;
        for (let i = p.startIndex; i <= p.endIndex; i++) taggedIndices.add(i);
      }

      // מרחיבה את התחום שנצבע בפועל בגרירה הזו כלפי חוץ, כדי למזג עם קטע
      // קיים צמוד מאותו צבע שעדיין לא תויג (למשל המשך גרירה על טקסט שכבר
      // סומן בעבר) - אבל עוצרת בדיוק בגבול של ביטוי שכבר תויג, ולא חוצה אותו.
      let start = Math.min(...touched);
      let end = dragEnd;
      while (start > 0 && marksSnapshot[start - 1] === tool && !taggedIndices.has(start - 1)) start--;
      while (end < marksSnapshot.length - 1 && marksSnapshot[end + 1] === tool && !taggedIndices.has(end + 1)) end++;

      // כל ביטוי מתויג (בכל צבע, לא רק אותו כלי) שהתגרירה הזו צבעה ממש מעל
      // אחד מהתווים שלו - התיוג שלו כבר לא נכון (הצבע האמיתי על המסך השתנה),
      // ולכן מוסר. לפי ההוראה: לכל מילה כותרת אחת בלבד, לא כמה כותרות
      // חופפות לאותה מילה.
      const overwrittenIds = new Set(
        phrasesRef.current
          .filter((p) => {
            for (let i = p.startIndex; i <= p.endIndex; i++) if (touched.has(i)) return true;
            return false;
          })
          .map((p) => p.id),
      );
      if (overwrittenIds.size > 0) {
        phrasesRef.current = phrasesRef.current.filter((p) => !overwrittenIds.has(p.id));
      }

      // שומרת מיד את הצביעה עצמה (בלי לחכות לבחירת קטגוריה) - התיוג הוא שכבה
      // נפרדת מעליה, ונשמר בנפרד כשבוחרים קטגוריה (confirmCategory) או מבוטל.
      mutate((current) => ({
        marks: marksSnapshot,
        phrases: current.phrases.filter((p) => !overwrittenIds.has(p.id)),
      }));

      // דרישת הלקוחה: הפופ-אפ קופץ **בכל הרמת אצבע** שצבעה טקסט - לא רק
      // כשעוצרים על פסיק/נקודה. ה"הצמדה" לפיסוק למעלה נשארת, כדי שקטע
      // שנגמר תו אחד לפני הנקודה יכלול אותה.
      setPendingPhrase({ color: tool, startIndex: start, endIndex: end, text: textForRange(start, end) });
    }
    // capture + pointercancel: סוף גרירה שלא הגיע כ-pointerup רגיל (הדפדפן
    // ביטל את המגע, או שחרור מחוץ לדף) השאיר את הגרירה "פתוחה", והפופ-אפ
    // קפץ רק בלחיצה הבאה. עכשיו כל סיום של המגע סוגר את הגרירה ומקפיץ אותו.
    finishDragRef.current = handleWindowPointerUp;
    window.addEventListener("pointerup", handleWindowPointerUp, true);
    window.addEventListener("pointercancel", handleWindowPointerUp, true);
    return () => {
      if (dwellTimerRef.current !== null) window.clearTimeout(dwellTimerRef.current);
      window.removeEventListener("pointerup", handleWindowPointerUp, true);
      window.removeEventListener("pointercancel", handleWindowPointerUp, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function confirmCategory(category: string) {
    const pending = pendingPhrase;
    if (!pending) return;
    setPendingPhrase(null);
    const newPhrase: TaggedPhrase = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      color: pending.color,
      category,
      text: pending.text,
      startIndex: pending.startIndex,
      endIndex: pending.endIndex,
    };
    // מסירה כל ביטוי קיים שחופף בטווח האינדקסים (בכל צבע, לא רק אותו צבע) -
    // לכל מילה כותרת אחת בלבד, אף פעם לא כמה כותרות חופפות לאותה מילה.
    mutate((current) => ({
      marks: current.marks,
      phrases: [
        ...current.phrases.filter((p) => p.endIndex < pending.startIndex || p.startIndex > pending.endIndex),
        newPhrase,
      ],
    }));
  }

  function markChar(index: number, color: MarkColor) {
    const next = marksRef.current.slice();
    next[index] = color;
    marksRef.current = next;
  }

  /** ממדדת את כל האותיות פעם אחת בתחילת הגרירה - זול יותר מלמדוד מחדש בכל תזוזה, ומספיק כי הטקסט לא זז תוך כדי סימון. */
  function cacheCharRects() {
    const paper = paperRef.current;
    if (!paper) return;
    const elements = paper.querySelectorAll<HTMLElement>("[data-char-index]");
    charRectsRef.current = Array.from(elements).map((el) => ({
      index: Number(el.dataset.charIndex),
      rect: el.getBoundingClientRect(),
    }));
  }

  /**
   * מוצאת את האות הקרובה ביותר לנקודת המגע, לא רק אות שנוגעים בה בול -
   * זו הנגישות האמיתית פה: אצבע על מסך ענק כמעט אף פעם לא מדויקת פיקסל-פיקסל,
   * אז מרחק עד TOUCH_TOLERANCE_PX מהאות עדיין "תופס" אותה כאילו נגעו בה.
   */
  function nearestCharAt(clientX: number, clientY: number): number | null {
    let bestIndex: number | null = null;
    let bestDist = Infinity;
    for (const { index, rect } of charRectsRef.current) {
      const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
      const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = index;
      }
    }
    return bestDist <= TOUCH_TOLERANCE_PX ? bestIndex : null;
  }

  /** true אם האות באינדקס הזה כבר שייכת לביטוי מתויג קיים (בכל צבע). */
  function isTaggedIndex(index: number): boolean {
    for (const p of phrasesRef.current) {
      if (index >= p.startIndex && index <= p.endIndex) return true;
    }
    return false;
  }

  /**
   * מסמנת אות שנחדשה - הן בנתון והן ויזואלית, מיד, בלי לחכות לסבב
   * mutate/realtime. הציור המיידי הוא בצורת האות עצמה (fillCharShape, אותה
   * פונקציה בדיוק כמו בשחזור), לא עיגול/פס גנרי בנקודת המגע - כדי שגם נגיעה
   * בודדת בלי שום גרירה תיראה כמו הדגשת אות אמיתית, לא כתם.
   *
   * אות ששייכת כבר לביטוי מתויג נעולה בפני המרקר (ירוק/אדום) - רק המחק
   * יכול לגעת בה. בלי זה, גרירה שמתחילה או עוברת בטעות דרך משפט שכבר יש
   * לו כותרת הייתה יכולה "לבלוע" אותו לתוך ביטוי חדש; ההגנה כאן (ולא רק
   * בהרחבה בסיום הגרירה, ראו handleWindowPointerUp) חוסמת את זה כבר בשלב
   * הציור עצמו, גם כשהאצבע ממש עוברת מעל האות המתויגת ולא רק צמודה אליה.
   */
  function updateCharAt(clientX: number, clientY: number, tool: Tool) {
    const index = nearestCharAt(clientX, clientY);
    if (index === null) return;
    if (lastCharIndexRef.current === index) return;
    lastCharIndexRef.current = index;
    if (tool !== "eraser" && isTaggedIndex(index)) return;
    touchedIndicesRef.current.add(index);
    markChar(index, tool === "eraser" ? null : tool);
    const ctx = getContext();
    const paper = paperRef.current;
    const charEl = paper?.querySelector<HTMLElement>(`[data-char-index="${index}"]`);
    if (ctx && paper && charEl) {
      fillCharShape(ctx, charEl, paper.getBoundingClientRect(), tool);
    }
  }

  function handlePaperPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    isDraggingRef.current = true;
    // הדף ממשיך לקבל את המגע עד ההרמה, גם אם האצבע/העכבר יצאו ממנו
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      capturedPointerRef.current = e.pointerId;
    } catch {
      // דפדפן ישן בלי pointer capture - מאזין החלון עדיין תופס את ההרמה
    }
    dragToolRef.current = activeToolRef.current;
    touchedIndicesRef.current = new Set();
    cacheCharRects();
    lastClientPointRef.current = { x: e.clientX, y: e.clientY };
    lastCharIndexRef.current = null;
    updateCharAt(e.clientX, e.clientY, activeToolRef.current);
  }

  function handlePaperPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;
    const tool = activeToolRef.current;
    const to = { x: e.clientX, y: e.clientY };
    const from = lastClientPointRef.current ?? to;
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(dist / DRAG_SAMPLE_STEP_PX));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      updateCharAt(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, tool);
    }
    lastClientPointRef.current = to;

    // דרישת הלקוחה: הפופ-אפ קופץ ברגע שהיד **נעצרת**, גם בלי להרים אותה.
    // כל תזוזה אמיתית (לא רעד קטן של אצבע) מאפסת את השעון; עצירה של
    // DWELL_MS מסיימת את הגרירה בדיוק כמו הרמה. ההרמה שתבוא אחר כך
    // כבר לא עושה כלום (isDraggingRef כבוי).
    if (dist >= DWELL_JITTER_PX || dwellTimerRef.current === null) {
      if (dwellTimerRef.current !== null) window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = window.setTimeout(() => {
        dwellTimerRef.current = null;
        if (isDraggingRef.current && touchedIndicesRef.current.size > 0) finishDragRef.current();
      }, DWELL_MS);
    }
  }

  if (loading) {
    return <LoadingState title="רגע אחד" description="טוען..." />;
  }

  // שקף 7 - טבלת הסנכרון האוטומטית: נבנית מהקטעים המתויגים שכבר נאספו
  // תוך כדי הסימון, ומוצגת רק אחרי שהקבוצה לחצה "הבא" בסיום ההדגשה (לא
  // באופן שוטף תוך כדי גרירה) - כך שהקבוצה יכולה למחוק/לתקן סימונים לפני
  // שהטבלה הסופית נקבעת.
  if (step === "table") {
    const strengths = phrases.filter((p) => p.color === "green");
    const blockers = phrases.filter((p) => p.color === "red");
    return (
      <StageShell
        stage={4}
        kicker="חוזקות וחסמים"
        compactHeader
        icon="ladder"
        title="מערכת אפיון אוטומטית"
        subtitle="המערכת ריכזה עבורכן את הנתונים עפ״י הסימונים שלכן, נשאר לכן לוודא שכולנו באותה צורה."
        background="quiet"
        width="wide"
        actions={
          <GlassButton
            variant="primary"
            size="lg"
            iconAfter="arrowNext"
            onClick={() => setStep("functioning_picture")}
          >
            המשך לניסוח תמונת תפקוד כוללת
          </GlassButton>
        }
      >
        {/* flex-1 + max-h-full בכרטיסים: הכרטיס לא גבוה מהאזור, הכותרת שלו
            נשארת במקום ורק השורות גוללות בתוכו (קודם כל האזור נגלל והכותרת נחתכה). */}
        <div className="flex min-h-0 w-full flex-1 flex-col gap-6 lg:flex-row lg:items-start">
          <PhraseColumn title="חוזקות שזוהו" color="green" phrases={strengths} />
          <PhraseColumn title="חסמים שזוהו" color="red" phrases={blockers} />
        </div>
      </StageShell>
    );
  }

  if (step === "functioning_picture") {
    return (
      <FunctioningPictureStep workshopId={workshopId} groupId={myGroup.id} onAdvance={onAdvance} />
    );
  }

  return (
    <StageShell
      stage={4}
      kicker="זיהוי חוזקות וחסמים"
      icon="marker"
      title="ניתוח דילמה"
      subtitle={markingHint}
      background="quiet"
      width="wide"
      // הדף והמגש ממורכזים בין מד ההתקדמות לטיימר (שיושבים בפינות), כך
      // שהרצועה התחתונה שנשמרת להם רק גזלה גובה - במסך נמוך (או זום 125%)
      // המסגרת והמגש נחתכו בתחתית. compactHeader מאותה סיבה.
      tightBottom
      compactHeader
      actions={
        <GlassButton
          variant="primary"
          size="lg"
          iconAfter="arrowNext"
          onClick={() => setStep("table")}
        >
          הבא
        </GlassButton>
      }
      overlay={
        <>
          {zoomIn && <ZoomIntro />}
          {pendingPhrase && (
            <CategoryPopup
              pending={pendingPhrase}
              categories={content.categories ?? []}
              onChoose={confirmCategory}
              onCancel={() => setPendingPhrase(null)}
            />
          )}
        </>
      }
    >
      {/* קופסת הכלים - שלושת המרקרים יושבים בתוך לבנה אחת, כמו מודול
          הכפתורים בלוח הבקרה, ולא מרחפים בנפרד על הדף. */}
      {/*
        המגש **בצד** הדף ולא מעליו (במסך רחב).

        כשהמרקרים ישבו מעל הדף, הם לקחו כ-200 פיקסלים מהגובה, והדף
        עצמו - שהוא כל העבודה בשלב הזה - נשאר עם חלון של שלוש שורות.
        בצד הם לא גוזלים גובה בכלל, וזה גם המקום הטבעי של מגש עטים:
        ליד הדף, לא מעליו. במסך צר אין מקום בצד, ושם הם חוזרים למעלה.
        הכלים שוכבים (ראו MarkerBody), ולכן שלושתם יחד נמוכים מהדף גם
        במסך נמוך, והמגש ממורכז לצידו.
      */}
      {/* `lg:pt-5`: המרקר הפעיל מורם מעל המגש, ובלי מרווח הוא נחתך בקצה העליון של אזור התוכן. */}
      <div
        className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-5 lg:translate-x-8 lg:flex-row lg:items-start lg:pt-5"
      >
      {/* המגש. שטוח ונמוך בכוונה (glass-dim) - הכלים הם הגיבורים כאן,
          והמגש רק מחזיק אותם; לבנה עבה מסביבם הייתה מתחרה בהם. */}
      {/* המגש אדום (בקשת הלקוחה, 2026-11-08), והכלים עליו לבנים */}
      <div className="glass glass-raised tray-red flex flex-none flex-wrap items-center justify-center gap-4 rounded-2xl p-3 lg:flex-col lg:flex-nowrap lg:items-stretch lg:self-center lg:p-5">
        <MarkerTool
          tool="green"
          label="חוזקות"
          active={activeTool === "green"}
          onClick={() => setActiveTool("green")}
        />
        <MarkerTool
          tool="red"
          label="חסמים"
          active={activeTool === "red"}
          onClick={() => setActiveTool("red")}
        />
        <EraserTool active={activeTool === "eraser"} onClick={() => setActiveTool("eraser")} />
      </div>

        <div ref={paperAreaRef} className="flex h-full min-h-0 flex-1 flex-col pb-4">
      {/*
        הדף.

        הוא נשאר **בהיר** ולא הופך לזכוכית כהה, וזו החלטה ולא פשרה: מרקר
        עובד על נייר. צבעי ההדגשה (ירוק לחוזקה, אדום לחסם) נקראים רק על
        משטח בהיר, והמטאפורה כולה - יד שמעבירה מרקר על טקסט - נשענת על כך
        שזה נראה כמו דף. מה שהשתנה: הנייר כבר לא בז' חמים אלא מנטה חיוור,
        כך שהוא יושב בתוך שפת הזכוכית במקום להיראות כמו גזיר מפרויקט אחר,
        והוא ממוסגר בלבנת זכוכית שמחזיקה אותו.
      */}
      {/* בגובה הטקסט (לא flex-1): המסגרת נגזרת מהדף. `max-h-full` + גלילה
          הם רק רשת ביטחון למקרה שגם ברצפת הגופן הטקסט לא נכנס. */}
      <div
        ref={paperFrameRef}
        className="glass glass-brick glass-raised glass-scroll max-h-full w-full flex-none overflow-y-auto rounded-2xl p-3"
      >
        <div
          ref={paperRef}
          className="relative w-full rounded-xl p-6 lg:p-8"
          style={{
            background: "linear-gradient(180deg, #fffcfa 0%, #f8efea 100%)",
            boxShadow: "inset 0 2px 20px -8px rgba(8, 48, 45, 0.35)",
            touchAction: "none",
            // סמן העכבר עצמו הופך למכחול בצבע הכלי הפעיל - כדי שיהיה ברור על מה
            // בדיוק לוחצים בלי להסתמך על נקודה שמצטיירת רק אחרי הלחיצה עצמה.
            cursor: brushCursor(
              activeTool === "eraser" ? ERASER_CURSOR_COLOR : STROKE_COLOR[activeTool],
            ),
          }}
          onPointerDown={handlePaperPointerDown}
          onPointerMove={handlePaperPointerMove}
        >
          {/* z-10 מעל ה-canvas בכוונה: הטקסט מצויר מעל שכבת הצביעה, לא מתחתיה -
              כמו רקע-הדגשה אמיתי (mark/highlight), כדי שהאותיות תמיד יישארו
              חדות וקריאות במלואן, גם כשהרקע הצבוע מתחתן מלא/חזק ולא שקוף. */}
          <p
            ref={paperTextRef}
            className="relative z-10 leading-loose text-[#283d5b] select-none"
            style={{ fontSize: `${paperFontPx}px` }}
          >
            {wordGroups.map((chars, wi) => (
              <span key={wi}>
                {/* עטיפת nowrap סביב אותיות המילה - כל אות היא span נפרד לצביעה
                    עצמאית, אבל המילה כולה לא נשברת לשתי שורות. בלי cursor-pointer
                    בכוונה - היה דורס את סמן המכחול המותאם-אישית שמוגדר על תיבת
                    הנייר כולה. */}
                <span style={{ whiteSpace: "nowrap" }}>
                  {chars.map(({ ch, index }) => (
                    <span key={index} data-char-index={index}>
                      {ch}
                    </span>
                  ))}
                </span>{" "}
              </span>
            ))}
          </p>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 z-0 h-full w-full"
            style={{ pointerEvents: "none" }}
          />
        </div>
      </div>
        </div>
      </div>
    </StageShell>
  );
}

export default Stage4Analysis;
