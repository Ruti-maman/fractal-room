import type { Group } from "../../types/group";
import { useClosingPrinciple } from "../../hooks/useClosingPrinciple";
import StageShell from "../StageShell";
import Icon from "../ui/Icon";
import { Spinner } from "../ui/Glass";
import { InlineNotice } from "../ui/Feedback";

interface Props {
  workshopId: string;
  myGroup: Group;
}

/**
 * שלב 10 - משפט הסיום של הסדנה (שקף 15 במצגת: "מתוך כל הידע שנצבר ע"י AI
 * בסדנא"). ה-AI מנסח **משפט אחד** מתוך כל מה שהקבוצות יצרו לאורך הסדנה,
 * והוא מוצג זהה בשלושת המסכים - זה הרגע האחרון של האירוע.
 *
 * הניסוח עצמו נעשה ב-Edge Function (supabase/functions/generate-closing-principle)
 * ונשמר במסד, ולכן הוא נוצר פעם אחת ולא משתנה בין המסכים או ברענון.
 *
 * ----------------------------------------------------------------------------
 * העיצוב: לוח זכוכית שעליו חרוט המשפט
 * ----------------------------------------------------------------------------
 * זה המסך היחיד בסדנה שאין בו מה לעשות, ולכן הוא היחיד שמותר לו להיות
 * שקט לגמרי - אין כפתור, אין טיימר שרודף, אין מה למלא. המשפט מופיע לאט
 * (כניסה של שנייה וחצי) על לבנה אחת גדולה, עם ענפים בוטניים בשני הקצוות
 * שסוגרים את האירוע. ההמתנה לניסוח מנוסחת כ"כותבת" ולא כ"טוענת", כי זה
 * באמת מה שקורה שם.
 */
function Stage10Principles({ workshopId, myGroup }: Props) {
  const { sentence, loading, error } = useClosingPrinciple(workshopId, myGroup.id);

  return (
    <StageShell
      stage={10}
      kicker="סיום התהליך"
      icon="sparkles"
      title="העיקרון שעולה מהסדנה שלכן"
      background="night"
      width="wide"
    >
      {loading && (
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div
              className="bg-glow-soft absolute inset-0 rounded-full blur-xl"
              style={{ animation: "soft-pulse 2.4s ease-in-out infinite" }}
            />
            <Spinner size={60} className="relative" />
          </div>
          <p className="text-ink-2 text-lg">
            מנסחת את משפט הסיום מתוך כל מה שיצרתן...
          </p>
        </div>
      )}

      {!loading && error && (
        <InlineNotice tone="warn" title="לא הצלחנו לנסח את משפט הסיום">
          {error}
        </InlineNotice>
      )}

      {!loading && sentence && (
        <figure
          className="glass glass-brick relative w-full overflow-hidden rounded-2xl px-8 py-14 text-center sm:px-16"
          style={{ animation: "glass-in 1.4s 200ms var(--ds-ease) both" }}
        >

          <Icon
            name="sparkles"
            size={30}
            className="text-accent-soft mx-auto mb-8 opacity-70"
          />

          <blockquote className="relative">
            <p className="text-ink text-3xl leading-[1.65] font-bold sm:text-4xl">
              {sentence}
            </p>
          </blockquote>

          <span
            aria-hidden="true"
            className="via-accent relative mx-auto mt-10 block h-px w-40 bg-linear-to-l from-transparent to-transparent opacity-60"
          />
        </figure>
      )}

      {!loading && (
        <p
          className="text-ink-3 mt-8 text-sm font-bold"
          style={{ animation: "fade-up 1s 1.2s var(--ds-ease) both" }}
        >
          סיום התהליך · כלל הנתונים נשמרים במערכת
        </p>
      )}
    </StageShell>
  );
}

export default Stage10Principles;
