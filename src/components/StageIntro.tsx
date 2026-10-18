/*
 * ============================================================================
 *  מסך פתיחה של שלב
 * ============================================================================
 *
 *  כרטיס זכוכית עם הטקסט של הלקוחה, שורה אחר שורה, וכפתור אחד שנכנס לשלב
 *  עצמו (שלב 3: "התחלנו", שלב 4: "ועכשיו, זום אין"). השורות מגיעות מה-DB
 *  (content.intro.lines), עם הנוסח מהאפיון כברירת מחדל בכל שלב.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BackgroundVariant } from "./ui/AppBackground";
import type { IconName } from "./ui/Icon";
import StageShell from "./StageShell";
import { GlassButton } from "./ui/Glass";
import { cx } from "../lib/cx";

export interface IntroLine {
  text: string;
  bold?: boolean;
}

interface Props {
  stage: number;
  kicker: string;
  icon: IconName;
  background?: BackgroundVariant;
  lines: IntroLine[];
  startLabel: string;
  onStart: () => void;
}

function StageIntro({ stage, kicker, icon, background, lines, startLabel, onStart }: Props) {
  // **בלי גלילה, אף פעם.** גודל הכתב נגזר מגובה המסך (vh), ובנוסף נמדד בפועל:
  // אם הכרטיס גבוה מהאזור הפנוי (מסך נמוך, זום בדפדפן, טקסט ארוך כמו בשלב 4),
  // הכתב קטן באותו יחס עד שהכרטיס נכנס. אין גודל מינימלי - מינימום
  // (clamp) הוא בדיוק מה שגרם לכרטיס לגלוש ולאזור לגלול.
  const areaRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const area = areaRef.current;
    const card = cardRef.current;
    if (!area || !card) return;
    const avail = area.clientHeight;
    const height = card.offsetHeight;
    if (!avail || !height) return;
    // יחס ישיר בין גובה הכרטיס לגודל הכתב, עם מרווח קטן. גלישת שורות חדשה
    // אחרי ההקטנה מתוקנת בסבב הבא (האפקט רץ שוב כש-scale משתנה).
    const next = Math.min(1, scale * (avail / height) * 0.98);
    if (Math.abs(next - scale) > 0.01 && (height > avail || next > scale)) setScale(next);
  }, [scale, lines]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area || typeof ResizeObserver === "undefined") return;
    // שינוי גודל חלון - מתחילים מחדש מהגודל המלא ונותנים למדידה להקטין
    const observer = new ResizeObserver(() => setScale(1));
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  return (
    <StageShell
      stage={stage}
      kicker={kicker}
      icon={icon}
      background={background}
      width="normal"
      compactHeader
      // הכרטיס צר מהרווח שבין המד לטיימר - אין צורך לשמור להם רצועה
      tightBottom
      // האזור לא גולל - הכרטיס מותאם לגובה בעצמו (ראו scale למעלה)
      clipContent={false}
      actions={
        <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={onStart}>
          {startLabel}
        </GlassButton>
      }
    >
      <div ref={areaRef} className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
        <div
          ref={cardRef}
          className="glass glass-brick glass-raised flex max-w-4xl flex-col items-center gap-[0.5vh] rounded-2xl px-14 py-[2.6vh] text-center"
        >
          {lines.map((line, i) => (
            <p
              key={i}
              className={cx("leading-snug", line.bold ? "text-ink font-extrabold" : "text-ink-2")}
              style={{
                fontSize: line.bold
                  ? `calc(min(3.75vh, 2.6rem) * ${scale})`
                  : `calc(min(3.15vh, 2.1rem) * ${scale})`,
                animation: `fade-up 0.6s ${0.15 + i * 0.12}s var(--ds-ease) both`,
              }}
            >
              {line.text}
            </p>
          ))}
        </div>
      </div>
    </StageShell>
  );
}

export default StageIntro;
