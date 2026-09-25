import { useEffect } from "react";
import type { Group } from "../types/group";
import type { ProgramStage } from "../types/stage";
import { startSharedStage } from "../lib/stageActions";
import WaitingScreen from "./WaitingScreen";
import PlaceholderStage from "./PlaceholderStage";
import Stage1Opening from "./stages/Stage1Opening";
import Stage2Identification from "./stages/Stage2Identification";
import Stage3Associations from "./stages/Stage3Associations";
import Stage4Analysis from "./stages/Stage4Analysis";
import Stage5Solutions from "./stages/Stage5Solutions";
import Stage6Discussion from "./stages/Stage6Discussion";
import Stage7Simulation from "./stages/Stage7Simulation";
import Stage8Winner from "./stages/Stage8Winner";
import Stage10Principles from "./stages/Stage10Principles";
import Timer from "./Timer";
import ProgressBar from "./ProgressBar";
import InspirationsLadder from "./InspirationsLadder";
import PracticalConclusionBanner from "./PracticalConclusionBanner";
import type { Stage1Content } from "../types/stage1Content";
import type { Stage3Content } from "../types/stage3Content";
import type { Stage4Content } from "../types/stage4Content";
import type { Stage5Content } from "../types/stage5Content";
import type { Stage6Content } from "../types/stage6Content";

interface Props {
  screenNumber: number;
  myGroup: Group;
  allGroups: Group[];
  stages: ProgramStage[];
  workshopId: string;
  workshopCreatedAt: string;
  sharedStageStartedAt: string | null;
  sharedStageNumber: number | null;
  onAdvance: () => void;
}

