import { useTopInspirations } from "../hooks/useTopInspirations";
import Icon from "./ui/Icon";
import MarqueeText from "./MarqueeText";

interface Props {
  workshopId: string;
}

/**
 * "סולם ההשראות" - ההשראות שנבחרו בשלב 3, מוצגות מהשלב החשוב ביותר כלפי
 * מטה. מוזרק גלובלית מ-StageRouter לכל השלבים משלב 4 (שקף 6) ואילך, לפי
 * בקשת הלקוחה - לא רק בתוך שלב 4 עצמו. אם עדיין לא נבחרה אף השראה, לא
 * מוצג כלום.
 *
 * ----------------------------------------------------------------------------
 * מה השתנה בעיצוב, ולמה
 * ----------------------------------------------------------------------------
 * הגרסה הקודמת ציירה סולם עץ ממשי (שני מוטות + שלבים) מוטה ב-3 מעלות,
 * עם המילים מרחפות מעליו וצל טקסט שיחזיק אותן קריאות מול כל רקע. זה עבד,
 * אבל היה האובייקט היחיד בסדנה שלא היה עשוי מאותו חומר כמו כל השאר - וגם
 * הסיבוב וגודל האותיות הקבוע היו נשברים על מסך צר.
 *
 * כאן הסולם הוא רכיב זכוכית ככל השאר: מסילה אנכית צרה בקצה המסך, שכל שלב
 * בה הוא לבנה קטנה. ההיררכיה נשמרת - הראשונה מוארת (glass-active) והשאר
 * שקופות ומתעמעמות כלפי מטה, כך שסדר החשיבות עדיין נקרא במבט אחד.
 *
 * המסילה `pointer-events-none`: היא תצוגה בלבד, ואסור שתחסום נגיעה על
 * הקנבס של שלב 4 שנמצא מתחתיה.
 */
function InspirationsLadder({ workshopId }: Props) {
  const { items, loading } = useTopInspirations(workshopId);

  if (loading || items.length === 0) return null;

  /*
    **כל השראה נקראת בשלמותה, בכל אורך, בגודל כתב קבוע** (דרישת הלקוחה):
    השראה ארוכה מהשורה זזה לאט הלוך וחזור (MarqueeText) - בלי "..." ובלי
    להקטין את הכתב, והסולם נשאר באותו גובה.
  */
  return (
    <aside
      aria-label="סולם ההשראות שנבחרו"
      className="glass glass-brick glass-raised pointer-events-none fixed top-24 left-4 z-20 hidden w-[11.5rem] flex-col gap-2 rounded-xl p-3 lg:flex"
      style={{ animation: "fade-up var(--ds-dur-slow) var(--ds-ease) both" }}
    >
      <div className="text-ink-3 flex items-center gap-1.5 px-1 text-[11px] font-bold tracking-wide">
        <Icon name="ladder" size={14} />
        סולם ההשראות
      </div>

      <ol className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li
            key={item.text}
            // כל השורות באותו חומר: המקום הראשון היה "דלוק" (glass-active),
            // וזה נקרא כאילו הוא נבחר או מסומן. הסדר עצמו - המספר והעמעום
            // ההדרגתי - כבר אומר מי ראשונה.
            className="glass glass-dim glass-raised flex items-center gap-2 rounded-sm px-2.5 py-2"
            style={{
              // כל שלב נמוך יותר מעט יותר עמום - הסדר עצמו הוא המידע
              opacity: i === 0 ? 1 : Math.max(0.5, 1 - i * 0.14),
              animation: `fade-up var(--ds-dur-slow) ${i * 70}ms var(--ds-ease) both`,
            }}
          >
            <span
              aria-hidden="true"
              className={`bubble bubble--${(i % 5) + 1} flex h-7 w-7 flex-none items-center justify-center text-[11px] font-extrabold`}
            >
              {i + 1}
            </span>
            <MarqueeText text={item.text} className="flex-1 text-[13px] font-bold" />
          </li>
        ))}
      </ol>
    </aside>
  );
}

export default InspirationsLadder;
