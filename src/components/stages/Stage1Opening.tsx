import type { Stage1Content } from "../../types/stage1Content";
import { requestKioskPermissions } from "../../hooks/useKioskMode";
import { primeAudio } from "../../lib/audioUnlock";
import AutoPlayVideo from "../AutoPlayVideo";
import { SphereText } from "../TextEffects";
import FractalLogo from "../FractalLogo";
import { BackgroundLayers } from "../ui/AppBackground";
import Icon from "../ui/Icon";
import { GlassButton } from "../ui/Glass";

interface Props {
  screenNumber: number;
  content: Stage1Content;
  onAdvance: () => void;
}

/**
 * מסגרת זכוכית שמחזיקה את תוכן הפתיחה. הלוגו/הסרטון/הטקסט מונחים **בתוך**
 * לבנה, ולא צפים על הרקע - כך הפריט היחיד שעל המסך כבר מלמד את שפת
 * העיצוב של כל הסדנה שאחריו.
 */
function ContentFrame({
  children,
  flush = false,
}: {
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <div
      className={
        // flush - סרטון: ממלא את המסגרת עד הקצה (לבקשת הלקוחה), בלי שוליים
        // ובלי מסגרת בתוך מסגרת
        flush
          ? "glass glass-brick relative flex w-full items-center justify-center overflow-hidden rounded-2xl"
          : "glass glass-brick relative flex min-h-[18rem] w-full items-center justify-center overflow-hidden rounded-2xl p-8 sm:min-h-[22rem] sm:p-12"
      }
      style={{ animation: "glass-in var(--ds-dur-slow) var(--ds-ease) both" }}
    >
      {/* stretch רק לסרטון (שימלא את הרוחב). טקסט ולוגו - ממורכזים; stretch
          דחף את בלוק הטקסט (max-w-2xl) לצד ימין של המסגרת */}
      <div className={`relative flex w-full flex-col justify-center ${flush ? "items-stretch" : "items-center"}`}>
        {children}
      </div>
    </div>
  );
}

/** מציין-מקום לתוכן שעדיין לא הגיע מהלקוחה - מעוצב, ואומר בדיוק מה חסר. */
function Awaiting({ icon, label }: { icon: "camera" | "film" | "star"; label: string }) {
  return (
    <div className="text-ink-3 flex flex-col items-center gap-3 text-center">
      <span className="glass glass-dim glass-icon-btn glass-icon-btn-lg">
        <Icon name={icon} size={30} />
      </span>
      <span className="text-sm font-bold">{label}</span>
    </div>
  );
}

function ScreenContent({ screen }: { screen: Stage1Content["screens"][string] | undefined }) {
  if (!screen) {
    return <Awaiting icon="star" label="אין תוכן מוגדר למסך הזה בשלב 1" />;
  }

  if (screen.type === "logo") {
    // 2026-11-08 (בקשת הלקוחה): "להוריד את הרקע מאחורי הלוגו". הקובץ
    // המקורי (/brand/fractal-logo.png) צרוב עם רקע כחול, ולכן במקומו מוצג
    // הלוגו בווקטור - שקוף, ובצבעי המצב (נייבי בבהיר, לבן בכהה). תמונה
    // אחרת שהועלתה ל-image_url מוצגת כמו שהיא.
    const customImage =
      screen.image_url && !screen.image_url.endsWith("/brand/fractal-logo.png") ? screen.image_url : null;
    return customImage ? (
      <img
        src={customImage}
        alt="לוגו"
        className="block max-h-[min(36rem,60vh)] w-full object-contain"
      />
    ) : (
      <FractalLogo
        className="h-[min(36rem,56vh)] w-full"
        style={{ animation: "pop-in 0.7s var(--ds-ease-spring) both" }}
      />
    );
  }

  if (screen.type === "video") {
    return screen.video_url ? (
      // הגובה = מה שנשאר אחרי הכותרת, מסגרת הזכוכית וכפתור "התחילו" (~27rem).
      // קודם 58vh קבוע, ובמסך נמוך הסרטון דחף את הכפתור אל מחוץ למסך.
      <AutoPlayVideo
        src={screen.video_url}
        fill
        className="block h-[min(60vh,calc(100dvh-22rem))] w-full object-cover"
      />
    ) : (
      <Awaiting icon="film" label="כאן יופיע סרטון הפתיחה" />
    );
  }

  return (
    <div className="max-w-2xl text-center">
      <h2 className="glass-title mb-4 text-3xl sm:text-4xl">{screen.title}</h2>
      <p className="text-ink-2 text-xl leading-relaxed sm:text-2xl">{screen.body}</p>
    </div>
  );
}

