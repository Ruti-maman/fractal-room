/*
 * ============================================================================
 *  אריח משחק + תג שלב
 * ============================================================================
 *
 *  הרפרנס: Microsoft Solitaire Collection. מה שעושה שם את התחושה של
 *  "משחק" הוא לא הצבעוניות אלא **המבנה**, ואפשר לקחת אותו כמו שהוא גם
 *  לפלטה אחת:
 *
 *    1. **כל אריח הוא סצנה.** לא מלבן עם טקסט - חלק עליון מאויר עם
 *       אופק, שכבות ועומק, שנותן לאריח זהות משלו.
 *    2. **תג שלב עגול** שיושב על גבול הסצנה והגוף, עם טבעת סביבו.
 *       זה האלמנט שהכי מזוהה עם "משחק", והוא גם אומר בדיוק איפה אנחנו.
 *    3. **כותרת שמנה עם אייקון** בראש האריח, על גבי הסצנה.
 *    4. **ברק** - האריחים נראים מצופים, לא מט.
 *
 *  מה **לא** לקחנו משם: את הקשת. שם כל משחק בצבע אחר; כאן הכל טורקיז,
 *  והבידול בין האריחים מגיע מהסצנה ומהעומק ולא מגוון חדש. זו ההנחיה
 *  המפורשת של הלקוחה (סעיף 3 ב-CLAUDE.md).
 */

