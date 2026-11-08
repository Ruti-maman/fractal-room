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
import { LevelBadge } from "./ui/GameTile";
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
  /**
   * "breakdown" (שלב 4): הטקסט מוצג כפירוק - כותרת, זוגות שאלה/תשובה
   * כאריחים שמתפרקים מהמרכז, ו"המטרה". אם השורות לא בנויות כך, חוזרים
   * לכרטיס הרגיל.
   */
  layout?: "card" | "breakdown";
}

/* ==========================================================================
   פירוק (שלב 4)
   ========================================================================== */

interface Breakdown {
  headline: string;
  pairs: { question: string; answer: string }[];
  goalLabel: string | null;
  goal: string[];
}

/**
 * קורא את מבנה הטקסט מתוך השורות עצמן, כדי שתוכנית אחרת עם נוסח אחר
 * תעבוד בלי קוד: השורה הראשונה - כותרת; שורה שנגמרת ב-"?" - שאלה, והשורה
 * אחריה התשובה שלה; שורה שנגמרת ב-":" - פותחת את "המטרה", וכל מה שאחריה
 * שייך לה. פחות משתי שאלות - זה לא פירוק, ומוצג הכרטיס הרגיל.
 */
function parseBreakdown(lines: IntroLine[]): Breakdown | null {
  if (lines.length < 4) return null;
  const [first, ...rest] = lines;
  const pairs: Breakdown["pairs"] = [];
  let i = 0;
  while (i < rest.length && rest[i].text.trim().endsWith("?") && i + 1 < rest.length) {
    pairs.push({ question: rest[i].text, answer: rest[i + 1].text });
    i += 2;
  }
  if (pairs.length < 2) return null;
  let goalLabel: string | null = null;
  if (i < rest.length && rest[i].text.trim().endsWith(":")) {
    goalLabel = rest[i].text.trim().replace(/:$/, "");
    i += 1;
  }
  return { headline: first.text, pairs, goalLabel, goal: rest.slice(i).map((l) => l.text) };
}

/** מילה במירכאות (״בעיה״) נמחקת בקו - "לא לראות בעיה". */
function StrikeQuoted({ text, delay }: { text: string; delay: number }) {
  const parts = text.split(/(״[^״]+״|"[^"]+")/);
  return (
    <>
      {parts.map((part, i) =>
        /^(״|")/.test(part) ? (
          <span key={i} className="relative inline-block">
            {part}
            <span
              aria-hidden="true"
              className="bg-accent absolute inset-x-[-0.1em] top-[55%] h-[0.12em] origin-right rounded-full"
              style={{ animation: `strike-through 0.45s ${delay}s var(--ds-ease) both` }}
            />
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function BreakdownIntro({ data }: { data: Breakdown }) {
  const n = data.pairs.length;
  const center = (n - 1) / 2;
  // התזמון: כותרת, ואז החלקים מתפרקים בזה אחר זה, ואז המטרה
  const piecesAt = 0.45;
  const goalAt = piecesAt + n * 0.18 + 0.5;

  return (
    <div className="flex min-h-0 w-full max-w-6xl flex-1 flex-col items-center justify-center gap-[3.2vh] text-center">
      <p
        className="text-ink font-extrabold"
        style={{
          fontSize: "min(4.2vh, 2.9rem)",
          lineHeight: 1.2,
          animation: "fade-up 0.6s 0.1s var(--ds-ease) both",
        }}
      >
        {data.headline}
      </p>

      {/* החלקים: כל אריח יוצא מהמרכז ועף למקומו, עם סיבוב קל - הדילמה
          "מתפרקת" מול העיניים */}
      <ol className="grid w-full gap-4" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {data.pairs.map((pair, i) => (
          <li
            key={i}
            className="glass glass-brick glass-raised flex flex-col items-center gap-[1.2vh] rounded-2xl px-4 py-[2.6vh]"
            style={
              {
                // RTL: האריח הראשון מימין, ולכן "המרכז" נמצא משמאלו (שלילי)
                "--piece-x": `${(i - center) * 108}%`,
                "--piece-r": `${(i - center) * -7}deg`,
                animation: `piece-out 0.75s ${piecesAt + i * 0.18}s var(--ds-ease-spring) both`,
              } as React.CSSProperties
            }
          >
            <LevelBadge value={i + 1} label="" size={58} />
            <span className="text-ink font-extrabold" style={{ fontSize: "min(3.3vh, 2.2rem)", lineHeight: 1.2 }}>
              {pair.question}
            </span>
            <span className="text-accent font-bold" style={{ fontSize: "min(2.8vh, 1.8rem)" }}>
              {pair.answer}
            </span>
          </li>
        ))}
      </ol>

      {/* המטרה */}
      {data.goal.length > 0 && (
        <div className="flex flex-col items-center gap-[0.8vh]">
          {data.goalLabel && (
            <span
              className="glass glass-chip text-accent-soft !text-base font-extrabold"
              style={{ animation: `pop-in 0.5s ${goalAt}s var(--ds-ease-spring) both` }}
            >
              {data.goalLabel}
            </span>
          )}
          {data.goal.map((line, i) => {
            const last = i === data.goal.length - 1;
            const at = goalAt + 0.3 + i * 0.5;
            return (
              <p
                key={i}
                className={last ? "glass-title" : "text-ink-2 font-bold"}
                style={{
                  fontSize: last ? "min(5vh, 3.4rem)" : "min(3.4vh, 2.3rem)",
                  lineHeight: 1.2,
                  animation: `${last ? "pop-in 0.7s" : "fade-up 0.6s"} ${at}s var(--ds-ease-spring) both`,
                }}
              >
                <StrikeQuoted text={line} delay={at + 0.6} />
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StageIntro({ stage, kicker, icon, background, lines, startLabel, onStart, layout = "card" }: Props) {
  const breakdown = layout === "breakdown" ? parseBreakdown(lines) : null;
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
      {breakdown ? (
        <BreakdownIntro data={breakdown} />
      ) : (
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
      )}
    </StageShell>
  );
}

export default StageIntro;
