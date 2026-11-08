import { useEffect, useMemo, useState } from "react";
import { GlassButton } from "../ui/Glass";
import SandText from "../SandText";
import { normalizeVotes, useRatings } from "../../hooks/useRatings";
import type { Group } from "../../types/group";
import { BackgroundLayers } from "../ui/AppBackground";
import Icon from "../ui/Icon";
// תג השלב העגול - אותו תג כמו בכותרת של StageShell בכל שאר השלבים
import { LevelBadge } from "../ui/GameTile";
import { ConclusionInHeader } from "../PracticalConclusionBanner";
import { cx } from "../../lib/cx";

/** שורה בכרטיסי הטקסט של השלב. `bold` לשורות שהלקוחה הדגישה. */
interface Line {
  text: string;
  bold?: boolean;
}

/** תוכן שלב 8 מה-DB. הכול אופציונלי - ברירות המחדל הן התסריט של הלקוחה. */
export interface Stage8Content {
  kicker?: string;
  kicker_sub?: string;
  reflection_lines?: Line[];
  winners_label?: string;
  closing_lines?: Line[];
}

const DEFAULTS = {
  kicker: "ברינה קצורה",
  kicker_sub: "סיום ונצחון",
  winners_label: "ויש לנו גם מנצחות",
  reflection_lines: [
    { text: "הגענו לשלב הגמר,", bold: true },
    { text: "אך פרקטל הוא אין סופי..." },
    { text: "מה שעשינו עכשיו בקבוצה אחת, עם תלמידה אחת, בסיטואציה אחת -" },
    { text: "יכול להפוך לדפוס חדש ומתמשך..." },
    { text: "כי ככה שינוי עובד." },
    { text: "וזו אולי כל הנקודה:", bold: true },
    { text: "לא צריך לשנות את כל המערכת ביום אחד." },
    { text: "צריך לזהות איפה אנחנו יכולות לשנות את הדפוס." },
    { text: "ואז לעשות את זה. שוב. ועוד פעם." },
    { text: "כי מה שחוזר בקטן — בסוף נראה בגדול.", bold: true },
  ] as Line[],
  closing_lines: [
    { text: "זה נחמד לנצח בסימולטור," },
    { text: "אבל הכי חשוב לזכור את זה גם מחר בכיתה..." },
    { text: "להאמין בכל צורה שהיא, לדעת מתי לשנות, להכפיל או לחסר" },
    { text: "והזורעת בדמעה, ברינה קצורה, צורה.", bold: true },
  ] as Line[],
};

interface Props {
  workshopId: string;
  myGroup: Group;
  allGroups: Group[];
  content?: Stage8Content;
  onAdvance: () => void;
  /**
   * איזה חלק מוצג (דרישת הלקוחה: "הניצחון אמור להיות שלב 9"):
   *   reflection - שלב 8: "הגענו לשלב הגמר...", והכפתור "ויש לנו גם מנצחות"
   *                עובר לשלב 9.
   *   winner     - שלב 9: הכרזת המנצחת, ואחריה "זה נחמד לנצח בסימולטור...",
   *                ומשם לשלב 10 (העיקרון שה-AI מנסח).
   */
  part?: "reflection" | "winner";
  /** מספר השלב לתג העגול. */
  stageNumber?: number;
}

