/*
 * ניסוי "שפת הלוגו" (2026-11-11) - גרסה חלופית למסך הפתיחה, בשלושה צבעים
 * בלבד (נייבי, לבן, אדום) ובתנועה אחת שלקוחה מהלוגו: ריבוע שצומח.
 * מופעל מ-BRAND_TRIAL ב-Stage1Opening.tsx; העיצוב ב-styles/brand-trial.css.
 * הלוגיקה (קול, מסך מלא, Wake Lock, מעבר שלב) זהה לגרסה הרגילה.
 */

import type { CSSProperties } from "react";
import type { Stage1Content } from "../../types/stage1Content";
import { requestKioskPermissions } from "../../hooks/useKioskMode";
import { primeAudio } from "../../lib/audioUnlock";
import AutoPlayVideo from "../AutoPlayVideo";
import FractalLogo from "../FractalLogo";
import { FloatingEmblems } from "../ui/AppBackground";
import StartKeyButton from "../StartKeyButton";

interface Props {
  screenNumber: number;
  content: Stage1Content;
  onAdvance: () => void;
}

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

/** כותרת שהאותיות שלה עולות אחת אחרי השנייה. */
function RisingLetters({ text, start = 0, className }: { text: string; start?: number; className?: string }) {
  return (
    <h1 className={`bt-letters ${className ?? ""}`} aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span key={i} aria-hidden="true" style={delay(start + i * 0.06)}>
          {ch === " " ? " " : ch}
        </span>
      ))}
    </h1>
  );
}

function Frame({ children, flush = false }: { children: React.ReactNode; flush?: boolean }) {
  return (
    <div className="bt-frame bt-grow" style={delay(0.5)}>
      <div
        className={`bt-frame__inner flex w-full items-center justify-center ${
          flush ? "" : "min-h-[18rem] p-8 sm:min-h-[22rem] sm:p-12"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function ScreenContent({ screen }: { screen: Stage1Content["screens"][string] | undefined }) {
  if (!screen) return <Frame><p className="text-xl">אין תוכן מוגדר למסך הזה בשלב 1</p></Frame>;

  if (screen.type === "logo") {
    const customImage =
      screen.image_url && !screen.image_url.endsWith("/brand/fractal-logo.png") ? screen.image_url : null;
    return customImage ? (
      <img src={customImage} alt="לוגו" className="bt-grow block max-h-[min(36rem,56vh)] w-full object-contain" />
    ) : (
      <FractalLogo grow growDelay={0.5} className="bt-logo h-[min(36rem,56vh)] w-full" />
    );
  }

  if (screen.type === "video") {
    return (
      <Frame flush={Boolean(screen.video_url)}>
        {screen.video_url ? (
          <AutoPlayVideo
            src={screen.video_url}
            fill
            className="block h-[min(58vh,calc(100dvh-24rem))] w-full object-cover"
          />
        ) : (
          <p className="text-xl">כאן יופיע סרטון הפתיחה</p>
        )}
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="max-w-2xl text-center">
        <h2 className="bt-text-title mb-4 text-3xl sm:text-4xl">{screen.title}</h2>
        <p className="bt-text-body text-xl leading-relaxed sm:text-2xl">{screen.body}</p>
      </div>
    </Frame>
  );
}

function Stage1OpeningBrand({ screenNumber, content, onAdvance }: Props) {
  const screen = content.screens[String(screenNumber)];

  function handleStart() {
    primeAudio();
    requestKioskPermissions();
    onAdvance();
  }

  return (
    <main className="brand-trial relative flex h-dvh flex-col items-center justify-center-safe gap-[min(2.5rem,4vh)] overflow-hidden px-4 py-[min(2rem,3vh)] sm:px-8">
      {/* הרקע (2026-11-12): נייבי, וסמלי הלוגו המרחפים כמו ברקע הבהיר - בלבן
          ובקורל. קודם נוסו ונפסלו באותו יום: קווים אלכסוניים, רשת מעוינים
          שמגיבה למגע, אורורה + זרקור ("האור המוזר"), ושדה זרימה של פסים */}
      <div className="bt-emblems" aria-hidden="true">
        <FloatingEmblems />
      </div>

      <header className="relative flex-none text-center">
        <RisingLetters text="ברוכות הבאות" start={0.1} className="text-[min(5rem,9vh)]" />
      </header>

      <div className="relative min-h-0 w-full max-w-4xl flex-[0_1_auto]">
        <ScreenContent screen={screen} />
      </div>

      <div className="relative flex-none pb-24">
        <div className="bt-grow relative" style={delay(1.4)}>
          {/* כל ההתנהגות (נשימה, לחיצה, עיגול, צליל) ב-StartKeyButton */}
          <StartKeyButton onStart={handleStart}>התחילו</StartKeyButton>
        </div>
      </div>
    </main>
  );
}

export default Stage1OpeningBrand;
