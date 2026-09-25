import { useState } from "react";
import type { Stage5Content, SolutionOption } from "../../types/stage5Content";
import StageShell from "../StageShell";
import Icon from "../ui/Icon";
import GlassModal from "../ui/GlassModal";
import { cx } from "../../lib/cx";

interface Props {
  content: Stage5Content;
  onAdvance: () => void;
}

/**
 * שלב 5 - גיבוש פתרונות (שקף 9 במצגת). המנגנון לא השתנה: ארבע אפשרויות,
 * לחיצה פותחת פופ-אפ - שגויה מסבירה למה ומאפשרת לנסות שוב, נכונה מסבירה
 * ומשאירה את המעבר לטיימר.
 *
 * ----------------------------------------------------------------------------
 * הכלל הפדגוגי שמכתיב את העיצוב
 * ----------------------------------------------------------------------------
 * ארבעת הכרטיסים חייבים להיראות **זהים לחלוטין**. כל רמז ויזואלי לאיזו
 * אפשרות נכונה - צבע, מיקום בולט, אייקון אחר, אפילו צל חזק יותר - הורס את
 * התרגיל. לכן ההבדל היחיד ביניהם הוא הטקסט, ואפילו אות הסימון (א/ב/ג/ד)
 * נשארת באותו משקל ויזואלי בכולם.
 *
 * מה כן השתנה: הכרטיסים סודרו ברשת גמישה שיורדת לעמודה אחת במסך צר במקום
 * רוחב קבוע של 26rem שגלש, ולכל כרטיס נוסף מספור - כדי שקבוצה תוכל לדבר
 * על "אפשרות ב'" בקול בלי להצביע על המסך.
 */

const OPTION_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו"];

function Stage5Solutions({ content }: Props) {
  const [chosen, setChosen] = useState<SolutionOption | null>(null);

  return (
    <StageShell
      stage={5}
      kicker="גיבוש פתרונות"
      icon="lightbulb"
      title="איזו דרך פתרון בוחרות?"
      subtitle="קראו את ארבע האפשרויות, דונו ביניכן, ובחרו את זו שנראית לכן הנכונה."
      botanical="sprig"
      width="wide"
      overlay={
        <GlassModal
          open={Boolean(chosen)}
          tone={chosen?.correct ? "ok" : "danger"}
          icon={chosen?.correct ? "check" : "close"}
          title={chosen?.correct ? "בדיוק כך" : "לא הפעם"}
          // כשצודקים אין כפתור: הטיימר מעביר לשלב הבא לבד (תשובת הלקוחה).
          confirmLabel={chosen?.correct ? undefined : "ננסה שוב"}
          onConfirm={() => setChosen(null)}
          onClose={chosen?.correct ? undefined : () => setChosen(null)}
          cancelLabel="סגירה"
          dismissable={!chosen?.correct}
        >
          <p className="text-ink text-2xl leading-relaxed font-bold">
            {chosen?.explanation}
          </p>
        </GlassModal>
      }
    >
      <ul className="grid w-full grid-cols-1 gap-5 md:grid-cols-2">
        {content.options.map((opt, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setChosen(opt)}
              className={cx(
                "glass glass-brick glass-interactive group flex min-h-[13rem] w-full flex-col items-center justify-center gap-5 rounded-2xl p-8 text-center",
              )}
              style={{
                animation: `glass-in var(--ds-dur-slow) ${i * 90}ms var(--ds-ease) both`,
              }}
            >
              <span
                aria-hidden="true"
                className="glass glass-dim flex h-11 w-11 flex-none items-center justify-center rounded-full text-lg font-extrabold"
              >
                {OPTION_LETTERS[i] ?? i + 1}
              </span>

              <p className="text-ink text-2xl leading-snug font-bold">{opt.label}</p>

              <span className="text-ink-3 group-hover:text-ink-2 flex items-center gap-2 text-sm font-bold transition-colors">
                לבחירה
                <Icon name="arrowNext" size={16} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </StageShell>
  );
}

export default Stage5Solutions;
