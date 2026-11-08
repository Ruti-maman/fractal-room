import { Link } from "react-router-dom";
import { BackgroundLayers } from "../components/ui/AppBackground";
import Icon from "../components/ui/Icon";

/**
 * עמוד 404.
 *
 * שימו לב לכתובת השורש: היא **לא** מגיעה לכאן אלא ממשיכה להפנות ל-/screen/1
 * (ראו App.tsx). זה מכוון - פלזמה בחדר עלולה להיות מוגדרת עם סימנייה
 * לכתובת הבסיס, ועדיף שתיפתח על מסך סדנה עובד מאשר על הודעת שגיאה. כאן
 * מגיעות רק כתובות שבאמת לא קיימות, ושם הודעה ברורה עדיפה על הפניה שקטה
 * שמסתירה טעות הקלדה.
 */
function NotFoundPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <BackgroundLayers />

      <div
        className="glass glass-brick glass-card relative w-full max-w-xl overflow-hidden text-center"
        style={{ animation: "glass-in var(--ds-dur-slow) var(--ds-ease) both" }}
      >

        <div className="relative flex flex-col items-center gap-5">
          <div className="glass glass-icon-btn glass-icon-btn-lg text-accent-soft">
            <Icon name="info" size={32} />
          </div>

          <div>
            <p className="text-accent-soft mb-1 text-6xl font-extrabold tabular-nums opacity-40">
              404
            </p>
            <h1 className="glass-title mb-2 text-3xl">הדף הזה לא קיים</h1>
            <p className="text-ink-2 text-lg">
              כנראה נפלה טעות בכתובת. אלה הדפים של המערכת:
            </p>
          </div>

          <nav className="grid w-full grid-cols-3 gap-3">
            {[1, 2, 3].map((n) => (
              <Link
                key={n}
                to={`/screen/${n}`}
                className="glass glass-interactive glass-3d flex flex-col items-center gap-1.5 rounded-lg p-4"
              >
                <span className="glass glass-active flex h-10 w-10 items-center justify-center diamond font-extrabold">
                  {n}
                </span>
                <span className="text-sm font-bold">מסך {n}</span>
              </Link>
            ))}
          </nav>

          <Link
            to="/admin"
            className="glass glass-interactive glass-3d glass-pill text-ink-2 gap-2 px-5 py-2.5 text-sm font-bold"
          >
            <Icon name="settings" size={16} />
            מסך הניהול
          </Link>
        </div>
      </div>
    </main>
  );
}

export default NotFoundPage;
