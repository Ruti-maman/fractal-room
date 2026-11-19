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
  /** לא מוצג יותר (התגית הוסרה ממסכי הפתיחה, 2026-11-15) */
  kicker?: string;
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
          // המילה באדום-כתום, וקו נייבי נמתח עליה באלכסון קל כמו טוש שמוחק,
          // ואז היא דוהה - "לא לראות בעיה" (si-strike ב-editorial.css)
          <span
            key={i}
            className="si-strike"
            style={{ "--si-strike-at": `${delay}s` } as React.CSSProperties}
          >
            {part}
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
    // צמוד למעלה ולא ממורכז, אבל מתחת לתג הקבוצה שבפינה הימנית-עליונה -
    // בריווח של 3vh הכותרת עלתה מתחתיו ונחתכה (2026-11-15)
    <div className="flex min-h-0 w-full max-w-6xl flex-1 flex-col items-center justify-start gap-[3.2vh] pt-[clamp(4rem,8vh,6rem)] text-center">
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
      {/* ארבעה קלפים בארבעה צבעים של הלקוחה (כחול / לבן / אדום-כתום /
          נייבי - bd-card ב-editorial.css). כל קלף עף מהמרכז למקומו, ואז
          הצבע שלו "נצבע" עליו מימין לשמאל, והתוכן עולה: מספר ענק ודק,
          השאלה, התשובה הגדולה וחץ אלכסוני דק. */}
      <ol className="bd-cards grid w-full" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {data.pairs.map((pair, i) => {
          const at = piecesAt + i * 0.18;
          return (
            <li
              key={i}
              className={`bd-card bd-card--${(i % 4) + 1}`}
              style={
                {
                  // RTL: האריח הראשון מימין, ולכן "המרכז" נמצא משמאלו (שלילי)
                  "--piece-x": `${(i - center) * 108}%`,
                  "--piece-r": `${(i - center) * -7}deg`,
                  "--bd-at": `${at + 0.55}s`,
                  animation: `piece-out 0.75s ${at}s var(--ds-ease-spring) both`,
                } as React.CSSProperties
              }
            >
              <span className="bd-card__num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="bd-card__q">{pair.question}</span>
              <span className="bd-card__a">{pair.answer}</span>
              <svg className="bd-card__arrow" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 5 L5 19 M5 8.5 L5 19 L15.5 19" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </li>
          );
        })}
      </ol>

      {/* המטרה */}
      {data.goal.length > 0 && (
        <div className="flex flex-col items-center gap-[0.8vh]">
          {data.goalLabel && (
            <span
              // בלי מסגרת (בקשת המפתחת 2026-11-15) - רק המילה
              className="text-accent-soft text-base font-extrabold"
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

/* ==========================================================================
   הקלדה אות אחר אות (בקשת המפתחת 2026-11-15) + איורים לשורת "רעיון / שאלה"
   ========================================================================== */

/** שניות לאות, והפסקה קצרה בסוף כל שורה. */
const TYPE_CHAR = 0.028;
const TYPE_LINE_GAP = 0.2;
const TYPE_START = 0.35;

/** כל אות span משלה שנדלק בזמן שלה. עברית לא מחברת אותיות, אז הפירוק לא שובר צורה. */
function TypedChars({ text, start }: { text: string; start: number }) {
  return (
    <>
      {Array.from(text).map((ch, i) => (
        <span key={i} className="si-ch" style={{ animationDelay: `${start + i * TYPE_CHAR}s` }}>
          {ch}
        </span>
      ))}
    </>
  );
}

/** קווי האיור (viewBox 24), לפי מילה - כל מילה מקבלת "חפץ" משלה. */
/**
 * `rays` - קווים שמהבהבים בלולאה אחרי השרטוט (קרני האור של הנורה).
 * `inner` - קווים שמצטיירים מיד אחרי הגוף ונשארים (שני פסי הברק בתוך הלב).
 */
const WORD_ICONS: { match: RegExp; kind: string; d: string; rays?: string[]; inner?: string }[] = [
  // רעיון - נורה, ומאחר שצוירה יוצאות ממנה קרני אור
  {
    match: /רעיון/,
    kind: "idea",
    d: "M9.5 18h5 M10.5 21h3 M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z",
    // כל קרן מצוירת מבפנים החוצה
    rays: ["M12 0.4V-2.2", "M6.4 2.6L4.6 0.8", "M17.6 2.6L19.4 0.8", "M4.4 8.6H1.8", "M19.6 8.6H22.2"],
  },
  // שאלה - סימן שאלה
  { match: /שאלה/, kind: "question", d: "M8.5 8.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3V15.5 M12 19.5v.5" },
  // תחושה - לב, עם שני פסי ברק בתוך האונה השמאלית
  {
    match: /תחוש|רגש/,
    kind: "feeling",
    d: "M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z",
    inner: "M7.1 11.4a2.4 2.4 0 0 1 1.7-2.6 M7.3 13.4l.35.7",
  },
  // כיוון - חץ אלכסוני דק, כמו החיצים באתר
  { match: /כיוו/, kind: "direction", d: "M5 19 L19 5 M9.5 5 L19 5 L19 14.5" },
];
const FALLBACK_ICON = "M6 6h12v12H6z";

/** שורה בנויה כ"מילה / מילה / מילה" (לפחות שלוש) - מקבלת איורים. */
function isSlashList(text: string) {
  return text.split("/").length >= 3;
}

/**
 * שורת "רעיון / שאלה / תחושה / כיוון": כל מילה מוקלדת, ולצידה נשרטט איור
 * דק ברגע שהיא מתחילה להיכתב, ואז מונפש. הטקסט עצמו
 * לא משתנה - רק מתפרק לחלקים סביב הלוכסנים.
 */
function SlashListLine({ text, start }: { text: string; start: number }) {
  const parts = text.split(/(\s*\/\s*)/);
  let offset = 0;
  return (
    <>
      {parts.map((part, i) => {
        const at = start + offset * TYPE_CHAR;
        offset += Array.from(part).length;
        if (i % 2 === 1) {
          return <TypedChars key={i} text={part} start={at} />;
        }
        const found = WORD_ICONS.find((icon) => icon.match.test(part));
        const d = found?.d ?? FALLBACK_ICON;
        return (
          <span key={i} className="si-word">
            {/* האיור לצד המילה (מימינה, לפני הקריאה). בפעם הראשונה הוא
                מצטייר, ואחר כך עובר להנפשה משלו (si-art--* ב-editorial.css):
                נורה מפיצה קרניים, שאלה קופצת, לב פועם, חץ זז לכיוונו */}
            <span
              className={cx("si-art", `si-art--${found?.kind ?? "plain"}`)}
              aria-hidden="true"
              style={{ "--si-idle-at": `${at + 1}s` } as React.CSSProperties}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                // בלי non-scaling-stroke: הוא מבטל את pathLength, והשרטוט יצא מקווקו
                strokeWidth="1.1"
                strokeLinecap="square"
                strokeLinejoin="miter"
              >
                <path className="si-draw" d={d} pathLength={1} style={{ animationDelay: `${at}s` }} />
                {found?.inner && (
                  <path
                    className="si-draw"
                    d={found.inner}
                    pathLength={1}
                    style={{ animationDelay: `${at + 0.7}s`, animationDuration: "0.5s" }}
                  />
                )}
                {found?.rays?.map((ray, r) => (
                  <path
                    key={r}
                    className="si-ray"
                    d={ray}
                    pathLength={1}
                    style={{ animationDelay: `calc(var(--si-idle-at) + ${r * 0.08}s)` }}
                  />
                ))}
              </svg>
            </span>
            <span>
              <TypedChars text={part} start={at} />
            </span>
          </span>
        );
      })}
    </>
  );
}

function StageIntro({ stage, icon, background, lines, startLabel, onStart, layout = "card" }: Props) {
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
      // התגית ("שמש אסוציאציות") הוסרה ממסך הפתיחה - בקשת המפתחת 2026-11-15
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
        {/* בלי מסגרת (בקשת המפתחת 2026-11-15): השורות על הנייר עצמו. כל
            שורה "נגללת" למעלה מתוך פס סמוי, בזו אחר זו, ומתחת לשורה מודגשת
            נמתח קו כתום אחרי שהיא נחתה (si-* ב-editorial.css) */}
        <div
          ref={cardRef}
          className="si-lines flex max-w-4xl flex-col items-center gap-[0.5vh] px-14 py-[2.6vh] text-center"
        >
          {(() => {
            // ההקלדה רציפה על פני כל השורות: כל שורה מתחילה כשהקודמת נגמרה
            let clock = TYPE_START;
            return lines.map((line, i) => {
              const at = clock;
              const length = Array.from(line.text).length;
              const done = at + length * TYPE_CHAR;
              clock = done + TYPE_LINE_GAP;
              return (
                <p
                  key={i}
                  className={cx("si-line leading-snug", line.bold ? "text-ink font-extrabold" : "text-ink-2")}
                  style={{
                    fontSize: line.bold
                      ? `calc(min(3.75vh, 2.6rem) * ${scale})`
                      : `calc(min(3.15vh, 2.1rem) * ${scale})`,
                  }}
                >
                  {/* קורא מסך מקבל את השורה שלמה, לא אות אות */}
                  <span className="sr-only">{line.text}</span>
                  <span
                    aria-hidden="true"
                    className={cx("si-line__in", line.bold && "si-line__in--mark")}
                    style={{ "--si-mark-at": `${done}s` } as React.CSSProperties}
                  >
                    {isSlashList(line.text) ? (
                      <SlashListLine text={line.text} start={at} />
                    ) : (
                      <TypedChars text={line.text} start={at} />
                    )}
                  </span>
                </p>
              );
            });
          })()}
        </div>
      </div>
      )}
    </StageShell>
  );
}

export default StageIntro;
