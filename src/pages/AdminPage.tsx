import { useState } from "react";
import { startNewWorkshop } from "../lib/workshopActions";

/**
 * מסך ניהול זמני ופשוט - עדיין לא סוכם עם הלקוחה איפה כפתור "סדנה חדשה" צריך
 * להיות בפועל (ראו שאלות פתוחות בסעיף 10). כרגע בכתובת /admin, בלי הגנת סיסמה.
 */
function AdminPage() {
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleClick() {
    const confirmed = window.confirm(
      "לפתוח סדנה חדשה? כל שלושת המסכים יתאפסו לשלב 1. הנתונים של ההפעלה הנוכחית יישמרו.",
    );
    if (!confirmed) return;

    setStatus("working");
    try {
      const { error } = await startNewWorkshop();
      console.log("[AdminPage] startNewWorkshop result:", error);
      if (error) {
        setStatus("error");
        setMessage(error);
      } else {
        setStatus("done");
        setMessage("סדנה חדשה נפתחה. שלושת המסכים אופסו לשלב 1.");
      }
    } catch (err) {
      console.error("[AdminPage] startNewWorkshop threw:", err);
      setStatus("error");
      setMessage(String(err));
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-bold">ניהול - חדר פרקטל</h1>
      <button
        className="bg-accent-red rounded-xl px-8 py-4 text-xl font-bold active:scale-90"
        onClick={handleClick}
        disabled={status === "working"}
      >
        {status === "working" ? "פותחת..." : "סדנה חדשה"}
      </button>
      {message && (
        <p className={status === "error" ? "text-accent-red" : "text-white"}>{message}</p>
      )}
    </main>
  );
}

export default AdminPage;