/*
 * ============================================================================
 *  שלב 8 - הכרזת המנצחת
 * ============================================================================
 *
 *  ----------------------------------------------------------------------
 *  למה הגביע עשוי זכוכית ולא זהב
 *  ----------------------------------------------------------------------
 *  הגרסה הקודמת הייתה מסך זהב מלא: גביע מוזהב, קרני זהב, קונפטי צבעוני
 *  בשישה צבעים, ומדליות באמוג'י. זה חגג יפה, אבל היה המסך היחיד בסדנה
 *  שלא נראה שייך אליה.
 *
 *  כאן הגביע הוא **לבנת זכוכית טורקיז** כמו כל השאר, רק שהיא היחידה
 *  שמוארת מבפנים בעוצמה מלאה. זה שומר על "רגע הפרס" בלי לצאת מהשפה -
 *  ובעצם מחזק אותו, כי הזוהר הזה לא מופיע בשום מסך אחר.
 *
 *  ----------------------------------------------------------------------
 *  שני תיקונים מעבר לעיצוב
 *  ----------------------------------------------------------------------
 *  1. **המדליות אינן אמוג'י.** 🥇 מעובד אחרת בכל דפדפן ומערכת הפעלה, ועל
 *     WebView ישן של אנדרואיד הוא עלול להיראות שונה לגמרי או לא להופיע.
 *     הפרויקט כבר נמנע מאמוג'י בדיוק מהסיבה הזו (ראו Stage5) - וכאן זה
 *     נשאר חריג. במקומן דיסקיות מצוירות עם מספר המקום.
 *  2. **הקונפטי מושהה ב-prefers-reduced-motion.** 60 פתיתים שנופלים
 *     בלולאה אינסופית הם בדיוק מה שהבקשה הזו מנסה למנוע.
 */

/**
 * פתיתי הקונפטי - רסיסי זכוכית ים. המיקום, הצבע והמהירות של כל פתית
 * קבועים ולא אקראיים בזמן ריצה, כדי שהם לא "יקפצו" בכל רינדור מחדש.
 * 60 פתיתים זה מספיק לתחושת חגיגה בלי להעמיס על הפלזמות (סעיף 2
 * ב-CLAUDE.md - דפדפן שעשוי להיות ישן).
 */
const SHARD_COLORS = ["#f5300f", "#f26a50", "#f4c7bc", "#c8955f", "#283d5b"];

const CONFETTI = Array.from({ length: 60 }, (_, i) => {
  const rand = (seed: number) => (Math.sin(i * seed) + 1) / 2;
  return {
    left: Math.round(rand(12.9898) * 98),
    delay: +(rand(78.233) * 6).toFixed(2),
    duration: +(3.6 + rand(43.7) * 3.4).toFixed(2),
    drift: Math.round(rand(93.1) * 220 - 110),
    spin: Math.round(360 + rand(17.3) * 900),
    width: 7 + Math.round(rand(29.7) * 6),
    height: 11 + Math.round(rand(55.1) * 10),
    color: SHARD_COLORS[i % SHARD_COLORS.length],
    round: i % 4 === 0,
  };
});

/** פנפרת ניצחון קצרה - רצף עולה ואז אקורד. */
function playWinSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();

    const note = (freq: number, start: number, length: number, volume = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + length + 0.05);
    };

    // דו-מי-סול-דו עולה, ואז אקורד מנצח
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.13, 0.22));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => note(f, 0.62, 1.1, 0.12));
  } catch {
    // בלי צליל אם הדפדפן לא תומך - לא עוצרים את הזרימה.
  }
}

/**
 * גביע זכוכית. אותה לוגיקת חומר כמו לבנת הזכוכית: פנים בהיר, קצוות
 * שמתעבים, ברק ספקולרי בפינה העליונה-שמאלית ודופן רחוקה שנראית דרך
 * הזכוכית - מה שנותן לו נפח בלי להפוך אותו למתכת.
 */
