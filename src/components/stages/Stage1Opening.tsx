import type { Stage1Content } from "../../types/stage1Content";
import { requestKioskPermissions } from "../../hooks/useKioskMode";
import { primeAudio } from "../../lib/audioUnlock";
import AutoPlayVideo from "../AutoPlayVideo";
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
function ContentFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="glass glass-brick relative flex min-h-[18rem] w-full items-center justify-center overflow-hidden rounded-2xl p-8 sm:min-h-[22rem] sm:p-12"
      style={{ animation: "glass-in var(--ds-dur-slow) var(--ds-ease) both" }}
    >
      <div className="relative flex w-full items-center justify-center">{children}</div>
    </div>
  );
}

/** מציין-מקום לתוכן שעדיין לא הגיע מהלקוחה - מעוצב, ואומר בדיוק מה חסר. */
function Awaiting({ icon, label }: { icon: "camera" | "film" | "sparkles"; label: string }) {
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
    return <Awaiting icon="sparkles" label="אין תוכן מוגדר למסך הזה בשלב 1" />;
  }

  if (screen.type === "logo") {
    return screen.image_url ? (
      <img src={screen.image_url} alt="לוגו חדר פרקטל" className="max-h-72 object-contain" />
    ) : (
      <Awaiting icon="sparkles" label="כאן יופיע הלוגו" />
    );
  }

  if (screen.type === "video") {
    return screen.video_url ? (
      <AutoPlayVideo src={screen.video_url} className="max-h-[58vh] w-full rounded-xl" />
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
    <main className="relative flex h-dvh flex-col items-center justify-center gap-8 overflow-hidden px-4 py-8 sm:px-8">
      <BackgroundLayers variant="dawn" />

      <header
        className="relative flex flex-col items-center gap-2 text-center"
        style={{ animation: "fade-up var(--ds-dur-slow) var(--ds-ease) both" }}
      >
        <span className="glass glass-chip text-accent-soft gap-2">
          <Icon name="sparkles" size={15} />
          ברוכות הבאות
        </span>
      </header>

      <div className="relative w-full max-w-4xl">
        <ContentFrame>
          <ScreenContent screen={screen} />
        </ContentFrame>
      </div>

      <div
        className="relative flex flex-col items-center gap-4"
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
            className="px-16 text-2xl"
          >
            התחילו
          </GlassButton>
        </div>

        <p className="text-ink-3 text-sm">נגיעה במסך פותחת את הקול לשאר הסדנה</p>
      </div>
    </main>
  );
}

export default Stage1Opening;
