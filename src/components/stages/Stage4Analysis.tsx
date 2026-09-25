import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Group } from "../../types/group";
import type { Stage4Content } from "../../types/stage4Content";
import StageShell from "../StageShell";
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
const ERASER_CURSOR_COLOR = "#f6b8c4";

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

/** כפתור בצורת מרקר אמיתי - פקק, גוף עם השם כתוב עליו לאורך, וחוד, עם צל רך שנותן תחושת עומק. */
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
  // צבע המרקר הוא בדיוק הצבע שייצבע על הדף - כך הכלי ביד "מבטיח" את
  // התוצאה, וזו הסיבה שהוא נלקח מאותו קבוע (STROKE_COLOR) ולא מוגדר פעמיים.
  const ink = STROKE_COLOR[tool];

  return (
    <button
      type="button"
      aria-pressed={active}
      // padding מסביב לצורה עצמה - מגדיל את שטח הנגיעה בפועל בלי לנפח חזותית את הציור.
      className={cx(
        "glass glass-interactive group flex flex-col items-center rounded-xl p-3",
        active ? "glass-active -translate-y-3" : "hover:-translate-y-1",
      )}
      onClick={onClick}
    >
      {/* הפקק */}
      <div
        className="h-6 w-12 rounded-t-md"
        style={{
          background: `linear-gradient(180deg, ${ink}, color-mix(in srgb, ${ink} 55%, #061f1e))`,
          boxShadow: active ? `0 0 18px ${ink}` : "none",
        }}
      />
      {/* גוף המרקר, עם השם כתוב עליו לאורך */}
      <div
        className="flex h-24 w-12 items-center justify-center text-sm font-extrabold"
        style={{
          writingMode: "vertical-rl",
          background: `linear-gradient(90deg, color-mix(in srgb, ${ink} 70%, #061f1e), ${ink})`,
          color: "#08201f",
        }}
      >
        {label}
      </div>
      {/* החוד */}
      <div
        className="h-5 w-9"
        style={{ background: ink, clipPath: "polygon(50% 100%, 15% 0, 85% 0)" }}
      />
      <div
        className="mt-3 h-1.5 w-12 rounded-full transition-all duration-200"
        style={{
          background: active ? ink : "transparent",
          boxShadow: active ? `0 0 10px ${ink}` : "none",
        }}
      />
    </button>
  );
}

