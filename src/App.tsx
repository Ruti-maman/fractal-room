import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

type ConnectionStatus = "checking" | "connected" | "error";

function App() {
  const [status, setStatus] = useState<ConnectionStatus>("checking");

  useEffect(() => {
    supabase
      .from("programs")
      .select("id")
      .limit(1)
      .then(({ error }) => {
        // שגיאת "relation does not exist" תקינה בשלב הזה - הטבלה עוד לא נוצרה.
        // מה שחשוב הוא שהתקבלה תגובה מהשרת, לא שגיאת רשת.
        setStatus(error && error.code !== "42P01" ? "error" : "connected");
      });
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold">חדר פרקטל</h1>
      <p className="text-smoke-blue-dark rounded-lg bg-white/10 px-4 py-2">
        סטטוס חיבור ל-Supabase:{" "}
        {status === "checking" && "בודקת..."}
        {status === "connected" && "✅ מחובר"}
        {status === "error" && "❌ שגיאה"}
      </p>
    </main>
  );
}

export default App;