function GlassTrophy() {
  return (
    <svg viewBox="0 0 120 130" className="h-full w-full" aria-hidden="true">
      <defs>
        {/* גוף הזכוכית - בהיר למעלה, מתעבה כלפי מטה */}
        <linearGradient id="tr-body" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#fbe9e4" stopOpacity={0.95} />
          <stop offset="35%" stopColor="#f4c7bc" stopOpacity={0.9} />
          <stop offset="75%" stopColor="#f3846e" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#e8462a" stopOpacity={0.95} />
        </linearGradient>
        {/* הקצה העבה - הבסיס והשפה */}
        <linearGradient id="tr-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d8aa78" />
          <stop offset="100%" stopColor="#a46f3d" />
        </linearGradient>
        {/* הברק על הזכוכית */}
        <linearGradient id="tr-spec" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.85} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* ידיות */}
      <path
        d="M28 22H14c0 20 6 30 18 33"
        fill="none"
        stroke="url(#tr-edge)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M92 22h14c0 20-6 30-18 33"
        fill="none"
        stroke="url(#tr-edge)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.9"
      />

      {/* גוף הגביע */}
      <path d="M28 14h64v26c0 20-14 34-32 34S28 60 28 40V14z" fill="url(#tr-body)" />
      {/* השפה העליונה - אליפסה שנותנת את הנפח הגלילי */}
      <ellipse cx="60" cy="14" rx="32" ry="6" fill="url(#tr-edge)" opacity="0.95" />
      <ellipse
        cx="60"
        cy="14"
        rx="26"
        ry="4"
        fill="none"
        stroke="#fbe9e4"
        strokeWidth="1.2"
        opacity="0.55"
      />

      {/* ברק ספקולרי על הדופן */}
      <path d="M38 20c-3 15-1 28 8 37-11-5-17-21-14-37z" fill="url(#tr-spec)" />
      {/* פס שבירה בקצה הימני, כמו בלבנה */}
      <path d="M84 20c1 14 0 25-5 33" stroke="#fbe9e4" strokeWidth="1.5" fill="none" opacity="0.4" />

      {/* רגל ובסיס */}
      <rect x="54" y="72" width="12" height="20" fill="url(#tr-edge)" opacity="0.9" />
      <rect x="40" y="92" width="40" height="9" rx="3" fill="url(#tr-body)" />
      <rect x="32" y="101" width="56" height="13" rx="4" fill="url(#tr-edge)" opacity="0.95" />
      <rect x="34" y="102.5" width="52" height="3" rx="1.5" fill="#fbe9e4" opacity="0.4" />

      {/* כוכב חרוט בזכוכית */}
      <path
        d="M60 30l4.2 8.5 9.4 1.4-6.8 6.6 1.6 9.3-8.4-4.4-8.4 4.4 1.6-9.3-6.8-6.6 9.4-1.4z"
        fill="#ffffff"
        opacity="0.75"
      />
    </svg>
  );
}

/** דיסקית מקום - מחליפה את אמוג'י המדליה. */
function PlaceDisc({ place }: { place: number }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex h-12 w-12 items-center justify-center text-lg font-extrabold",
        place === 1 ? "bubble bubble--4" : place === 2 ? "bubble bubble--2" : "bubble bubble--5",
      )}
    >
      {place}
    </span>
  );
}

/** כרטיס טקסט - השורות עולות אחת אחרי השנייה. גודל הכתב נגזר מגובה המסך. */
function LinesCard({ lines }: { lines: Line[] }) {
  return (
    <div className="glass glass-brick glass-raised relative flex w-full max-w-3xl flex-col items-center gap-[0.6vh] rounded-2xl px-10 py-[2.6vh] text-center">
      {lines.map((line, i) => {
        const last = i === lines.length - 1;
        // השורה המסכמת ("כי מה שחוזר בקטן — בסוף נראה בגדול") - טקסט רגיל
        // בגרדיאנט הקשת. אפקט ה"נוף" (קווי אופק) הוסר לבקשת הלקוחה.
        return (
          <p
            key={i}
            className={cx(
              "leading-snug",
              last && line.bold ? "glass-title mt-[0.8vh]" : line.bold ? "text-ink font-extrabold" : "text-ink-2",
            )}
            style={{
              fontSize: last && line.bold ? "min(4.4vh, 2.6rem)" : line.bold ? "min(3.3vh, 1.9rem)" : "min(2.9vh, 1.6rem)",
              animation: `fade-up 0.6s ${0.15 + i * 0.14}s var(--ds-ease) both`,
            }}
          >
            {line.text}
          </p>
        );
      })}
    </div>
  );
}

/*
  שלושה מסכים, לפי התסריט של הלקוחה:
    reflection - "הגענו לשלב הגמר, אך פרקטל הוא אין סופי..."
    winner     - "ויש לנו גם מנצחות": הגביע, הקבוצה המנצחת והפודיום
    closing    - "זה נחמד לנצח בסימולטור... והזורעת בדמעה, ברינה קצורה"
  המעבר בכפתור. מצב מקומי: רענון חוזר למסך הראשון - זה שלב משותף קצר,
  והטיימר שבפינה (שנשמר ב-DB) הוא שמעביר לשלב הבא.
*/
type Phase = "reflection" | "winner" | "closing";

