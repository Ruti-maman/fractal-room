/*
 * ============================================================================
 *  מסך הפתיחה - גרסת "עיתונאי" (ניסוי, 2026-11-12)
 * ============================================================================
 *
 *  בהשראת האתר שהלקוחה שלחה ב-Figma ("אתר אומנות סופי", גלריית Michal's):
 *    - רשת קווים דקה וגלויה על כל המסך - "שלד" של הדף, כמו שרטוט.
 *    - חלוקה חדה בין בהיר לבלוק צבע מלא (אצלה שחור; כאן כחול), והרשת
 *      ממשיכה גם לתוך הבלוק.
 *    - חץ אלכסוני דק במקום חץ רגיל.
 *    - מיקומים "של מגזין": כותרת סריף ענקית, מספר גדול (01), הלוגו בבלוק
 *      לצד ולא באמצע.
 *  צבעים לבקשתה: כחול-לבן ("יותר RGB") עם נגיעות אדומות בלבד.
 *
 *  מופעל מ-OPENING_VARIANT ב-Stage1Opening.tsx; להחזרה - "brand" שם.
 *  העיצוב ב-styles/editorial.css. הלוגיקה (קול, מסך מלא, Wake Lock, מעבר
 *  שלב) והכפתור (StartKeyButton) זהים לשאר הגרסאות.
 */

import { useState, type CSSProperties } from "react";
import type { Stage1Content } from "../../types/stage1Content";
import { requestKioskPermissions } from "../../hooks/useKioskMode";
import { primeAudio } from "../../lib/audioUnlock";
import { coverWithGrid } from "../../lib/gridCurtain";
import AutoPlayVideo from "../AutoPlayVideo";
import StartKeyButton from "../StartKeyButton";

interface Props {
  screenNumber: number;
  content: Stage1Content;
  onAdvance: () => void;
}

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

/*
 * מסך ההסבר שאחרי "התחילו" (2026-11-25, דרישת הלקוחה: "להוסיף מסך הסבר לפני
 * תחילת הסדנה אחרי ברוכות הבאות"). הטקסטים נדרסים מ-content.resources של שלב 1.
 */
const RESOURCES_DEFAULTS = {
  title: "לפני שמתחילות",
  text: "חומרי עזר תואמים לכל שלב מחכים לכן במרכז ההעשרה והידע",
  room_line: "על המסך הגדול: מסך העשרה וידע - אינסוף צורות לפרקטל",
  button: "הבנו, מתחילות",
};

/**
 * חץ אלכסוני דק, כמו בהשראה. ב-RTL "קדימה" הוא שמאלה-למטה (↙).
 * vector-effect: הקו נשאר דק באותו עובי גם כשהחץ ענק (ליד הכותרת).
 */
function DiagonalArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M19 5 L5 19 M5 8 L5 19 L16 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** מה שמוצג בבלוק הכחול - לפי סוג המסך (לוגו / סרטון / טקסט) */
function PanelContent({ screen }: { screen: Stage1Content["screens"][string] | undefined }) {
  if (!screen) return <p className="ed-panel__text">אין תוכן מוגדר למסך הזה בשלב 1</p>;

  if (screen.type === "logo") {
    const customImage =
      screen.image_url && !screen.image_url.endsWith("/brand/fractal-logo.png") ? screen.image_url : null;
    // קובץ הלוגו של הלקוחה עצמה (2026-11-12, "לוגו פרקטל מעודכן.pdf"), בגרסה
    // לרקע כהה - לא הלוגו המצויר, שהפונט שלו לא תאם את המקור
    return <img src={customImage ?? "/brand/fractal-logo-on-dark.png"} alt="פרקטל - עומק. מימד. חדשנות." className="ed-panel__logo" />;
  }

  if (screen.type === "video") {
    return screen.video_url ? (
      <AutoPlayVideo src={screen.video_url} fill className="ed-panel__video" />
    ) : (
      <p className="ed-panel__text">כאן יופיע סרטון הפתיחה</p>
    );
  }

  return (
    <div className="ed-panel__text">
      <h2 className="ed-panel__title">{screen.title}</h2>
      <p>{screen.body}</p>
    </div>
  );
}

