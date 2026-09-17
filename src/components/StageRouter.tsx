import { useEffect } from "react";
import type { Group } from "../types/group";
import type { ProgramStage } from "../types/stage";
import { startSharedStage } from "../lib/stageActions";
import WaitingScreen from "./WaitingScreen";
import PlaceholderStage from "./PlaceholderStage";

interface Props {
  screenNumber: number;
  myGroup: Group;
  allGroups: Group[];
  stages: ProgramStage[];
  workshopId: string;
  sharedStageStartedAt: string | null;
  onAdvance: () => void;
}

function StageRouter({
  screenNumber,
  myGroup,
  allGroups,
  stages,
  workshopId,
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

  if (!stage) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-xl">
          אין הגדרה לשלב {myGroup.current_stage} בתוכנית הזו.
        </p>
      </main>
    );
  }

  if (stage.sync_gate && !allArrived) {
    return <WaitingScreen stageNumber={stage.stage_number} allGroups={allGroups} />;
  }

  return (
    <PlaceholderStage
      screenNumber={screenNumber}
      myGroup={myGroup}
      stage={stage}
      onAdvance={onAdvance}
    />
  );
}

export default StageRouter;
