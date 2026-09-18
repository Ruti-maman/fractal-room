import { useEffect } from "react";
import type { Group } from "../types/group";
import type { ProgramStage } from "../types/stage";
import { startSharedStage } from "../lib/stageActions";
import WaitingScreen from "./WaitingScreen";
import PlaceholderStage from "./PlaceholderStage";
import Stage1Opening from "./stages/Stage1Opening";
import Stage2Identification from "./stages/Stage2Identification";
import Timer from "./Timer";
import ProgressBar from "./ProgressBar";
import type { Stage1Content } from "../types/stage1Content";

interface Props {
  screenNumber: number;
  myGroup: Group;
  allGroups: Group[];
  stages: ProgramStage[];
  workshopId: string;
  workshopCreatedAt: string;
  sharedStageStartedAt: string | null;
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
  onAdvance,
}: Props) {
  const stage = stages.find((s) => s.stage_number === myGroup.current_stage);

  const allArrived =
    !!stage &&
    stage.sync_gate &&
    allGroups.every((g) => g.current_stage >= stage.stage_number);

  // ברגע שכל הקבוצות הגיעו לשער סנכרון - פותחים אותו (נכתב רק פעם אחת, ראו stageActions).
  useEffect(() => {
    if (allArrived && !sharedStageStartedAt) {
      startSharedStage(workshopId);
    }
  }, [allArrived, sharedStageStartedAt, workshopId]);

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

  // שלב 2 מנהל את שער הסנכרון שלו בעצמו בתוך הרכיב (הזדהות עצמאית, מעבר רק כשכולם הזדהו) -
  // ראו הסבר ב-CLAUDE.md, לא משתמש במסך ההמתנה הגנרי.
  if (stage.stage_number !== 2 && stage.sync_gate && !allArrived) {
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
      ? sharedStageStartedAt
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
    ) : (
      <PlaceholderStage
        screenNumber={screenNumber}
        myGroup={myGroup}
        stage={stage}
        onAdvance={onAdvance}
      />
    );

  return (
    <>
      {stageContent}
      {progressBar}
      {effectiveStartedAt && stage.duration_minutes && (
        <Timer startedAt={effectiveStartedAt} durationMinutes={stage.duration_minutes} />
      )}
    </>
  );
}

export default StageRouter;
