import { Navigate, Route, Routes } from "react-router-dom";
import ScreenPage from "./pages/ScreenPage";
import AdminPage from "./pages/AdminPage";
import NotFoundPage from "./pages/NotFoundPage";

function App() {
  return (
    <Routes>
      {/* כתובת הבסיס ממשיכה להפנות למסך 1 ולא ל-404: פלזמה בחדר עלולה
          להיות מוגדרת עם סימנייה לכתובת הבסיס, ועדיף שתיפתח על מסך סדנה
          עובד מאשר על הודעת שגיאה. */}
      <Route path="/" element={<Navigate to="/screen/1" replace />} />
      <Route path="/screen/:screenNumber" element={<ScreenPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