/** כפתור מחק בצורת מחק עיפרון קלאסי. */
function EraserTool({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        "glass glass-interactive group flex flex-col items-center rounded-xl p-3",
        active ? "glass-active -translate-y-3" : "hover:-translate-y-1",
      )}
      onClick={onClick}
    >
      <div
        className="h-16 w-20 rounded-md"
        style={{
          background: `linear-gradient(180deg, ${ERASER_CURSOR_COLOR}, color-mix(in srgb, ${ERASER_CURSOR_COLOR} 60%, #061f1e))`,
          boxShadow: active ? `0 0 18px ${ERASER_CURSOR_COLOR}` : "none",
        }}
      />
      <span className="mt-2 text-sm font-extrabold">מחק</span>
      <div
        className="mt-2 h-1.5 w-12 rounded-full transition-all duration-200"
        style={{
          background: active ? ERASER_CURSOR_COLOR : "transparent",
          boxShadow: active ? `0 0 10px ${ERASER_CURSOR_COLOR}` : "none",
        }}
      />
    </button>
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
  return (
    <GlassModal
      open
      onClose={onCancel}
      tone={pending.color === "green" ? "ok" : "warn"}
      icon="marker"
      title={pending.color === "green" ? "סימנתן חוזקה" : "סימנתן חסם"}
      description="לאיזו קטגוריה זה שייך?"
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
            <GlassButton key={category} size="sm" onClick={() => onChoose(category)}>
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
function FramedCategoryLabel({ text, color }: { text: string; color: "green" | "red" }) {
  const styles = PHRASE_COLUMN_STYLES[color];
  return (
    <span
      className="text-lg font-extrabold"
      style={{
        color: styles.fillColor,
        WebkitTextStroke: `0.6px ${styles.strokeColor}`,
        paintOrder: "stroke fill",
      }}
    >
      {text}
    </span>
  );
}

/** טור אחד בטבלת הסנכרון (שקף 7) - חוזקות או חסמים, כל שורה מחולקת לקטגוריה (מימין, כתגית מודגשת) ולמשפט עצמו (משמאל). */
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
  return (
    <div className="glass glass-brick flex-1 overflow-hidden rounded-2xl">
      <div
        className={cx(
          "border-edge-dim flex items-center gap-2.5 border-b px-5 py-4 text-xl font-extrabold",
          styles.header,
        )}
      >
        <Icon name={styles.icon} size={20} />
        {title}
        <span className="text-ink-3 ms-auto text-sm font-bold tabular-nums">
          {phrases.length}
        </span>
      </div>

      {phrases.length === 0 ? (
        <p className="text-ink-3 px-5 py-8 text-center text-sm">עדיין לא סומן כאן כלום</p>
      ) : (
        <table className="w-full border-collapse text-right">
          <thead>
            <tr className="text-ink-3 text-sm">
              <th className="border-edge-dim border-b px-4 py-2 font-extrabold">קטגוריה</th>
              <th className="border-edge-dim border-b px-4 py-2 font-extrabold">משפט</th>
            </tr>
          </thead>
          <tbody>
            {phrases.map((p) => (
              <tr key={p.id} className="align-top odd:bg-glass">
                <td className="border-edge-dim border-b px-4 py-3 whitespace-nowrap">
                  <FramedCategoryLabel text={p.category} color={color} />
                </td>
                <td className="border-edge-dim text-ink border-b px-4 py-3 text-base">
                  {p.text}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

  async function handleAdvance() {
    setAdvancing(true);
    await saveGroupConclusion(groupConclusion);
    onAdvance();
  }

  return (
    <StageShell
      stage={4}
      kicker="שקף 8 · תמונת תפקוד"
      icon="sparkles"
      title="תמונת תפקוד כוללת ומסקנה מעשית"
      width="normal"
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
          <p className="text-ink-2 text-xl">מנסחת...</p>
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
        <div className="flex w-full flex-col gap-6">
          {/* שני המשפטים שה-AI ניסח - ממוספרים כלבנים נפרדות, כדי שיהיה
              ברור שאלו שתי אמירות ולא פסקה אחת ארוכה. */}
          <ol className="flex flex-col gap-3">
            {[result.sentence1, result.sentence2].map((sentence, i) => (
              <li
                key={i}
                className="glass glass-brick flex items-start gap-4 rounded-2xl p-6"
                style={{
                  animation: `glass-in var(--ds-dur-slow) ${i * 120}ms var(--ds-ease) both`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="glass glass-active flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-extrabold"
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
          <div className="glass glass-strong glass-brick rounded-2xl p-6">
            <label
              htmlFor="group-conclusion"
              className="text-accent-soft mb-3 flex items-center justify-center gap-2 text-center text-sm font-bold"
            >
              <Icon name="lightbulb" size={16} />
              על סמך ההבנות למעלה - כתבו מסקנה מעשית שתלווה את כל השלבים הבאים
            </label>
            <textarea
              id="group-conclusion"
              className="glass-input h-28 w-full resize-none !rounded-xl py-4 !text-lg"
              rows={3}
              value={groupConclusion}
              onChange={(e) => setGroupConclusion(e.target.value)}
              placeholder="הקלידו כאן..."
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
function Stage4Analysis({ workshopId, myGroup, content, onAdvance }: Props) {
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
  const paperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
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

      // נקודת השחרור בפועל של הגרירה הזו (לפני ההרחבה כלפי חוץ למטה) - זה מה
      // שקובע אם קופץ פופ-אפ: רק אם משחררות בדיוק על פסיק/נקודה, כלומר בסוף
      // משפט/פסוקית שלם. שחרור באמצע מילה/משפט רק צובע, בלי לקפוץ עם פופ-אפ -
      // אפשר להמשיך לגרור אחר כך (הרחבה של אותו קטע) עד שמגיעות לסימן פיסוק.
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
      const endsAtPunctuation = charByIndex[dragEnd] === "," || charByIndex[dragEnd] === ".";

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

      if (endsAtPunctuation) {
        setPendingPhrase({ color: tool, startIndex: start, endIndex: end, text: textForRange(start, end) });
      }
    }
    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => window.removeEventListener("pointerup", handleWindowPointerUp);
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
  }

  if (loading) {
    return <LoadingState title="רגע אחד" description="טוענת את הטקסט ואת הסימונים..." />;
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
        kicker="שקף 7 · חוזקות וחסמים"
        icon="ladder"
        title="טבלת סנכרון אוטומטית"
        subtitle="הטבלה נבנתה לבד ממה שסימנתן. אם משהו חסר, אפשר לחזור ולסמן."
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
        <div className="flex w-full flex-col gap-6 lg:flex-row">
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
      kicker="שקף 6 · זיהוי חוזקות וחסמים"
      icon="marker"
      title="ניתוח דילמה"
      subtitle="סמנו את הטקסט בגרירה, כמו במרקר אמיתי על דף."
      width="normal"
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
        pendingPhrase ? (
          <CategoryPopup
            pending={pendingPhrase}
            categories={content.categories ?? []}
            onChoose={confirmCategory}
            onCancel={() => setPendingPhrase(null)}
          />
        ) : null
      }
    >
      {/* קופסת הכלים - שלושת המרקרים יושבים בתוך לבנה אחת, כמו מודול
          הכפתורים בלוח הבקרה, ולא מרחפים בנפרד על הדף. */}
      <div className="glass glass-brick mb-7 flex items-end gap-6 rounded-2xl px-8 py-5 sm:gap-10">
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

      {/*
        הדף.

        הוא נשאר **בהיר** ולא הופך לזכוכית כהה, וזו החלטה ולא פשרה: מרקר
        עובד על נייר. צבעי ההדגשה (ירוק לחוזקה, אדום לחסם) נקראים רק על
        משטח בהיר, והמטאפורה כולה - יד שמעבירה מרקר על טקסט - נשענת על כך
        שזה נראה כמו דף. מה שהשתנה: הנייר כבר לא בז' חמים אלא מנטה חיוור,
        כך שהוא יושב בתוך שפת הזכוכית במקום להיראות כמו גזיר מפרויקט אחר,
        והוא ממוסגר בלבנת זכוכית שמחזיקה אותו.
      */}
      <div className="glass glass-brick w-full rounded-2xl p-3">
        <div
          ref={paperRef}
          className="relative w-full rounded-xl p-8 sm:p-10"
          style={{
            background: "linear-gradient(180deg, #f8fffd 0%, #e9f7f4 100%)",
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
          <p className="relative z-10 text-2xl leading-loose text-[#08302d] select-none">
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
    </StageShell>
  );
}

export default Stage4Analysis;
