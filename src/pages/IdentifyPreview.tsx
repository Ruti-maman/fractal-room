/*
 * תצוגה מקדימה של מסך ההזדהות (שלב 2) - בשרת הפיתוח בלבד, כמו
 * /preview/welcome. קבוצה מדומה בלי שם, כך שמוצג הטופס מהצעד הראשון.
 *
 * הדפדוף בין הצעדים מקומי לגמרי. רק "שמירה והמשך" בסיכום מנסה לכתוב
 * למסד - עם מזהה קבוצה מדומה, ולכן הכתיבה נדחית ולא משנה כלום.
 *
 * רשום ב-App.tsx רק כש-import.meta.env.DEV. כתובת: /preview/identify
 */
import Stage2Identification from "../components/stages/Stage2Identification";
import type { Group } from "../types/group";
import { BackButton } from "../components/TopBar";
import ProjectProgressBar from "../components/ProjectProgressBar";

const GROUP: Group = {
  id: "preview",
  workshop_id: "preview",
  screen_number: 1,
  name: null,
  current_stage: 2,
  stage_started_at: new Date().toISOString(),
};

export default function IdentifyPreview() {
  return (
    <>
      <Stage2Identification screenNumber={1} myGroup={GROUP} allGroups={[GROUP]} onAdvance={() => {}} />
      {/* פס ההתקדמות הכתום - כמו ב-StageRouter (שלב 2 מתוך 10) */}
      <ProjectProgressBar stageNumber={2} lastStage={10} />
      {/* כפתור "חזרה לשלב הקודם" באותו מקום ובאותה שכבה כמו ב-TopBar, כדי
          לראות אותו מעל המסך (בתצוגה המקדימה הוא לא עושה כלום) */}
      <div className="pointer-events-none fixed end-0 top-0 z-[75] flex p-4 sm:p-5">
        <div className="pointer-events-auto flex items-center gap-2">
          <BackButton onClick={() => {}} />
        </div>
      </div>
    </>
  );
}