function Stage8Winner({
  workshopId,
  myGroup,
  allGroups,
  content,
  onAdvance,
  part = "reflection",
  stageNumber = 8,
}: Props) {
  const { rows } = useRatings(workshopId, myGroup.id);
  const [phase, setPhase] = useState<Phase>(part === "winner" ? "winner" : "reflection");
  const t = {
    kicker: content?.kicker || DEFAULTS.kicker,
    kicker_sub: content?.kicker_sub || DEFAULTS.kicker_sub,
    winners_label: content?.winners_label || DEFAULTS.winners_label,
    reflection_lines: content?.reflection_lines?.length ? content.reflection_lines : DEFAULTS.reflection_lines,
    closing_lines: content?.closing_lines?.length ? content.closing_lines : DEFAULTS.closing_lines,
  };

  // הדירוג בשלב 7 הוא "לייק": כל בת מסמנת כוכב אחד, ולכן המנצחת היא מי
  // שצברה הכי הרבה לייקים - לא ממוצע (כל הלייקים שווים 1). normalizeVotes
  // מטפלת גם בהפעלות ישנות שבהן נשמר דירוג 1-5 בודד.
  const ranking = useMemo(() => {
    const likes: Record<string, number> = {};
    for (const row of rows) {
      for (const [groupId, votes] of Object.entries(normalizeVotes(row.data))) {
        likes[groupId] = (likes[groupId] ?? 0) + votes.length;
      }
    }
    return allGroups
      .map((group) => ({ group, likes: likes[group.id] ?? 0 }))
      .sort((a, b) => b.likes - a.likes || a.group.screen_number - b.group.screen_number);
  }, [rows, allGroups]);

  const winner = ranking[0];
  const hasVotes = ranking.some((entry) => entry.likes > 0);

  // הפנפרה ברגע ההכרזה עצמה, לא בכניסה לשלב
  useEffect(() => {
    if (phase === "winner" && hasVotes) playWinSound();
  }, [phase, hasVotes]);

  // סדר התצוגה בפודיום: שנייה, ראשונה במרכז, שלישית - כמו פודיום אמיתי
  const podium = [ranking[1], ranking[0], ranking[2]].filter(Boolean);
  /*
    גובה העמוד **יחסי למספר הכוכבים**: מספר כוכבים זהה = גובה זהה, ומנצחת
    עם פי 4 כוכבים - עמוד גבוה בהרבה. קודם הגבהים היו קבועים לפי מקום
    (158/112/88), ושתי קבוצות עם 3 כוכבים כל אחת קיבלו עמודים שונים.
    MIN שומר שגם קבוצה בלי כוכבים תקבל בסיס שרואים.
  */
  const PODIUM_MIN = 40;
  // נגזר מגובה המסך: 140 על הפלזמה, ונמוך יותר במסך נמוך - שם עמוד של 140
  // נחתך בתחתית
  const PODIUM_MAX = Math.min(140, Math.round(window.innerHeight * 0.13));
  const maxLikes = Math.max(1, ...ranking.map((e) => e.likes));
  const heightFor = (likes: number) =>
    Math.round(PODIUM_MIN + (likes / maxLikes) * (PODIUM_MAX - PODIUM_MIN));
  // מקום עם שוויון: מספר הקבוצות שקיבלו יותר כוכבים, ועוד 1 - כך שתי
  // קבוצות עם אותו מספר כוכבים חולקות את אותו מקום.
  const placeFor = (likes: number) => ranking.filter((e) => e.likes > likes).length + 1;

  // הכותרת העליונה - זהה בשלושת המסכים: התג, "ברינה קצורה" ומתחתיו "סיום ונצחון"
  const header = (
    <div
      className="relative flex flex-none flex-col items-center gap-2"
      style={{ animation: "fade-up var(--ds-dur-slow) var(--ds-ease) both" }}
    >
      <LevelBadge value={stageNumber} progress={stageNumber / 10} size={88} />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="glass glass-chip text-accent-soft gap-2">
          <Icon name="trophy" size={15} />
          {t.kicker}
        </span>
        <ConclusionInHeader />
      </div>
      <span className="text-ink-3 -mt-1 text-sm font-bold">{t.kicker_sub}</span>
    </div>
  );

  if (phase !== "winner") {
    const isReflection = phase === "reflection";
    return (
      <main className="relative flex h-dvh flex-col items-center justify-center-safe gap-[2vh] overflow-hidden px-6 pt-20 pb-8 text-center">
        <BackgroundLayers variant="night" />
        {header}
        <LinesCard
          key={phase}
          lines={isReflection ? t.reflection_lines : t.closing_lines}
        />
        {/* שלב 8: "ויש לנו גם מנצחות" עובר לשלב 9 (ההכרזה).
            שלב 9, אחרי טקסט הסיום: "להמשך" עובר לשלב 10. */}
        <GlassButton variant="primary" size="lg" iconAfter="arrowNext" onClick={onAdvance}>
          {isReflection ? t.winners_label : "להמשך"}
        </GlassButton>
      </main>
    );
  }

  return (
    // pb-4 ולא pb-40: הפודיום צר ויושב באמצע, בין מד ההתקדמות לטיימר שבפינות -
    // הרצועה התחתונה הגבוהה רק דחפה את התוכן למעלה, ותג השלב נחתך בראש המסך.
    // justify-center-safe: אם בכל זאת אין מקום - מצמיד למעלה, לא חותך.
    <main className="relative flex h-dvh flex-col items-center justify-center-safe gap-3 overflow-hidden px-6 pt-20 pb-4 text-center">
      <BackgroundLayers variant="night" />

      {/* קונפטי - רק כשיש תוצאה אמיתית להכריז עליה.
          `motion-safe` מוודא שהוא לא רץ כשביקשו פחות תנועה. */}
      {hasVotes && (
        <div className="pointer-events-none fixed inset-0 hidden overflow-hidden motion-safe:block">
          {CONFETTI.map((piece, i) => (
            <span
              key={i}
              className="absolute top-0"
              style={{
                insetInlineStart: `${piece.left}%`,
                width: piece.width,
                height: piece.round ? piece.width : piece.height,
                background: piece.color,
                opacity: 0.85,
                borderRadius: piece.round ? "9999px" : "2px",
                ["--drift" as string]: `${piece.drift}px`,
                ["--spin" as string]: `${piece.spin}deg`,
                animation: `confetti-fall ${piece.duration}s ${piece.delay}s linear infinite`,
              }}
            />
          ))}
        </div>
      )}

      {header}

      {/* הגביע, עם קרני אור מסתובבות מאחוריו וניצוצות */}
      <div className="relative flex h-28 w-28 flex-none items-center justify-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute hidden h-[26rem] w-[26rem] opacity-50 motion-safe:block"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(242,106,80,0.4) 0deg, transparent 22deg, rgba(200,149,95,0.35) 45deg, transparent 67deg, rgba(242,106,80,0.35) 90deg, transparent 112deg, rgba(200,149,95,0.35) 135deg, transparent 157deg, rgba(242,106,80,0.35) 180deg, transparent 202deg, rgba(200,149,95,0.35) 225deg, transparent 247deg, rgba(242,106,80,0.35) 270deg, transparent 292deg, rgba(200,149,95,0.35) 315deg, transparent 337deg)",
            maskImage: "radial-gradient(circle, #000 18%, rgba(0,0,0,0.5) 45%, transparent 72%)",
            WebkitMaskImage:
              "radial-gradient(circle, #000 18%, rgba(0,0,0,0.5) 45%, transparent 72%)",
            animation: "rays-spin 24s linear infinite",
          }}
        />
        <div
          aria-hidden="true"
          className="bg-glow pointer-events-none absolute h-64 w-64 rounded-full blur-[60px]"
        />

        <div
          className="relative h-28 w-28"
          style={{
            animation: "trophy-float 3.4s ease-in-out infinite",
            filter: "drop-shadow(0 12px 34px var(--ds-glow))",
          }}
        >
          <GlassTrophy />
        </div>

        {/* ניצוצות סביב הגביע - צורה מצוירת, לא תו טקסט */}
        {[
          { top: "6%", left: "12%", size: 20, delay: 0 },
          { top: "18%", left: "84%", size: 15, delay: 0.7 },
          { top: "72%", left: "4%", size: 13, delay: 1.4 },
          { top: "62%", left: "90%", size: 18, delay: 2.1 },
          { top: "2%", left: "58%", size: 12, delay: 2.8 },
        ].map((sp) => (
          <span
            key={`${sp.top}-${sp.left}`}
            aria-hidden="true"
            className="text-accent-pale pointer-events-none absolute"
            style={{
              top: sp.top,
              insetInlineStart: sp.left,
              animation: `sparkle 2.6s ${sp.delay}s ease-in-out infinite`,
            }}
          >
            <Icon name="star" size={sp.size} filled />
          </span>
        ))}
      </div>

      {/* שם המנצחת */}
      {winner && hasVotes ? (
        <div className="relative flex flex-col items-center gap-2">
          <p className="text-ink-3 text-base font-bold">הקבוצה המנצחת</p>
          {/* שם המנצחת נשפך כחול מלמעלה (SandText) - לבקשת הלקוחה, מאפקט
              "חול" שהיא שלחה. ה-h1 נשאר לקוראי מסך. */}
          <h1 className="sr-only">{winner.group.name ?? `מסך ${winner.group.screen_number}`}</h1>
          <SandText
            text={winner.group.name ?? `מסך ${winner.group.screen_number}`}
            className="h-[min(9rem,15vh)] w-[min(64rem,80vw)]"
          />
          {/* מספר הכוכבים ו"להמשך" באותה שורה - כל שורה שנחסכת כאן היא
              מקום לפודיום, שאחרת נחתך בתחתית המסך */}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
            <p
              className="glass glass-pill text-accent gap-2 px-5 py-2 text-xl font-extrabold"
              style={{ animation: "fade-up 0.8s 0.6s var(--ds-ease) both" }}
            >
              <Icon name="star" size={20} filled />
              {winner.likes} {winner.likes === 1 ? "כוכב" : "כוכבים"}
            </p>
            <GlassButton
              size="md"
              iconAfter="arrowNext"
              onClick={() => setPhase("closing")}
              style={{ animation: "fade-up 0.8s 1.2s var(--ds-ease) both" }}
            >
              להמשך
            </GlassButton>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-3">
          <h1 className="glass-title text-3xl">אף קבוצה לא קיבלה כוכבים עדיין</h1>
          <GlassButton size="md" iconAfter="arrowNext" onClick={() => setPhase("closing")}>
            להמשך
          </GlassButton>
        </div>
      )}

      {/* פודיום עם כל שלוש הקבוצות */}
      {hasVotes && (
        <div className="relative flex items-end justify-center gap-3 pb-1 sm:gap-4">
          {podium.map((entry, i) => {
            const isWinner = entry.likes === winner?.likes;
            return (
              <div
                key={entry.group.id}
                className="flex w-28 flex-col items-center gap-2 sm:w-40"
              >
                <PlaceDisc place={placeFor(entry.likes)} />
                <span className="text-ink truncate text-sm font-bold sm:text-base">
                  {entry.group.name ?? `מסך ${entry.group.screen_number}`}
                </span>
                <span className="text-accent-soft flex items-center gap-1 text-sm font-bold">
                  <Icon name="star" size={14} filled />
                  {entry.likes}
                </span>
                <div
                  className={cx(
                    "glass w-full origin-bottom rounded-t-lg",
                    isWinner && "glass-active",
                  )}
                  style={{
                    height: heightFor(entry.likes),
                    animation: `podium-rise 0.7s ${0.5 + i * 0.15}s var(--ds-ease-spring) both`,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default Stage8Winner;