function StageRouter({
  screenNumber,
  myGroup,
  allGroups,
  stages,
  workshopId,
  workshopCreatedAt,
  sharedStageStartedAt,
  sharedStageNumber,
  onAdvance,
}: Props) {
  const stage = stages.find((s) => s.stage_number === myGroup.current_stage);

  // הזמן השמור תקף רק אם הוא שייך לשלב הנוכחי - אחרת זה "ירושה" מזמן ישן
  // של שלב משותף קודם (2, 7, 8, 10 חולקים עמודה אחת ב-workshops).
  const validSharedStageStartedAt =
    stage && sharedStageNumber === stage.stage_number ? sharedStageStartedAt : null;

  const allArrived =
    !!stage &&
    stage.sync_gate &&
    allGroups.every((g) => g.current_stage >= stage.stage_number);

  // שלב 7 יוצא מהכלל: הטיימר (10 דקות) מתחיל לרוץ לכולן יחד ברגע שהראשונה
  // מתחילה להקליט, לא מחכה שכולן יגיעו (כל קבוצה מקליטה בזמן שלה, אבל השעון משותף).
  const timerShouldStart =
    stage?.stage_number === 7
      ? allGroups.some((g) => g.current_stage >= 7)
      : allArrived;

  // ברגע שהתנאי מתקיים - פותחים את השעון המשותף (נכתב רק פעם אחת לכל שלב, ראו stageActions).
  useEffect(() => {
    if (stage && timerShouldStart && !validSharedStageStartedAt) {
      startSharedStage(workshopId, stage.stage_number);
    }
  }, [stage, timerShouldStart, validSharedStageStartedAt, workshopId]);

  const progressBar = <ProgressBar allGroups={allGroups} myScreenNumber={screenNumber} />;

  if (!stage) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-xl">
          אין הגדרה לשלב {myGroup.current_stage} בתוכנית הזו.
        </p>
        {progressBar}
      </main>
    );
  }

  // שלבים 2 ו-7 מנהלים את שער הסנכרון שלהם בעצמם בתוך הרכיב (הזדהות/הקלטה
  // עצמאית, מעבר רק כשכולן סיימו) - ראו הסבר ב-CLAUDE.md, לא משתמשים במסך ההמתנה הגנרי.
  const selfManagedGate = stage.stage_number === 2 || stage.stage_number === 7;
  if (!selfManagedGate && stage.sync_gate && !allArrived) {
    return (
      <>
        <WaitingScreen stageNumber={stage.stage_number} allGroups={allGroups} />
        {progressBar}
      </>
    );
  }

  // זמן ההתחלה תלוי בסוג השלב (סעיף 5 ב-CLAUDE.md):
  // shared - נפתח לכולם יחד בשער הסנכרון; parallel (שלב 1) - מתחיל לכולם עם ההפעלה עצמה;
  // independent - כל קבוצה לפי הזמן שלה.
  const effectiveStartedAt =
    stage.stage_type === "shared"
      ? validSharedStageStartedAt
      : stage.stage_type === "parallel"
        ? workshopCreatedAt
        : myGroup.stage_started_at;

  const stageContent =
    stage.stage_number === 1 ? (
      <Stage1Opening
        screenNumber={screenNumber}
        content={stage.content as unknown as Stage1Content}
        onAdvance={onAdvance}
      />
    ) : stage.stage_number === 2 ? (
      <Stage2Identification
        screenNumber={screenNumber}
        myGroup={myGroup}
        allGroups={allGroups}
        onAdvance={onAdvance}
      />
    ) : stage.stage_number === 3 ? (
      <Stage3Associations
        workshopId={workshopId}
        myGroup={myGroup}
        content={stage.content as unknown as Stage3Content}
        onAdvance={onAdvance}
      />
    ) : stage.stage_number === 4 ? (
      <Stage4Analysis
        workshopId={workshopId}
        myGroup={myGroup}
        content={stage.content as unknown as Stage4Content}
        onAdvance={onAdvance}
      />
    ) : stage.stage_number === 5 ? (
      <Stage5Solutions
        content={stage.content as unknown as Stage5Content}
        onAdvance={onAdvance}
      />
    ) : stage.stage_number === 6 ? (
      <Stage6Discussion
        content={stage.content as unknown as Stage6Content}
        onAdvance={onAdvance}
      />
    ) : stage.stage_number === 7 ? (
      <Stage7Simulation
        workshopId={workshopId}
        myGroup={myGroup}
        allGroups={allGroups}
        onAdvance={onAdvance}
      />
    ) : stage.stage_number === 8 ? (
      <Stage8Winner
        workshopId={workshopId}
        myGroup={myGroup}
        allGroups={allGroups}
        onAdvance={onAdvance}
      />
    ) : stage.stage_number === 10 ? (
      <Stage10Principles workshopId={workshopId} myGroup={myGroup} />
    ) : (
      <PlaceholderStage
        screenNumber={screenNumber}
        myGroup={myGroup}
        stage={stage}
        onAdvance={onAdvance}
      />
    );

  // סולם ההשראות מוצג מכאן, גלובלית לכל קומפוננטות השלב (לא כפול בכל אחת
  // בנפרד) - לפי בקשת הלקוחה: משלב 4 (שקף 6) ועד סוף הסדנה. שלב 9 מוחרג כי
  // הוא לא מוצג על המסך בכלל (שאלון שממולא מאחורי הקלעים, ראו content שלו).
  const showInspirationsLadder = stage.stage_number >= 4 && stage.stage_number !== 9;

  // "מסקנה מעשית" (תמונת התפקוד שנוסחה ב-AI בשלב 4) מלווה את כל השלבים
  // הבאים - החל משלב 5 ואילך, לא בשלב 4 עצמו (שם היא מוצגת בתוך המסך
  // הפנימי של Stage4Analysis כחלק מהזרימה, לא כרצועה חוזרת).
  // לא בשלב 9 (מסך שלא מוצג), ולא בשלב 7 לפי בקשת הלקוחה - שם הרצועה
  // מתנגשת בסרגל הנגן ובכפתור ההקלטה שמתחת לתצוגה.
  // לא בשלבים 7 ו-8: שם הרצועה חוצה את סרגל הנגן ואת הפודיום.
  const showPracticalConclusion =
    stage.stage_number > 4 &&
    stage.stage_number !== 9 &&
    stage.stage_number !== 7 &&
    stage.stage_number !== 8;

  return (
    <>
      {stageContent}
      {showInspirationsLadder && <InspirationsLadder workshopId={workshopId} />}
      {showPracticalConclusion && (
        <PracticalConclusionBanner workshopId={workshopId} groupId={myGroup.id} />
      )}
      {stage.stage_number !== 1 && progressBar}
      {effectiveStartedAt && stage.duration_minutes && (
        <Timer startedAt={effectiveStartedAt} durationMinutes={stage.duration_minutes} />
      )}
    </>
  );
}

export default StageRouter;
