import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Group } from "../../types/group";
import { cleanAiHebrew } from "../../lib/hebrewText";
import type { Stage4Content, Stage4IntroTexts } from "../../types/stage4Content";
import StageShell from "../StageShell";
import StageIntro from "../StageIntro";
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

/**
 * הופכת את סמן העכבר עצמו למרקר קטן בצבע הכלי הפעיל, מוטה באלכסון (כמו
 * מרקר אמיתי ביד, לא עומד זקוף) - כדי שהתנועה על הטקסט תיתן הרגשה אמיתית
 * של הדגשה. הסיבוב (rotate) מתבצע סביב החוד עצמו (15,38), ה-hotspot
 * (הנקודה שבאמת "לוחצת"), כך שהחוד תמיד נשאר בדיוק במקום שעליו מצביעים
 * גם כשהגוף של המרקר מוטה מאחוריו - בדיוק כמו עט ביד אמיתית.
 */
/** סמן המחק - אותו מחק מצויר כמו בכלי שבצד (בקשת המפתחת 2026-11-16). */
function eraserCursor(): string {
  const svg =
    // קטן יותר (28px) ובלי קו הרצפה מתחת (בקשת המפתחת 2026-11-16)
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24">` +
    `<path d="M7 21 L2.7 16.7 c-1 -1 -1 -2.5 0 -3.4 l9.6 -9.6 c1 -1 2.5 -1 3.4 0 l5.6 5.6 c1 1 1 2.5 0 3.4 L13 21 Z" fill="white" stroke="#0b1b3f" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M5 11 L14 20" stroke="#2a4286" stroke-width="1.8"/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 6 24, auto`;
}

