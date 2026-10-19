import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useScreenData } from "../hooks/useScreenData";
import { useProgramStages } from "../hooks/useProgramStages";
import { useKioskMode } from "../hooks/useKioskMode";
import StageRouter from "../components/StageRouter";
import { EmptyState, ErrorState, LoadingState, GlassButton } from "../components/ui";

const VALID_SCREENS = [1, 2, 3];

function ScreenPage() {
  useKioskMode();
  const { screenNumber: screenNumberParam } = useParams<{
    screenNumber: string;
  }>();
  const screenNumber = Number(screenNumberParam);
  const { loading, workshop, myGroup, allGroups, advanceMyStage, goBackStage } =
    useScreenData(screenNumber);
  const { stages, loading: stagesLoading } = useProgramStages(workshop?.program_id);

  // השלב הקיים הבא / הקודם בתוכנית. המספרים לא בהכרח רציפים (שלב 9 הוסר),
  // ולכן לא מוסיפים/מחסירים 1 - אחרת הקבוצה נוחתת על שלב שלא קיים.
  const stageNumbers = stages.map((s) => s.stage_number).sort((a, b) => a - b);
  const current = myGroup?.current_stage ?? 0;
  const nextStage = stageNumbers.find((n) => n > current);
  const previousStage = [...stageNumbers].reverse().find((n) => n < current);

  // התאוששות: קבוצה שכבר נתקעה על שלב שלא קיים בתוכנית (למשל 9, מלפני
  // התיקון) ממשיכה לבד לשלב הקיים הבא, בלי מסך שגיאה.
  const stuckOnMissingStage =
    !stagesLoading && !!myGroup && stageNumbers.length > 0 && !stageNumbers.includes(current) && nextStage !== undefined;
  useEffect(() => {
    if (stuckOnMissingStage && nextStage !== undefined) advanceMyStage(nextStage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stuckOnMissingStage, nextStage]);

  // כתובת כמו /screen/7 או /screen/abc - עדיף מסך שמסביר מה לעשות על פני
  // ניסיון להתחבר לקבוצה שלא קיימת ואז "אין הפעלה פעילה" מבלבל.
  if (!VALID_SCREENS.includes(screenNumber)) {
    return (
      <ErrorState
        title="כתובת מסך לא תקינה"
        description="בסדנה יש שלושה מסכים. פתחו את אחת מהכתובות הבאות במסך הזה."
        detail={`הכתובת שהתקבלה: /screen/${screenNumberParam}`}
      />
    );
  }

  if (loading || stagesLoading) {
    return <LoadingState title="מתחבר..." description="טוען..." />;
  }

  // אין הפעלה פעילה במסד - זה המצב הרגיל לפני שנפתחה סדנה, לא תקלה.
  if (!workshop) {
    return (
      <EmptyState
        title="אין סדנה פעילה"
        description="כדי להתחיל, פתחו סדנה חדשה במסך הניהול. שלושת המסכים יתאפסו ויתחילו משלב 1."
        icon="hourglass"
      >
        <GlassButton
          variant="primary"
          icon="settings"
          onClick={() => {
            window.location.href = "/admin";
          }}
        >
          למסך הניהול
        </GlassButton>
      </EmptyState>
    );
  }

  // יש הפעלה, אבל אין קבוצה שמשויכת למסך הזה - כאן זו כן תקלת נתונים.
  if (!myGroup) {
    return (
      <ErrorState
        title={`לא נמצאה קבוצה למסך ${screenNumber}`}
        description="הסדנה פעילה, אבל אין קבוצה שמשויכת למסך הזה. פתיחת סדנה חדשה במסך הניהול תיצור מחדש את שלוש הקבוצות."
        retryLabel="לרענן את המסך"
        onRetry={() => window.location.reload()}
      />
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
      onAdvance={() => advanceMyStage(nextStage)}
      onGoBack={() => goBackStage(previousStage)}
    />
  );
}

export default ScreenPage;
