/**
 * תפאורת הסצנה של שלב (2026-11-15): בלוקי צבע, נקודה אדומה, מספר ענק וחץ -
 * מוסתרים כברירת מחדל, וכל שלב מדליק וממקם את מה שהוא צריך לפי data-stage
 * (styles/stage-scenes.css). רק קישוט, מאחורי התוכן.
 *
 * יושב ב-StageShell, וגם במסכים שבונים <main> משלהם (שלבים 7, 8-9).
 */
function SceneSet({ stage }: { stage?: number }) {
  return (
    <>
    {/* מספר השלב + ריבוע אדום, בפינה השמאלית העליונה של כל עמוד (בקשת
        המפתחת 2026-11-15: "בצד שמאל, לכל העמודים") - במקום באמצע הכותרת */}
    {stage ? (
      <span className="sh-index sh-index--side" aria-hidden="true">
        <span className="sh-index__square" />
        <span className="sh-index__num">{String(stage).padStart(2, "0")}</span>
      </span>
    ) : null}
    <div className="sc-set" aria-hidden="true">
      <span className="sc-block sc-block--a" />
      <span className="sc-block sc-block--b" />
      <span className="sc-dot" />
      {/* "קונפטי" של ריבועים קטנים - רק בשלב 9 (stage-scenes.css, 2026-11-16) */}
      {Array.from({ length: 10 }, (_, i) => (
        <span key={`cube-${i}`} className={`sc-cube sc-cube--${i + 1}`} />
      ))}
      {/* מסך ההמתנה (2026-11-16): עמודות הרשת "מתמלאות" ומתרוקנות לאט בקצב
          שונה, כמו חדר שמתמלא - מוצג רק כש-html[data-waiting] */}
      <span className="sc-wait">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="sc-wait__col" style={{ ["--i" as string]: i }} />
        ))}
      </span>
      <span className="sc-num">{stage ? String(stage).padStart(2, "0") : ""}</span>
      <svg className="sc-arrow" viewBox="0 0 24 24">
        <path
          d="M19 5 L5 19 M5 8 L5 19 L16 19"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="square"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
    </>
  );
}

export default SceneSet;
