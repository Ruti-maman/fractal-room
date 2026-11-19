/*
 * תצוגה מקדימה של מסך "ברוכות הבאות" (שלב 1) - בשרת הפיתוח בלבד.
 *
 * למה: מסך הפתיחה מוצג רק כשקבוצה בשלב 1, ובזמן עבודה על העיצוב שלו
 * הקבוצות כבר רחוקות משם. הכתובת הזו מציגה אותו ישירות, עם תוכן לדוגמה,
 * **בלי לגעת במסד הנתונים**: "התחילו" לא מעביר שלב ולא כותב כלום.
 *
 * רשום ב-App.tsx רק כש-import.meta.env.DEV - לא קיים באתר שעולה לאוויר.
 * כתובת: /preview/welcome (ו-?screen=2 / ?screen=3 לשאר המסכים).
 * מציג את הגרסה שנבחרה ב-OPENING_VARIANT (Stage1Opening.tsx) - בדיוק מה
 * שהמסכים בחדר יראו.
 */
import { useNavigate } from "react-router-dom";
import Stage1Opening from "../components/stages/Stage1Opening";
import type { Stage1Content } from "../types/stage1Content";

const SAMPLE: Stage1Content = {
  screens: {
    "1": { type: "logo", image_url: "/brand/fractal-logo.png" },
    "2": { type: "video", video_url: "" },
    "3": { type: "text", title: "ברוכות הבאות", body: "כאן יופיע טקסט הפתיחה של המסך השלישי." },
  },
  transition_text: "",
};

export default function WelcomePreview() {
  const navigate = useNavigate();
  const screen = Number(new URLSearchParams(window.location.search).get("screen")) || 1;
  // "התחילו" עובר לתצוגה המקדימה של ההזדהות - כך רואים את כל המעבר
  // (רשת הריבועים) בלי לגעת במסד
  return (
    <Stage1Opening screenNumber={screen} content={SAMPLE} onAdvance={() => navigate("/preview/identify")} />
  );
}
