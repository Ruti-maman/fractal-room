import { useState } from "react";
import { Link } from "react-router-dom";
import { startNewWorkshop } from "../lib/workshopActions";
import { exportWorkshopData, type ExportFormat } from "../lib/exportWorkshop";
import { useLiteEffects } from "../hooks/useTheme";
import { setTapSoundEnabled, tapSoundEnabled } from "../lib/tapFeedback";
import { BackgroundLayers } from "../components/ui/AppBackground";
import Icon from "../components/ui/Icon";
import GlassModal from "../components/ui/GlassModal";
import { GlassButton, GlassIconButton } from "../components/ui/Glass";
import { InlineNotice } from "../components/ui/Feedback";
import { ThemeToggle } from "../components/ui/SystemControls";
import { useToast } from "../components/ui/Toast";

/**
 * מסך ניהול - עדיין לא סוכם עם הלקוחה איפה כפתור "סדנה חדשה" צריך להיות
 * בפועל (ראו שאלות פתוחות בסעיף 10). כרגע בכתובת /admin, בלי הגנת סיסמה.
 *
 * ----------------------------------------------------------------------------
 * מה נוסף כאן מעבר לעיצוב
 * ----------------------------------------------------------------------------
 * 1. **אישור בתוך המערכת** במקום `window.confirm`. הדיאלוג של הדפדפן קופץ
 *    באנגלית/בעיצוב מערכת באמצע מסך סדנה על פלזמה, ושובר את האשליה - וגם
 *    לא ניתן לנסח בו בבירור מה בדיוק נמחק.
 * 2. **קיצורי דרך לשלושת המסכים**, כדי שאפשר יהיה לפתוח אותם מכאן במקום
 *    להקליד כתובות ידנית על מסך מגע.
 * 3. **מתג "אפקטים מופחתים"** - זו השליטה החשובה ביותר בדף הזה ביום
 *    הסדנה: אם יתגלה שהפלזמה מגמגמת בגלל טשטוש הזכוכית, כיבוי כאן פותר
 *    את זה מיד, בלי מתכנתת ובלי פריסה מחדש (ראו --ds-blur ב-tokens.css).
 */
function AdminPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null);
  const { lite, setLite } = useLiteEffects();
  const [tapSound, setTapSound] = useState(tapSoundEnabled);
  const toast = useToast();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  // "סדנה חדשה" מוחקת הכול - אחרי ייצוא מוצלח מסמנים את זה, כדי שהאישור
  // יוכל להזכיר אם עוד לא יוצא כלום בביקור הזה בדף.
  const [exportedThisVisit, setExportedThisVisit] = useState(false);

  async function handleExport(format: ExportFormat) {
    setExporting(format);
    const { error, count } = await exportWorkshopData(format);
    setExporting(null);
    if (error) {
      toast(`הייצוא נכשל: ${error}`, { tone: "danger" });
      return;
    }
    setExportedThisVisit(true);
    toast(`הקובץ ירד (${count} פריטים)`, { tone: "ok" });
  }

  async function handleConfirm() {
    setWorking(true);
    try {
      const { error } = await startNewWorkshop();
      if (error) {
        setLastResult({ ok: false, message: error });
        toast("פתיחת הסדנה נכשלה", { tone: "danger" });
      } else {
        setLastResult({ ok: true, message: "סדנה חדשה נפתחה. שלושת המסכים אופסו לשלב 1." });
        toast("סדנה חדשה נפתחה", { tone: "ok" });
      }
    } catch (err) {
      setLastResult({ ok: false, message: String(err) });
      toast("פתיחת הסדנה נכשלה", { tone: "danger" });
    } finally {
      setWorking(false);
      setConfirmOpen(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <BackgroundLayers />

      <div className="absolute top-5 left-5">
        <ThemeToggle />
      </div>

      <div className="relative flex w-full max-w-2xl flex-col gap-6">
        <header
          className="flex flex-col items-center gap-3 text-center"
          style={{ animation: "fade-up var(--ds-dur-slow) var(--ds-ease) both" }}
        >
          <span className="glass glass-chip text-accent-soft gap-2">
            <Icon name="settings" size={15} />
            ניהול
          </span>
          <h1 className="glass-title text-5xl">חדר פרקטל</h1>
          <p className="text-ink-2 text-lg">הפעלת סדנה והגדרות המסכים בחדר</p>
        </header>

        {/* --- ייצוא נתונים --- לפני "סדנה חדשה", כי זה מה שעושים קודם */}
        <section
          className="glass glass-brick glass-card relative overflow-hidden"
          style={{ animation: "glass-in var(--ds-dur-slow) 60ms var(--ds-ease) both" }}
        >
          <div className="flex flex-col gap-4 text-center">
            <div className="glass glass-icon-btn glass-icon-btn-lg text-accent-soft mx-auto">
              <Icon name="download" size={30} />
            </div>
            <h2 className="text-ink text-2xl font-extrabold">ייצוא נתוני הסדנה</h2>
            <p className="text-ink-2 leading-relaxed">
              כל מה שהקבוצות הזינו: שמות, משתתפות, השראות, סימונים, מסקנות,
              פתרונות, דירוגים וקישורים להקלטות.
            </p>

            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <GlassButton
                variant="primary"
                size="lg"
                icon="download"
                onClick={() => handleExport("csv")}
                loading={exporting === "csv"}
                disabled={exporting !== null}
              >
                טבלה לאקסל
              </GlassButton>
              <GlassButton
                variant="glass"
                size="lg"
                icon="save"
                onClick={() => handleExport("json")}
                loading={exporting === "json"}
                disabled={exporting !== null}
              >
                גיבוי מלא
              </GlassButton>
            </div>
            <p className="text-ink-3 text-sm leading-relaxed">
              הטבלה נפתחת באקסל או ב-Google Sheets. הגיבוי המלא שומר את הנתונים
              הגולמיים, למקרה שיהיה צורך לשחזר או לנתח אותם.
            </p>
          </div>
        </section>

        {/* --- סדנה חדשה --- */}
        <section
          className="glass glass-brick glass-card relative overflow-hidden"
          style={{ animation: "glass-in var(--ds-dur-slow) 100ms var(--ds-ease) both" }}
        >
          <div className="flex flex-col gap-4 text-center">
            <div className="glass glass-icon-btn glass-icon-btn-lg text-accent-soft mx-auto">
              <Icon name="refresh" size={30} />
            </div>
            <h2 className="text-ink text-2xl font-extrabold">סדנה חדשה</h2>
            <p className="text-ink-2 leading-relaxed">
              איפוס שלושת המסכים לשלב 1 ויצירת שלוש קבוצות חדשות.
            </p>

            <InlineNotice tone="warn" title="שימו לב" className="text-start">
              כל הנתונים של ההפעלות הקודמות - שמות קבוצות, משתתפות, תשובות
              והקלטות - יימחקו לצמיתות ואי אפשר לשחזר אותם.
            </InlineNotice>

            <GlassButton
              variant="primary"
              size="lg"
              icon="refresh"
              onClick={() => setConfirmOpen(true)}
              loading={working}
              className="mt-2 self-center"
            >
              פתיחת סדנה חדשה
            </GlassButton>

            {lastResult && (
              <InlineNotice
                tone={lastResult.ok ? "ok" : "danger"}
                title={lastResult.ok ? "בוצע" : "לא הצלחנו"}
                className="text-start"
              >
                {lastResult.message}
              </InlineNotice>
            )}
          </div>
        </section>

        {/* --- מסכי הסדנה --- */}
        <section
          className="glass glass-brick glass-card"
          style={{ animation: "glass-in var(--ds-dur-slow) 180ms var(--ds-ease) both" }}
        >
          <h2 className="text-ink mb-1 text-center text-xl font-extrabold">מסכי הסדנה</h2>
          <p className="text-ink-3 mb-5 text-center text-sm">
            פתחו כל כתובת על הפלזמה שלה. כל מסך מתחבר לקבוצה משלו.
          </p>

          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((n) => (
              <Link
                key={n}
                to={`/screen/${n}`}
                className="glass glass-interactive glass-3d flex flex-col items-center gap-2 rounded-lg p-5 text-center"
              >
                <span className={`bubble bubble--${n} flex h-12 w-12 items-center justify-center text-xl font-extrabold`}>
                  {n}
                </span>
                <span className="text-ink text-sm font-bold">מסך {n}</span>
                <span className="text-ink-3 font-mono text-[11px]">/screen/{n}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* --- הגדרות תצוגה --- */}
        <section
          className="glass glass-brick glass-card"
          style={{ animation: "glass-in var(--ds-dur-slow) 260ms var(--ds-ease) both" }}
        >
          <h2 className="text-ink mb-5 text-center text-xl font-extrabold">תצוגה במסכים</h2>

          <div className="glass glass-dim flex items-center justify-between gap-4 rounded-lg p-4">
            <div className="flex min-w-0 items-start gap-3">
              <Icon name="info" size={22} className="text-accent-soft mt-0.5 flex-none" />
              <div className="min-w-0">
                <p className="text-ink font-bold">אפקטים מופחתים</p>
                <p className="text-ink-2 text-sm leading-relaxed">
                  מכבה את טשטוש הזכוכית בכל המערכת. להפעיל רק אם מסך בחדר
                  מגמגם או מגיב לאט.
                </p>
              </div>
            </div>

            <GlassIconButton
              icon={lite ? "check" : "close"}
              label={lite ? "כיבוי אפקטים מופחתים" : "הפעלת אפקטים מופחתים"}
              active={lite}
              onClick={() => {
                setLite(!lite);
                toast(lite ? "האפקטים המלאים חזרו" : "האפקטים הופחתו", { tone: "info" });
              }}
            />
          </div>

          <div className="glass glass-dim mt-3 flex items-center justify-between gap-4 rounded-lg p-4">
            <div className="flex min-w-0 items-start gap-3">
              <Icon name="volume" size={22} className="text-accent-soft mt-0.5 flex-none" />
              <div className="min-w-0">
                <p className="text-ink font-bold">צלילי מגע</p>
                <p className="text-ink-2 text-sm leading-relaxed">
                  טיק קצר ורך בכל לחיצה. שלוש פלזמות בחדר אחד - אם זה מרגיש
                  רועש, כבו כאן.
                </p>
              </div>
            </div>

            <GlassIconButton
              icon={tapSound ? "volume" : "volumeOff"}
              label={tapSound ? "כיבוי צלילי מגע" : "הפעלת צלילי מגע"}
              active={tapSound}
              onClick={() => {
                const next = !tapSound;
                setTapSoundEnabled(next);
                setTapSound(next);
                toast(next ? "צלילי המגע דלוקים" : "צלילי המגע כבויים", { tone: "info" });
              }}
            />
          </div>
        </section>
      </div>

      <GlassModal
        open={confirmOpen}
        tone="danger"
        title="לפתוח סדנה חדשה?"
        description={
          exportedThisVisit
            ? "שלושת המסכים יתאפסו לשלב 1, וכל הנתונים של ההפעלות הקודמות יימחקו לצמיתות."
            : "שלושת המסכים יתאפסו לשלב 1, וכל הנתונים של ההפעלות הקודמות יימחקו לצמיתות. עוד לא ייצאתן את הנתונים - אם זו הייתה סדנה אמיתית, כדאי לבטל ולייצא קודם."
        }
        confirmLabel="כן, לפתוח סדנה חדשה"
        cancelLabel="ביטול"
        onConfirm={handleConfirm}
        onClose={() => setConfirmOpen(false)}
        confirmLoading={working}
        dismissable={!working}
      />
    </main>
  );
}

export default AdminPage;