import { useId, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import Icon, { type IconName } from "./Icon";

/* ==========================================================================
   תג השלב
   ========================================================================== */

interface BadgeProps {
  /** המספר הגדול בתוך התג. */
  value: ReactNode;
  /** צבע מפלטת הבועות (1-5). בלעדיו - טורקיז. */
  tone?: 1 | 2 | 3 | 4 | 5;
  /** הכיתוב הקטן מעליו, למשל "שלב". */
  label?: string;
  /** 0 עד 1 - כמה מהטבעת מלאה. בלעדיו הטבעת מלאה. */
  progress?: number;
  size?: number;
  className?: string;
}

/**
 * תג המעוין עם המסגרת - החתימה הוויזואלית של הרפרנס (עיגול עד 2026-11-08).
 *
 * הטבעת היא SVG ולא `border`, כי רק כך אפשר למלא אותה חלקית
 * (`strokeDasharray`) ולהשתמש באותו רכיב גם כמד התקדמות.
 */
export function LevelBadge({
  value,
  tone,
  label = "שלב",
  progress = 1,
  size = 92,
  className,
}: BadgeProps) {
  // מסגרת מעוין ולא טבעת (2026-11-08). מתחילה בקודקוד העליון ונעה עם
  // כיוון השעון; pathLength=100 מחליף את חישוב ההיקף.
  const r = 46;
  const diamond = `M50 ${50 - r} L${50 + r} 50 L50 ${50 + r} L${50 - r} 50 Z`;
  const ringId = `level-ring-${useId().replace(/:/g, "")}`;

  return (
    <span
      className={cx("relative inline-flex flex-none items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* הילה מאחורי התג - מה שגורם לו להיראות מואר ולא מודבק */}
      <span
        aria-hidden="true"
        className="bg-glow diamond absolute inset-0 blur-lg opacity-70"
      />

      <svg viewBox="0 0 100 100" className="absolute inset-0 overflow-visible" aria-hidden="true">
        {/* הטבעת עוברת מהקורל לנייבי - כמו הדיסקית שבתוכה, ולא בקאמל
            (בקשת הלקוחה). id ייחודי לכל תג, כי כמה תגים באותו מסך */}
        <defs>
          <linearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--ds-pal-4)" }} />
            <stop offset="100%" style={{ stopColor: "var(--ds-navy)" }} />
          </linearGradient>
        </defs>
        <path d={diamond} fill="none" stroke="var(--ds-glass-strong)" strokeWidth="6" strokeLinejoin="round" />
        <path
          d={diamond}
          pathLength={100}
          fill="none"
          stroke={`url(#${ringId})`}
          strokeWidth="6"
          strokeLinejoin="round"
          strokeDasharray="100"
          strokeDashoffset={100 * (1 - Math.max(0, Math.min(1, progress)))}
          style={{
            transition: "stroke-dashoffset 600ms var(--ds-ease-spring)",
            filter: "drop-shadow(0 0 6px var(--ds-glow))",
          }}
        />
      </svg>

      {/* הדיסקית היא **בועה** ולא לבנת זכוכית: עיגול הוא הצורה שבה
          החומר הזה הכי משכנע, וזה גם מה שקושר את תג השלב לשאר השפה. */}
      <span
        className={cx(
          "bubble relative flex flex-col items-center justify-center leading-none",
          // בלי צבע מוגדר - בועת המותג: מעבר מהקורל לנייבי של הלוגו
          tone ? `bubble--${tone}` : "bubble--brand",
        )}
        style={{ width: size - 14, height: size - 14 }}
      >
        <span className="text-[0.55em] font-bold opacity-75" style={{ fontSize: size * 0.14 }}>
          {label}
        </span>
        <span className="font-extrabold" style={{ fontSize: size * 0.34 }}>
          {value}
        </span>
      </span>
    </span>
  );
}

/* ==========================================================================
   הסצנות
   ========================================================================== */

export type TileScene = "peaks" | "horizon" | "arc" | "grid" | "bloom";

/**
 * האיור בראש האריח. כולן באותה פלטה ובאותו עיקרון - שכבות שיוצרות
 * אופק ועומק - ונבדלות בצורה בלבד, כך שלכל אריח יש זהות משלו בלי
 * להוסיף ולו גוון אחד חדש.
 */
function Scene({ scene }: { scene: TileScene }) {
  return (
    <svg
      viewBox="0 0 320 150"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sky-${scene}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbefeb" />
          <stop offset="100%" stopColor="#f6eee6" />
        </linearGradient>
      </defs>

      <rect width="320" height="150" fill={`url(#sky-${scene})`} />

      {scene === "peaks" && (
        <>
          <path d="M0 150 L70 62 L132 150Z" fill="#f4c7bc" opacity="0.9" />
          <path d="M96 150 L178 44 L262 150Z" fill="#c9d1dc" opacity="0.95" />
          <path d="M214 150 L286 76 L320 116 L320 150Z" fill="#e9cfae" opacity="0.9" />
          <circle cx="248" cy="40" r="17" fill="#ffffff" opacity="0.95" />
        </>
      )}

      {scene === "horizon" && (
        <>
          <circle cx="160" cy="104" r="46" fill="#f9d8cc" opacity="0.95" />
          <rect y="104" width="320" height="46" fill="#e4e9f0" />
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x="0"
              y={112 + i * 10}
              width="320"
              height="3"
              fill="#9aa8bd"
              opacity={0.65 - i * 0.12}
            />
          ))}
        </>
      )}

      {scene === "arc" && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <circle
              key={i}
              cx="160"
              cy="168"
              r={46 + i * 30}
              fill="none"
              stroke="#9aa8bd"
              strokeWidth="3"
              opacity={0.7 - i * 0.14}
            />
          ))}
          <circle cx="160" cy="168" r="30" fill="#ffffff" opacity="0.95" />
        </>
      )}

      {scene === "grid" && (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line
              key={`v${i}`}
              x1={30 + i * 52}
              y1="0"
              x2={-40 + i * 90}
              y2="150"
              stroke="#e9cfae"
              strokeWidth="2"
              opacity="0.65"
            />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <line
              key={`h${i}`}
              x1="0"
              y1={58 + i * 26}
              x2="320"
              y2={58 + i * 26}
              stroke="#e9cfae"
              strokeWidth="2"
              opacity={0.6 - i * 0.1}
            />
          ))}
        </>
      )}

      {scene === "bloom" && (
        <>
          <circle cx="160" cy="78" r="58" fill="#f4c7bc" opacity="0.8" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return (
              <line
                key={i}
                x1={160 + Math.cos(a) * 30}
                y1={78 + Math.sin(a) * 30}
                x2={160 + Math.cos(a) * 74}
                y2={78 + Math.sin(a) * 74}
                stroke="#f39b89"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.75"
              />
            );
          })}
          <circle cx="160" cy="78" r="26" fill="#ffffff" opacity="0.96" />
        </>
      )}

      {/* ערפל בתחתית הסצנה - מה שמחבר אותה לגוף האריח בלי קו חיתוך */}
      <rect y="96" width="320" height="54" fill="url(#fade)" />
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          {/* הסצנה נמוגה אל הלבן של האריח - פסטל בהיר ולא טורקיז כהה, לפי
              בקשת הלקוחה (הכחול הכהה נראה כבד על המצב הבהיר) */}
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ==========================================================================
   האריח
   ========================================================================== */