/**
 * שלב 1 - מסך הפתיחה. שלושת המסכים מציגים תוכן שונה באותו רגע
 * (`content.screens[screenNumber]`), וכולם מחכים ללחיצה על "התחילו".
 *
 * ----------------------------------------------------------------------------
 * הלחיצה הזאת היא הרבה יותר מ"הבא"
 * ----------------------------------------------------------------------------
 * זו **הנגיעה הראשונה במסך**, ולכן היא הרגע היחיד שבו מותר לבקש מהדפדפן
 * את מה שדורש מחוות משתמשת: הרשאת קול (autoplay policy), מסך מלא ו-Wake
 * Lock. באנדרואיד אין דרך אחרת - בלי הנגיעה הזו כל סרטון בסדנה היה מתנגן
 * מושתק (ראו סעיף 2 ב-CLAUDE.md). לכן הכפתור גדול, זוהר, ובלתי ניתן
 * להחמצה - הוא לא רק כפתור ניווט, הוא מה שמדליק את הסדנה.
 *
 * אין כאן סרגל עליון, טיימר גלוי או מד התקדמות (ראו StageRouter): לפני
 * ההזדהות לקבוצה עוד אין שם ואין לאן לחזור, וכל פקד נוסף היה רק רעש
 * סביב הפעולה היחידה שצריך לעשות.
 */
function Stage1Opening({ screenNumber, content, onAdvance }: Props) {
  const screen = content.screens[String(screenNumber)];

  function handleStart() {
    primeAudio();
    requestKioskPermissions();
    // בלי צליל בלחיצה - לבקשת הלקוחה. הרשאת הקול לשאר הסדנה נפתחת
    // ב-primeAudio, שמנגן שקט ולא נשמע.
    onAdvance();
  }

  return (
    // הכותרת והכפתור flex-none - הם אף פעם לא מתכווצים; רק המסגרת שבאמצע
    // מוותרת על גובה, כך ש"התחילו" תמיד נראה במלואו
    <main className="relative flex h-dvh flex-col items-center justify-center-safe gap-[min(2rem,3vh)] overflow-hidden px-4 py-[min(2rem,3vh)] sm:px-8">
      <BackgroundLayers variant="dawn" />

      <header
        className="relative flex flex-none flex-col items-center gap-2 text-center"
        style={{ animation: "fade-up var(--ds-dur-slow) var(--ds-ease) both" }}
      >
        {/* "ברוכות הבאות" נבנה מכדור אור מסתובב (אפקט "כדור" שהלקוחה שלחה) */}
        <SphereText text="ברוכות הבאות" loop className="h-[min(7rem,13vh)] w-[min(40rem,86vw)]" />
      </header>

      <div className="relative min-h-0 w-full max-w-4xl flex-[0_1_auto]">
        {screen?.type === "logo" ? (
          // הלוגו בלי מסגרת ובלי רקע - ישירות על רקע הדף (בקשת הלקוחה)
          <div className="relative flex w-full items-center justify-center">
            <ScreenContent screen={screen} />
          </div>
        ) : (
          <ContentFrame
            // סרטון ממלא את המסגרת עד הקצה, בלי שוליים
            flush={screen?.type === "video" && Boolean(screen.video_url)}
          >
            <ScreenContent screen={screen} />
          </ContentFrame>
        )}
      </div>

      <div
        className="relative flex flex-none flex-col items-center gap-4 pb-2"
        style={{ animation: "fade-up var(--ds-dur-slow) 260ms var(--ds-ease) both" }}
      >
        {/* הילה שנושמת מאחורי הכפתור - מושכת את היד לנקודה הנכונה */}
        <div className="relative">
          <span
            aria-hidden="true"
            className="bg-glow absolute inset-0 -z-10 rounded-full blur-2xl"
            style={{ animation: "soft-pulse 2.8s ease-in-out infinite" }}
          />
          <GlassButton
            variant="primary"
            size="lg"
            iconAfter="arrowNext"
            onClick={handleStart}
            silent
            // הצורה (ארוך ודק) והצבע (אדום הלוגו) הם עכשיו ברירת המחדל של כל
            // כפתור ראשי גדול - ראו .glass-btn-lg ו-GlassButton
          >
            התחילו
          </GlassButton>
        </div>
      </div>
    </main>
  );
}

export default Stage1Opening;
