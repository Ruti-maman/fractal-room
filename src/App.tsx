import { Navigate, Route, Routes } from "react-router-dom";
import ScreenPage from "./pages/ScreenPage";
import AdminPage from "./pages/AdminPage";
import NotFoundPage from "./pages/NotFoundPage";
import WelcomePreview from "./pages/WelcomePreview";
import IdentifyPreview from "./pages/IdentifyPreview";
import TouchGlow from "./components/TouchGlow";
import StagePreview from "./pages/StagePreview";
import HourglassPreview from "./pages/HourglassPreview";

function App() {
  return (
    <>
    {/* זוהר עגול מתחת לאצבע בכל נגיעה, בכל המסכים (2026-11-14) */}
    <TouchGlow />
    <Routes>
      {/* כתובת הבסיס ממשיכה להפנות למסך 1 ולא ל-404: פלזמה בחדר עלולה
          להיות מוגדרת עם סימנייה לכתובת הבסיס, ועדיף שתיפתח על מסך סדנה
          עובד מאשר על הודעת שגיאה. */}
      <Route path="/" element={<Navigate to="/screen/1" replace />} />
      <Route path="/screen/:screenNumber" element={<ScreenPage />} />
      <Route path="/admin" element={<AdminPage />} />
      {/* תצוגה מקדימה של מסך הפתיחה, בלי מסד נתונים - בשרת הפיתוח בלבד */}
      {import.meta.env.DEV && <Route path="/preview/welcome" element={<WelcomePreview />} />}
      {import.meta.env.DEV && <Route path="/preview/identify" element={<IdentifyPreview />} />}
      {import.meta.env.DEV && <Route path="/preview/stage" element={<StagePreview />} />}
      {import.meta.env.DEV && <Route path="/preview/hourglass" element={<HourglassPreview />} />}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </>
  );
}

export default App;