interface TileProps {
  title: ReactNode;
  icon?: IconName;
  scene?: TileScene;
  /** תג עגול בגבול הסצנה והגוף. */
  badge?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
  /**
   * אריח חלק, בלי סצנה מאוירת: התג והכותרת בראש, והטקסט מתחת. לבקשת
   * הלקוחה בשלב 5 - הסצנות (הרים, קווים, קשתות) נקראו כ"סימנים" על האריח.
   */
  plain?: boolean;
  /** כיתוב קטן בתחתית, כמו "לבחירה". */
  footer?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function GameTile({
  title,
  icon,
  scene = "peaks",
  badge,
  children,
  onClick,
  footer,
  className,
  style,
  plain = false,
}: TileProps) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cx(
        "glass glass-brick group relative flex w-full flex-col overflow-hidden rounded-2xl text-center",
        onClick && "glass-interactive glass-3d",
        className,
      )}
      style={style}
    >
      {/* אריח חלק: התג, הכותרת והטקסט כגוש אחד ממורכז באמצע האריח */}
      {plain && (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-5 py-4">
          {badge}
          <span className="text-ink-2 text-base font-extrabold tracking-tight sm:text-lg">{title}</span>
          {children}
        </div>
      )}

      {/* --- הסצנה --- */}
      {/* הסצנה היא החלק היחיד שמתכווץ (בסיס 8.5rem, מינימום 3rem): כשהאריח
          נדחס לגובה נתון - כמו ברשת של שלב 5 במסך נמוך - האיור מוותר על
          גובה, והכותרת, התג והטקסט נשארים שלמים. המינימום (5.75rem) הוא
          גובה הכותרת ועוד החלק של התג שנכנס לסצנה (`-mt-11`), כדי שהתג
          לא יעלה על הכותרת. */}
      {!plain && (
      <div className="relative min-h-[5.75rem] w-full flex-[0_1_8.5rem] overflow-hidden">
        <Scene scene={scene} />

        {/* הכותרת יושבת על הסצנה, כמו ברפרנס */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 p-3">
          {icon && <Icon name={icon} size={20} className="text-accent-pale flex-none" />}
          <span
            className="text-ink text-xl font-extrabold tracking-tight sm:text-2xl"
            style={{ textShadow: "0 1px 0 rgba(255,255,255,0.9)" }}
          >
            {title}
          </span>
        </div>
      </div>

      )}

      {/* --- התג, יושב בדיוק על הגבול --- */}
      {badge && !plain && (
        <div className="relative z-10 -mt-11 flex justify-center">{badge}</div>
      )}

      {/* --- הגוף --- */}
      {!plain && (
      <div
        className={cx(
          // במסך נמוך הריווח מתהדק, ומתחת ל-900px גם "לבחירה" יורד -
          // האריח כולו לחיץ, והכיתוב הוא רמז ולא הכרח.
          "flex flex-1 flex-col items-center justify-center gap-3 px-5 pb-5",
          "[@media(max-height:900px)]:gap-1 [@media(max-height:900px)]:pb-3",
          plain ? "pt-2" : badge ? "pt-3" : "pt-5",
        )}
      >
        {children}
        {footer && (
          <span className="text-ink-3 group-hover:text-ink-2 mt-1 text-sm font-bold transition-colors [@media(max-height:900px)]:hidden">
            {footer}
          </span>
        )}
      </div>
      )}
    </Tag>
  );
}

export default GameTile;