function Stage1OpeningEditorial({ screenNumber, content, onAdvance }: Props) {
  const screen = content.screens[String(screenNumber)];
  const [intro, setIntro] = useState(false);
  const r = { ...RESOURCES_DEFAULTS, ...(content.resources ?? {}) };

  // "התחילו" - פותח קול ומסך מלא (חייב נגיעה), ועובר למסך ההסבר
  function handleStart() {
    primeAudio();
    requestKioskPermissions();
    setIntro(true);
  }

  // "הבנו, מתחילות" - המעבר לשלב 2
  function handleContinue() {
    // מעבר "רשת הריבועים" (2026-11-12): הרשת מתמלאת בכחול, ורק כשהמסך מכוסה
    // כולו מחליפים שלב - כדי שהמסך הבא לא ייראה דרך ריבועים שעוד לא התמלאו.
    // המסך הבא (ההזדהות) מבקש את הגילוי כשהוא מוכן. בלי מעבר - מיד.
    const wait = coverWithGrid({ from: "01", to: "02", label: "הזדהות" });
    if (wait < 0) onAdvance();
    else window.setTimeout(onAdvance, wait);
  }

  if (intro) {
    return (
      <main className="ri-page" dir="rtl">
        <div className="ri-body">
          <p className="ri-kicker ed-rise" style={delay(0.1)}>
            <span className="ri-kicker__sq" aria-hidden="true" />
            {r.title}
          </p>
          <h1 className="ri-text ed-rise" style={delay(0.3)}>
            {r.text}
          </h1>
          <p className="ri-room ed-rise" style={delay(0.6)}>
            <DiagonalArrow className="ri-room__arrow" />
            {r.room_line}
          </p>
        </div>
        <div className="ri-foot ed-rise" style={delay(0.9)}>
          <StartKeyButton onStart={handleContinue} className="ed-btn ri-btn" breathe={false}>
            {r.button}
            <DiagonalArrow className="ed-btn__arrow" />
          </StartKeyButton>
        </div>
      </main>
    );
  }

  return (
    <main className="opening-editorial">
      {/* רשת הקווים על הרקע הבהיר */}
      <div className="ed-grid" aria-hidden="true" />
      {/* קו אופקי עליון ותחתון - "הכותרת" וה"תחתית" של הדף */}
      <div className="ed-hline ed-hline--top" aria-hidden="true" />
      <div className="ed-hline ed-hline--bottom" aria-hidden="true" />

      {/* הבלוק הכחול - אצלה השחור. בלי קווים בתוכו (2026-11-12): צורה בצבע
          אחד על רקע בצבע אחר לא צריכה רשת משלה. רשת על כחול - רק בעמוד
          שכולו כחול מלא */}
      <section className="ed-panel">
        <div className="ed-panel__body">
          <PanelContent screen={screen} />
        </div>
      </section>

      {/* הצד הבהיר: מספר, כותרת, וכפתור */}
      <section className="ed-copy">
        <div className="ed-head ed-rise" style={delay(0.35)}>
          <div className="ed-index">
            <span className="ed-index__num">01</span>
            {/* נגיעה אדומה: הריבוע האדום של הלוגו */}
            <span className="ed-index__square" aria-hidden="true" />
          </div>
          {/* הכיתוב הזעיר שהיה כאן ("חדר פרקטל / סמינר ויזניץ · 2026") הוסר
              לבקשת המפתחת (2026-11-12) */}
        </div>

        <div className="ed-title-row ed-rise" style={delay(0.55)}>
          <h1 className="ed-title">
            ברוכות
            <br />
            הבאות
          </h1>
          {/* חץ גדול ודק כאלמנט גרפי, כמו "Home ↘" בהשראה */}
          <DiagonalArrow className="ed-title-arrow" />
        </div>

        <div className="ed-foot ed-rise" style={delay(0.85)}>
          {/* כפתור שקט: מלבן אדום נקי, בלי צל מוזח ובלי "נשימה" (2026-11-12).
              הלחיצה (התכווצות, עיגול, צליל) נשארה כמו בשאר הגרסאות */}
          <StartKeyButton onStart={handleStart} className="ed-btn" breathe={false}>
            התחילו
            <DiagonalArrow className="ed-btn__arrow" />
          </StartKeyButton>
        </div>
      </section>
    </main>
  );
}

export default Stage1OpeningEditorial;
