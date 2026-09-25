import { useParams } from "react-router-dom";
import { useScreenData } from "../hooks/useScreenData";
import { useProgramStages } from "../hooks/useProgramStages";
import { useKioskMode } from "../hooks/useKioskMode";
import StageRouter from "../components/StageRouter";

function ScreenPage() {
  useKioskMode();
  const { screenNumber: screenNumberParam } = useParams<{
    screenNumber: string;
  }>();
  const screenNumber = Number(screenNumberParam);
  const { loading, workshop, myGroup, allGroups, advanceMyStage, goBackStage } =
    useScreenData(screenNumber);
  const { stages, loading: stagesLoading } = useProgramStages(workshop?.program_id);

  if (loading || stagesLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-xl">טוענת...</p>
      </main>
    );
  }

  if (!workshop || !myGroup) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-xl">
          אין הפעלה פעילה כרגע, או שלא נמצאה קבוצה למסך {screenNumber}.
        </p>
      </main>
    );
  }

  return (
    <StageRouter
      screenNumber={screenNumber}
      myGroup={myGroup}
      allGroups={allGroups}
      stages={stages}
      workshopId={workshop.id}
      workshopCreatedAt={workshop.created_at}
      sharedStageStartedAt={workshop.shared_stage_started_at}
      sharedStageNumber={workshop.shared_stage_number}
      onAdvance={advanceMyStage}
      onGoBack={goBackStage}
    />
  );
}

export default ScreenPage;
