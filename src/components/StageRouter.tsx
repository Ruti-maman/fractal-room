import { useEffect } from "react";
import type { Group } from "../types/group";
import type { ProgramStage } from "../types/stage";
import { startSharedStage } from "../lib/stageActions";
import { coverWithGrid, curtainBusy, revealGrid, type CurtainMode } from "../lib/gridCurtain";
import ProjectProgressBar from "./ProjectProgressBar";
import { ROOM_LOOPS } from "../lib/roomLoops";
import WaitingScreen from "./WaitingScreen";
import PlaceholderStage from "./PlaceholderStage";
import Stage1Opening from "./stages/Stage1Opening";
import Stage2Identification from "./stages/Stage2Identification";
import Stage3Associations from "./stages/Stage3Associations";
import Stage4Analysis from "./stages/Stage4Analysis";
import Stage5Solutions from "./stages/Stage5Solutions";
import Stage6Discussion from "./stages/Stage6Discussion";
import Stage7Simulation, { type Stage7Content } from "./stages/Stage7Simulation";
import Stage8Winner, { type Stage8Content } from "./stages/Stage8Winner";
import Stage10Principles from "./stages/Stage10Principles";
import Timer from "./Timer";
import ProgressBar from "./ProgressBar";
import InspirationsLadder from "./InspirationsLadder";
import { ConclusionContext } from "./PracticalConclusionBanner";
import TopBar from "./TopBar";
import StageTransition from "./StageTransition";
import { ErrorState } from "./ui";
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
  onGoBack?: () => void;
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
  onAdvance: rawAdvance,
  onGoBack,
}: Props) {
  const stage = stages.find((s) => s.stage_number === myGroup.current_stage);

  // הזמן השמור תקף רק אם הוא שייך לשלב הנוכחי - אחרת זה "ירושה" מזמן ישן
  // של שלב משותף קודם (2, 7, 8, 10 חולקים עמודה אחת ב-workshops).
  const validSharedStageStartedAt =
    stage && sharedStageNumber === stage.stage_number ? sharedStageStartedAt : null;

  /*
    בדיקה עם קבוצה אחת (בקשת המפתחת 2026-11-17): בשרת הפיתוח בלבד, קבוצה
    שבכלל לא התחילה (עדיין בשלב 1) לא נספרת בשער - כך מסך יחיד עובר את
    "ממתינים לשאר הצוותים" ורואה את השלב המשותף. באתר שבענן (הסדנה
    האמיתית) השער מחכה לכל שלוש הקבוצות, כמו תמיד.
  */
  const gateGroups = import.meta.env.DEV ? allGroups.filter((g) => g.current_stage > 1) : allGroups;
  const allArrived =
    !!stage &&
    stage.sync_gate &&
    gateGroups.every((g) => g.current_stage >= stage.stage_number);

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

  // מעבר "רשת הריבועים" מ"ברוכות הבאות" (gridCurtain.ts): בכל שלב שאינו
  // הפתיחה מבקשים גילוי - גם כשהקבוצה כבר הזדהתה ומגיעה ישר ל"מי בחדר"
  // (שם טופס ההזדהות, שמבקש גילוי בעצמו, לא עולה). בלי זה הרשת נתקעה.
  const stageNumber = stage?.stage_number;
  useEffect(() => {
    if (stageNumber && stageNumber !== 1) revealGrid();
  }, [stageNumber]);

  // data-stage על <html>: לכל שלב "סצנה" משלו (styles/stage-scenes.css) -
  // קומפוזיציה אחרת של בלוקים, צבע ורשת, כדי שהמסכים לא ייראו כתבנית אחת
  useEffect(() => {
    if (!stageNumber) return;
    document.documentElement.dataset.stage = String(stageNumber);
    return () => {
      delete document.documentElement.dataset.stage;
    };
  }, [stageNumber]);

  // מספר השלבים נלקח מהתוכנית עצמה ולא מקובע ל-10, כדי שתוכנית עם מספר
  // שלבים אחר תציג את המספר הנכון.
  // "מתוך" לפי מספר השלב האחרון בתוכנית ולא לפי כמות השורות - מספרי השלבים
  // לא בהכרח רציפים (שלב 9 הוסר), ואז "שלב 10 מתוך 9" היה נראה שבור.
  const lastStageNumber = stages.reduce((max, st) => Math.max(max, st.stage_number), 0);

  /*
    אין המשך אחרי השלב האחרון (דרישת הלקוחה): לא בכפתור ולא בטיימר. קודם
    הטיימר של שלב 10 קידם ל"שלב 11", ונפתח מסך "אין הגדרה לשלב 11".
  */
  const isLastStage = !!stage && lastStageNumber > 0 && stage.stage_number >= lastStageNumber;

  /*
    מעבר בין שלבים (2026-11-15): כל "הבא" - גם מהכפתור וגם מהטיימר - עובר
    דרך מסך מעבר מרשת הריבועים, והסוג מתחלף לפי השלב שאליו עוברים (תיבה
    שגולשת לצד / עמודות שיורדות / אלכסון), כדי שהמעברים לא יחזרו על עצמם.
    המסך מתחלף רק כשהוא מכוסה; השלב החדש מבקש גילוי (revealGrid למעלה).
    אם כבר יש מעבר באוויר (שלב 1 פותח את שלו בעצמו) - מתקדמים מיד.
  */
  const nextStageNumber = stage
    ? stages
        .map((s) => s.stage_number)
        .sort((a, b) => a - b)
        .find((x) => x > stage.stage_number)
    : undefined;
  const advanceWithCurtain = () => {
    if (!stage || nextStageNumber === undefined || curtainBusy()) return rawAdvance();
    const modes: CurtainMode[] = ["slide", "columns", "diagonal"];
    const wait = coverWithGrid({
      from: String(stage.stage_number).padStart(2, "0"),
      to: String(nextStageNumber).padStart(2, "0"),
      label: "שלב",
      mode: modes[nextStageNumber % 3],
      stay: false,
    });
    if (wait < 0) rawAdvance();
    else window.setTimeout(rawAdvance, wait);
  };
  const onAdvance = isLastStage ? () => {} : advanceWithCurtain;
  const progressBar = (
    <ProgressBar
      allGroups={allGroups}
      myScreenNumber={screenNumber}
      totalStages={lastStageNumber}
    />
  );

  if (!stage) {
    return (
      <>
        <ErrorState
          title={`אין הגדרה לשלב ${myGroup.current_stage}`}
          description="התוכנית הפעילה לא כוללת את השלב הזה. אפשר לחזור לשלב הקודם, או לפתוח סדנה חדשה במסך הניהול."
          detail={`stage_number=${myGroup.current_stage}, program stages: ${stages
            .map((s) => s.stage_number)
            .join(", ")}`}
        />
        <TopBar myGroup={myGroup} screenNumber={screenNumber} onGoBack={onGoBack} />
        {progressBar}
      </>
    );
  }

  // הטיימר וכפתור החזרה מוגדרים כאן, לפני ההחזרות המוקדמות, כדי שיופיעו
  // **בכל** מסך - כולל מסך ההמתנה בשער סנכרון.
  const stageStartedAt =
    stage.stage_type === "shared"
      ? validSharedStageStartedAt
      : stage.stage_type === "parallel"
        ? // שלב 1: מעדיפים את זמן ההתחלה של הקבוצה עצמה. workshopCreatedAt
          // הוא רק גיבוי - הפעלה שנוצרה לפני שעות הייתה מתחילה עם טיימר שפג.
          (myGroup.stage_started_at ?? workshopCreatedAt)
        : myGroup.stage_started_at;

  // במסך הפתיחה (שלב 1) לא מציגים טיימר ולא מד התקדמות - לפי בקשת הלקוחה.
  // הטיימר עצמו כן רץ ברקע, כי הוא זה שמעביר לשלב הבא.
  const isOpeningScreen = stage.stage_number === 1;

  const waitingTimer =
    stageStartedAt && stage.duration_minutes ? (
      <Timer
        startedAt={stageStartedAt}
        durationMinutes={stage.duration_minutes}
        onTimeUp={onAdvance}
        hidden={isOpeningScreen}
      />
    ) : null;

  // כפתור החזרה מוצג מתוך הסרגל העליון (ראו BackButton), ולכן כאן רק
  // מחליטים אם הוא רלוונטי בכלל.
  const canGoBack = myGroup.current_stage > 1 && Boolean(onGoBack);

  // "חומר עזר לשלב N: ..." - הלופים של השלב במסך הגדול (מרכז ההעשרה והידע)
  const resourceTitles = Object.entries(ROOM_LOOPS)
    .filter(([key]) => parseInt(key, 10) === stage.stage_number)
    .map(([, loop]) => loop.title);
  const resourceLine =
    resourceTitles.length > 0 ? `חומר עזר לשלב ${stage.stage_number}: ${resourceTitles.join(" / ")}` : undefined;

  // שלבים 2 ו-7 מנהלים את שער הסנכרון שלהם בעצמם בתוך הרכיב (הזדהות/הקלטה
  // עצמאית, מעבר רק כשכולן סיימו) - ראו הסבר ב-CLAUDE.md, לא משתמשים במסך ההמתנה הגנרי.
  const selfManagedGate = stage.stage_number === 2 || stage.stage_number === 7;
  if (!selfManagedGate && stage.sync_gate && !allArrived) {
    return (
      <>
        <WaitingScreen stageNumber={stage.stage_number} allGroups={allGroups} workshopId={workshopId} />
        <ProjectProgressBar stageNumber={stage.stage_number} lastStage={lastStageNumber} />
        <TopBar
          myGroup={myGroup}
          screenNumber={screenNumber}
          onGoBack={canGoBack ? onGoBack : undefined}
          resourceLine={resourceLine}
        />
        {progressBar}
        {/* השעון המשותף מתחיל רק כשכולן מגיעות - עד אז הטיימר מוצג מלא
            ועוצר ("מתחיל כשכולן יגיעו"), כדי שהפינה לא תהיה ריקה */}
        {waitingTimer ??
          (stage.duration_minutes ? (
            <Timer startedAt={new Date().toISOString()} durationMinutes={stage.duration_minutes} pending />
          ) : null)}
      </>
    );
  }

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
        content={stage.content as { dilemma_video_url?: string; dilemma_title?: string; dilemma_text?: string }}
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
        workshopId={workshopId}
        myGroup={myGroup}
        content={stage.content as unknown as Stage6Content}
        onAdvance={onAdvance}
      />
    ) : stage.stage_number === 7 ? (
      <Stage7Simulation
        workshopId={workshopId}
        myGroup={myGroup}
        allGroups={allGroups}
        content={stage.content as unknown as Stage7Content}
        onAdvance={onAdvance}
      />
    ) : stage.stage_number === 8 || stage.stage_number === 9 ? (
      // שלב 8 - טקסט המסר; שלב 9 - הכרזת המנצחת וטקסט הסיום (לבקשת הלקוחה)
      <Stage8Winner
        key={stage.stage_number}
        workshopId={workshopId}
        myGroup={myGroup}
        allGroups={allGroups}
        content={stage.content as unknown as Stage8Content}
        onAdvance={onAdvance}
        part={stage.stage_number === 9 ? "winner" : "reflection"}
        stageNumber={stage.stage_number}
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
  // בנפרד) - לפי בקשת הלקוחה: משלב 4 (שקף 6) ועד סוף הסדנה, כולל שלב 9
  // (הכרזת המנצחת - קודם שלב 9 היה שאלון נסתר, והוחרג מכאן).
  // 2026-11-16 (סוכם עם המפתחת): מהשעון חול של שלב 6 והלאה - בלי הסולם.
  // בשלב 6 עצמו השעון מסתיר אותו (data-hourglass), ומשלב 7 הוא לא מוצג.
  const showInspirationsLadder = stage.stage_number >= 4 && stage.stage_number <= 6;

  // "מסקנה מעשית" (תמונת התפקוד שנוסחה ב-AI בשלב 4) מלווה את כל השלבים
  // הבאים - החל משלב 5 ואילך, לא בשלב 4 עצמו (שם היא מוצגת בתוך המסך
  // הפנימי של Stage4Analysis כחלק מהזרימה, לא כרצועה חוזרת).
  // לא בשלב 9 (מסך שלא מוצג), ולא בשלב 7 לפי בקשת הלקוחה - שם הרצועה
  // מתנגשת בסרגל הנגן ובכפתור ההקלטה שמתחת לתצוגה.
  // מלווה את כל השלבים משלב 5 ואילך, כולל 7, 8 ו-10 - לפי בקשת הלקוחה
  // שהמסקנה תהיה צמודה עד הסוף. הרצועה עצמה קומפקטית ויושבת בקצה העליון,
  // כדי שלא תחצה את סרגל הנגן בשלב 7 ואת הפודיום בשלב 8.
  const showPracticalConclusion = stage.stage_number > 4;

  return (
    <>
      <ConclusionContext.Provider
        value={{ workshopId, groupId: myGroup.id, show: showPracticalConclusion }}
      >
        <StageTransition stageKey={stage.stage_number}>{stageContent}</StageTransition>
      </ConclusionContext.Provider>
      {/* פס התקדמות כתום דק בראש המסך, בכל השלבים (בקשת הלקוחה 2026-11-14) */}
      <ProjectProgressBar stageNumber={stage.stage_number} lastStage={lastStageNumber} />
      {showInspirationsLadder && <InspirationsLadder workshopId={workshopId} />}
      {/* הסרגל העליון מושהה במסך הפתיחה (שלב 1) יחד עם המד והטיימר: לפני
          ההזדהות לקבוצה עוד אין שם להציג, ואין לאן לחזור. */}
      {isOpeningScreen ? null : (
        <TopBar
          myGroup={myGroup}
          screenNumber={screenNumber}
          onGoBack={canGoBack ? onGoBack : undefined}
          resourceLine={resourceLine}
        />
      )}
      {isOpeningScreen ? null : progressBar}
      {waitingTimer}
    </>
  );
}

export default StageRouter;