function brushCursor(color: string): string {
  // 2026-11-16: באותו סגנון של המרקרים בצד - קו נייבי דק, וצבע הדיו רק
  // בחוד ובמשיכה מתחתיו. ה-hotspot הוא קצה החוד (3,21)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24">` +
    `<path d="M22 12 L17.4 16.6 a2 2 0 0 1 -2.8 0 L9.4 11.4 a2 2 0 0 1 0 -2.8 L14 4" fill="white" stroke="#0b1b3f" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M9 11 L3 17 V20 H12 L15 17" fill="${color}" stroke="#0b1b3f" stroke-width="1.3" stroke-linejoin="round"/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 5 33, auto`;
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
  /*
    שפת "עיתונאי" (2026-11-15): הכלי **מראה מה הוא עושה**. השם שלו כתוב על
    משיכת מרקר אמיתית בצבע הדיו - "חוזקות" מודגש בירוק, "חסמים" באדום -
    בדיוק כמו שהטקסט ייראה על הדף. המחק מוחק משיכה (קו חוצה). הכלי הפעיל
    הוא כרטיס לבן שבולט מהעמודה הכחולה, עם פס אדום-כתום בצד; הכבויים
    שקופים עם מסגרת דקה. CSS: .mk-* ב-styles/stage-scenes.css.
  */
  /*
    2026-11-15 (בקשת המפתחת: "טושים חמודים"): מרקר מצויר שעומד - גוף
    שמנמן בצבע הדיו עם ברק לבן, תווית לבנה, צווארון וחוד משופע; המחק -
    מחק עם שרוול כחול. הכלי ביד קופץ למעלה ונוטה, השאר עומדים במקום.
    .mk-cute ב-stage-scenes.css.
  */
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      // בלי עיגול/זוהר המגע של שאר המסכים (בקשת המפתחת 2026-11-15)
      data-no-glow=""
      className={cx("mk-cute", active && "is-active")}
      style={{ ["--ink" as string]: color }}
    >
      {/* ציור קו דק ועדין (2026-11-15, "עדינים, דקים, מצוירים"): קו מתאר
          נייבי של 1 פיקסל, גוף לבן צר וארוך, והצבע רק בחוד ובפס אחד */}
      {/* קו מצויר בלבד, כמו האיורים של "רעיון / שאלה / תחושה" בשלב 3 (בקשת
          המפתחת 2026-11-15): בלי מילוי, קו נייבי דק אחד, והצבע של הדיו רק
          בקו של החוד ובשני פסים. כל קו "מצטייר" בכניסה (mk-draw) */}
      {/* אייקון קטן בקו דק (24x24), בדיוק בסגנון האיורים של שלב 3 (בקשת
          המפתחת: "קטן יותר, אותו סגנון"). מרקר אלכסוני - קו החוד ומשיכת
          הדיו מתחתיו בצבע הדיו; מחק - בלוק מחק עם קו רצפה */}
      <svg
        className="mk-cute__art"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0b1b3f"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {icon === "marker" ? (
          <>
            {/* גוף המרקר */}
            <path className="mk-draw" pathLength={1} d="M22 12 L17.4 16.6 a2 2 0 0 1 -2.8 0 L9.4 11.4 a2 2 0 0 1 0 -2.8 L14 4" />
            {/* החוד - בצבע הדיו */}
            <path className="mk-draw" pathLength={1} d="M9 11 L3 17 V20 H12 L15 17" stroke="var(--ink-line)" strokeWidth="1.5" />
            {/* משיכת הדיו מתחת */}
            <path className="mk-draw" pathLength={1} d="M3 22.5 H13" stroke="var(--ink-line)" strokeWidth="2" />
          </>
        ) : (
          <>
            <path className="mk-draw" pathLength={1} d="M7 21 L2.7 16.7 c-1 -1 -1 -2.5 0 -3.4 l9.6 -9.6 c1 -1 2.5 -1 3.4 0 l5.6 5.6 c1 1 1 2.5 0 3.4 L13 21" />
            <path className="mk-draw" pathLength={1} d="M5 11 L14 20" stroke="#2a4286" strokeWidth="1.5" />
            <path className="mk-draw" pathLength={1} d="M22 21 H7" />
          </>
        )}
      </svg>
      <span className="mk-cute__label">{label}</span>
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
    // המחק "מדגיש בלבן" (בקשת המפתחת 2026-11-16): צובע בלבן של הדף מעל
    // הסימון, במקום לחתוך את השכבה - כך רואים בדיוק את מה שנמחק
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.fillStyle = "#ffffff";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = STROKE_ALPHA;
    ctx.filter = `blur(${STROKE_BLUR_PX}px)`;
    ctx.fillStyle = STROKE_COLOR[tool];
  }
  if (tool === "eraser") {
    // קצת יותר מהאות לכל כיוון - שלא יישארו שאריות צבע בקצוות
    roundRectPath(
      ctx,
      r.left - paperRect.left - CHAR_FILL_PADDING_PX - 1,
      r.top - paperRect.top,
      r.width + CHAR_FILL_PADDING_PX * 2 + 2,
      r.height,
      0,
    );
  } else {
    /*
      2026-11-16 (בקשת המפתחת: "שיתאים למרקר שבצד"): משיכה של מרקר-הדגשה
      אמיתי עם חוד משופע, כמו האיור בצד - פס חד (בלי טשטוש ובלי פינות
      מעוגלות) שיושב על החצי התחתון של האות ועולה מעט מעבר לה, כמו מרקר
      שעובר על שורה. אותיות שכנות מתחברות לפס רציף אחד.
    */
    ctx.filter = "none";
    roundRectPath(
      ctx,
      r.left - paperRect.left - CHAR_FILL_PADDING_PX,
      r.top - paperRect.top + r.height * 0.34,
      r.width + CHAR_FILL_PADDING_PX * 2,
      r.height * 0.6,
      0,
    );
  }
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
      // ראש החלון צבוע בצבע הדיו, ובמרכזו המרקר המצויר שבו סימנו (cat-modal ב-editorial.css)
      className={cx("cat-modal", pending.color === "green" ? "cat-modal--green" : "cat-modal--red")}
      visual={
        <>
        <span className="cat-band" aria-hidden="true" />
        <div className="cat-visual" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="#0b1b3f" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12 L17.4 16.6 a2 2 0 0 1 -2.8 0 L9.4 11.4 a2 2 0 0 1 0 -2.8 L14 4" fill="#ffffff" />
            <path d="M9 11 L3 17 V20 H12 L15 17" fill="var(--ink)" />
            <path className="cat-visual__swipe" d="M3 22.5 H13" stroke="var(--ink)" strokeWidth="2.4" />
          </svg>
        </div>
        </>
      }
      title={pending.color === "green" ? "סימנתן חוזקה" : "סימנתן חסם"}
      description="מה המונח המקצועי התואם ביותר?"
      cancelLabel="ביטול (להשאיר מסומן בלי תיוג)"
    >
      {/* 2026-11-16 (בקשת המפתחת: "להוסיף צבע"): צבע הדיו של המרקר שבו
          סימנו - הקטע מוצג מודגש בדיוק כמו על הדף, פס בצבע הדיו בצד, וכל
          תחום עם ריבוע בצבע הדיו שמתמלא כשנוגעים. cat-pop ב-editorial.css */}
      <div className="cat-pop" style={{ ["--ink" as string]: STROKE_COLOR[pending.color] }}>
        {/* הקטע שסומן - טקסט גדול באמצע, בלי הדגשה ובלי גרשיים (בקשת המפתחת) */}
        <p className="cat-pop__phrase">{pending.text}</p>

        {categories.length === 0 ? (
          <InlineNotice tone="warn" className="mt-5">
            לא הוגדרו קטגוריות בתוכן השלב.
          </InlineNotice>
        ) : (
          // לוח של אריחים בשני טורים: מספר דק בצבע הדיו, שם התחום, וחץ
          // שזז כשנוגעים; בנגיעה האריח מתמלא בצבע הדיו
          <div className="cat-pop__grid">
            {categories.map((category, i) => (
              <button
                key={category}
                type="button"
                className="cat-pop__btn"
                // בלי עיגול המגע הכחול - בנגיעה רק הצבע של המרקר נמרח (בקשת המפתחת)
                data-no-glow=""
                style={{ animationDelay: `${0.2 + i * 0.06}s` }}
                onClick={() => guardedChoose(category)}
              >
                <span className="cat-pop__n" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="cat-pop__name">{category}</span>
                <svg className="cat-pop__go" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 5 L5 19 M5 8.5 L5 19 L15.5 19" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
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

/** מונה שרץ מ-00 עד המספר - פתיחת הטבלה "סופרת" את מה שהקבוצה מצאה. */
function CountUp({ to, delayMs, className }: { to: number; delayMs: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (to <= 0) return;
    let raf = 0;
    const start = performance.now() + delayMs;
    const dur = Math.min(1200, 250 + to * 120);
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / dur));
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delayMs]);
  return (
    <span className={className} aria-hidden="true">
      {String(n).padStart(2, "0")}
    </span>
  );
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
  /*
    איחוד קטעים צמודים (2026-11-16): סימון אחד שנעשה בשתי משיכות נשמר כשני
    קטעים ("התלמיד מפ" + "גין יכולת...") - אבל זה נתון אחד. קטעים באותו תחום
    שנוגעים זה בזה (או שרק רווח ביניהם) מוצגים כאחד, וגם נספרים כאחד.
  */
  for (const g of groups) {
    const sorted = [...g.items].sort((a, b) => a.startIndex - b.startIndex);
    const merged: TaggedPhrase[] = [];
    for (const p of sorted) {
      const prev = merged[merged.length - 1];
      if (prev && p.startIndex <= prev.endIndex + 2) {
        const gap = p.startIndex - prev.endIndex;
        merged[merged.length - 1] = {
          ...prev,
          endIndex: Math.max(prev.endIndex, p.endIndex),
          text: p.startIndex <= prev.endIndex ? prev.text : prev.text + (gap === 2 ? " " : "") + p.text,
        };
      } else {
        merged.push(p);
      }
    }
    g.items = merged;
  }
  const itemCount = groups.reduce((n, g) => n + g.items.length, 0);
  /*
    2026-11-15 (בקשת המפתחת: "לשדרג דחוף"): בשפת "עיתונאי". ראש הטור - בלוק
    צבע מלא (חוזקות בכחול, חסמים באדום-כתום) עם מספר ענק ודק של כמה זוהו.
    מתחתיו כל תחום הוא שורה: המונח המקצועי מימין, והנתונים משמאלו **מודגשים
    במרקר** - בדיוק כמו שהקבוצה סימנה אותם על הדף. התחומים נכנסים בזה אחר זה.
    pc-* ב-editorial.css.
  */
  return (
    <div
      className={cx("pc", color === "green" ? "pc--green" : "pc--red")}
      style={{ ["--hl" as string]: styles.strokeColor }}
    >
      <div className="pc__head">
        <CountUp className="pc__count" to={itemCount} delayMs={color === "green" ? 650 : 800} />
        <span className="pc__title">
          <Icon name={styles.icon} size={22} />
          {title}
        </span>
      </div>

      {phrases.length === 0 ? (
        <p className="pc__empty">עדיין לא סומן כאן כלום</p>
      ) : (
        <div className="pc__body glass-scroll">
          <div className="pc__legend" aria-hidden="true">
            <span>מונח מקצועי</span>
            <span>נתון</span>
          </div>
          <ul className="pc__groups">
            {groups.map((g, gi) => (
              <li key={g.category} className="pc__group" style={{ animationDelay: `${(color === "green" ? 1.05 : 1.2) + gi * 0.16}s` }}>
                <span className="pc__cat">{g.category}</span>
                <span className="pc__items">
                  {g.items.map((p) => (
                    <span key={p.id} className="pc__item">
                      {p.text}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
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
      // בלי התגית "תמונת תפקוד" (כמו בשאר מסכי שלב 4, 2026-11-15)
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
        <div className="flex w-full flex-col gap-[4.5vh]">
          {/* 2026-11-15 (בקשת המפתחת: "לעצב מחדש"): שתי האמירות הן שתי פיסות
              שמתחברות - "כל פיסה מצטרפת לפיסה" מהטקסט. פיסה 1 בלוק כחול מלא,
              פיסה 2 לבנה במסגרת נייבי, צמודות זו לזו; הן גולשות מהצדדים
              ונפגשות, וריבוע אדום-כתום ננעץ בתפר. fp-* ב-editorial.css */}
          <ol className="fp-pieces">
            {[result.sentence1, result.sentence2].map(cleanAiHebrew).map((sentence, i) => (
              <li key={i} className={cx("fp-piece", i === 0 ? "fp-piece--a" : "fp-piece--b")}>
                <span className="fp-piece__n" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="fp-piece__t">{sentence}</p>
              </li>
            ))}
            <span className="fp-seam" aria-hidden="true" />
          </ol>

          {/* המסקנה המעשית: בלי קופסה - כותרת עם ריבוע אדום, ושורת כתיבה אחת
              ארוכה עם קו תחתון עבה, כמו לכתוב על שורה בדף */}
          <div className="fp-write">
            <label htmlFor="group-conclusion" className="fp-write__label">
              על סמך ההבנות למעלה - כתבו מסקנה מעשית שתלווה את כל השלבים הבאים
            </label>
            <textarea
              key={shakeKey}
              ref={conclusionRef}
              id="group-conclusion"
              className={cx("fp-write__input", conclusionMissing && !groupConclusion.trim() && "is-missing")}
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
          </div>        </div>
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
    // 100% ולא px: getBoundingClientRect מחזיר פיקסלים אמיתיים של המסך, אבל
    // תחת הקטנת הממשק (zoom ב-index.css) px ב-style מוקטן - והסימון "ריחף"
    // מעל המילים. כך התצוגה תמיד בגודל הדף, והציור (לפי rect) נופל עליו 1:1
    canvas.style.width = "100%";
    canvas.style.height = "100%";
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
    /*
      2026-11-16 (באג: "יש כאן חסמים, והטבלה מראה שאין"): הטבלה נבנתה רק
      מקטעים **שתויגו** בחלון בחירת התחום. סימון שהחלון שלו נסגר בלי תיוג,
      או קטע שנשבר לכמה משיכות ("ה" לבד), נעלם או הופיע שבור. עכשיו הטבלה
      נבנית ממה שבאמת צבוע על הדף (marks): כל רצף צבוע מאותו צבע = נתון אחד,
      עם הטקסט המלא שלו. התחום נלקח מהתיוג שחופף לרצף; רצף בלי תיוג מופיע
      תחת "ללא תיוג", כדי ששום סימון לא ילך לאיבוד.
    */
    const UNTAGGED = "ללא תיוג";
    const derived: TaggedPhrase[] = [];
    let i = 0;
    while (i < marks.length) {
      const color = marks[i];
      if (color !== "green" && color !== "red") {
        i++;
        continue;
      }
      let end = i;
      while (end + 1 < marks.length && marks[end + 1] === color) end++;
      // התיוגים מאותו צבע שחופפים לרצף, לפי הסדר
      const overlapping = phrases
        .filter((p) => p.color === color && p.endIndex >= i && p.startIndex <= end)
        .sort((a, b) => a.startIndex - b.startIndex);
      const categories = Array.from(new Set(overlapping.map((p) => p.category)));
      if (categories.length <= 1) {
        derived.push({
          id: `run-${i}`,
          color,
          category: categories[0] ?? UNTAGGED,
          text: textForRange(i, end),
          startIndex: i,
          endIndex: end,
        });
      } else {
        // כמה תחומים שונים בתוך אותו רצף - מפצלים לפי גבולות התיוגים; חלק לא
        // מתויג בין שניים מצטרף לקטע שלפניו
        let segStart = i;
        overlapping.forEach((p, k) => {
          const next = overlapping[k + 1];
          const segEnd = next ? Math.max(segStart, next.startIndex - 1) : end;
          derived.push({
            id: `run-${i}-${k}`,
            color,
            category: p.category,
            text: textForRange(segStart, segEnd),
            startIndex: segStart,
            endIndex: segEnd,
          });
          segStart = segEnd + 1;
        });
      }
      i = end + 1;
    }
    const strengths = derived.filter((p) => p.color === "green");
    const blockers = derived.filter((p) => p.color === "red");
    return (
      <StageShell
        stage={4}
        // התגית "חוזקות וחסמים" הוסרה (בקשת המפתחת 2026-11-15)
        className="pc-screen"
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
        <div className="flex min-h-0 w-full flex-1 flex-col gap-8 lg:flex-row lg:items-start">
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
      // mk-screen: כפתור "הבא" ממורכז מתחת לדף (שזז ימינה) - stage-scenes.css
      className="mk-screen"
      icon="marker"
      title="ניתוח דילמה"
      // שלוש שורות (בקשת המפתחת 2026-11-15) - בלי לשנות מילה: שבירה אחרי
      // הסוגריים הראשונים ואחרי הנקודתיים. טקסט אחר מהמסד שאין בו את
      // הסימנים האלה פשוט נשאר שורה אחת רציפה.
      // (בלי lookbehind ב-regex - לא נתמך בדפדפנים ישנים של אנדרואיד)
      // אזור התוכן לא חותך: הטושים יושבים קרוב לקצה המסך ונחתכו בגבול שלו.
      // הדף עצמו גולל בתוך המסגרת שלו, כך שלא צריך גלילה של האזור כולו.
      clipContent={false}
      subtitle={markingHint
        .replace(/\)\s+/, ")\n")
        .replace(/:\s+/, ":\n")
        .split("\n")
        .map((part, i, all) => (
          <span key={i}>
            {part.trim()}
            {i < all.length - 1 && <br />}
          </span>
        ))}
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
          {/* צלילת הזום לתוך הלוגו הוסרה - בקשת המפתחת 2026-11-15 ("תעיף את
              הלוגו ברקע"). zoomIn נשאר רק כדי לא לגעת בשאר הזרימה */}
          {zoomIn && null}
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
        // בלי lg:translate-x-8 (2026-11-15): הזיז את הטושים אל מחוץ למסך
        className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-8 lg:flex-row lg:items-start lg:pt-5 2xl:translate-x-4"
      >
      {/* המגש. שטוח ונמוך בכוונה (glass-dim) - הכלים הם הגיבורים כאן,
          והמגש רק מחזיק אותם; לבנה עבה מסביבם הייתה מתחרה בהם. */}
      {/* המגש אדום (בקשת הלקוחה, 2026-11-08), והכלים עליו לבנים */}
      {/* 2026-11-15: עמודה כחולה עמוקה (mk-tray) במקום המגש האדום */}
      <div className="mk-tray flex flex-none flex-wrap items-center justify-center lg:flex-col lg:flex-nowrap lg:items-stretch lg:self-stretch">
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

        <div ref={paperAreaRef} className="flex h-full min-h-0 flex-1 flex-col pb-4 mk-paper-area">
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
        // 2026-11-15: דף מחברת לבן (mk-paper) - קווים דקים ושוליים אדומים
        className="mk-paper-frame glass-scroll max-h-full w-full flex-none overflow-y-auto"
      >
        <div
          ref={paperRef}
          className="mk-paper relative w-full p-6 lg:p-8"
          style={{
            touchAction: "none",
            // סמן העכבר עצמו הופך למכחול בצבע הכלי הפעיל - כדי שיהיה ברור על מה
            // בדיוק לוחצים בלי להסתמך על נקודה שמצטיירת רק אחרי הלחיצה עצמה.
            cursor: activeTool === "eraser" ? eraserCursor() : brushCursor(STROKE_COLOR[activeTool]),
          }}
          onPointerDown={handlePaperPointerDown}
          onPointerMove={handlePaperPointerMove}
        >
          {/* z-10 מעל ה-canvas בכוונה: הטקסט מצויר מעל שכבת הצביעה, לא מתחתיה -
              כמו רקע-הדגשה אמיתי (mark/highlight), כדי שהאותיות תמיד יישארו
              חדות וקריאות במלואן, גם כשהרקע הצבוע מתחתן מלא/חזק ולא שקוף. */}
          <p
            ref={paperTextRef}
            className="mk-paper__text relative z-10 leading-loose select-none"
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
