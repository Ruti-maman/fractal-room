import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useScreenData } from "../hooks/useScreenData";
import { useProgramStages } from "../hooks/useProgramStages";
import { useDilemma } from "../hooks/useDilemmas";
import { applyDilemma } from "../lib/applyDilemma";
import { useKioskMode } from "../hooks/useKioskMode";
import StageRouter from "../components/StageRouter";
import RoomScreen from "../components/RoomScreen";
import { EmptyState, ErrorState, LoadingState, GlassButton } from "../components/ui";
import { startNewWorkshop } from "../lib/workshopActions";

const VALID_SCREENS = [1, 2, 3, 4];
/** המסך הרביעי - פלזמה משותפת לכל החדר, לא קבוצה (RoomScreen). */
const ROOM_SCREEN = 4;

/*
 * כניסה מקישור (2026-11-25, דרישת הלקוחה: "כשנכנסים לסדנה מתוך אחד הקישורים
 * להגיע להתחלה ולא לאמצע, אבל אם נכנסים שוב באמצע סדנה - למקום האחרון").
 * סדנה שהסתיימה (כל הקבוצות בשלב האחרון) או שאין בה פעילות כבר STALE_HOURS
 * שעות - נחשבת ישנה, ומי שנכנס מקבל בחירה: סדנה חדשה מההתחלה, או להמשיך.
 * לא פותחים סדנה חדשה לבד: "סדנה חדשה" מוחקת את הנתונים של הקודמת, ולכן זו
 * תמיד לחיצה מפורשת. סדנה פעילה ועדכנית - חוזרים בדיוק למקום, כמו קודם.
 */
const STALE_HOURS = 3;

function ScreenPage() {
  useKioskMode();
  const { screenNumber: screenNumberParam } = useParams<{
    screenNumber: string;
  }>();
  const screenNumber = Number(screenNumberParam);
  const { loading, workshop, myGroup, allGroups, advanceMyStage, goBackStage } =
    useScreenData(screenNumber);
  const { stages: programStages, loading: programStagesLoading } = useProgramStages(workshop?.program_id);
  // הדילמה שנבחרה מהספרייה ב-/admin נכנסת לתוכן של שלבים 2-4 (applyDilemma)
  const { dilemma, loading: dilemmaLoading } = useDilemma(workshop?.dilemma_id);
  const stages = useMemo(() => applyDilemma(programStages, dilemma), [programStages, dilemma]);
  const stagesLoading = programStagesLoading || dilemmaLoading;

  // השלב הקיים הבא / הקודם בתוכנית. המספרים לא בהכרח רציפים (שלב 9 הוסר),
  // ולכן לא מוסיפים/מחסירים 1 - אחרת הקבוצה נוחתת על שלב שלא קיים.
  const stageNumbers = stages.map((s) => s.stage_number).sort((a, b) => a - b);
  const current = myGroup?.current_stage ?? 0;
  const nextStage = stageNumbers.find((n) => n > current);
  const previousStage = [...stageNumbers].reverse().find((n) => n < current);

  // התאוששות: קבוצה שכבר נתקעה על שלב שלא קיים בתוכנית (למשל 9, מלפני
  // התיקון) ממשיכה לבד לשלב הקיים הבא, בלי מסך שגיאה.
  // "להמשיך מאיפה שעצרנו" - נזכר לסדנה הזו בלבד (בדפדפן הזה)
  const [resumeChosen, setResumeChosen] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("fractal-resume");
    } catch {
      return null;
    }
  });
  const [starting, setStarting] = useState(false);
  const lastStage = stageNumbers[stageNumbers.length - 1];
  const lastActivity = Math.max(
    workshop ? new Date(workshop.created_at).getTime() : 0,
    ...allGroups.map((g) => (g.stage_started_at ? new Date(g.stage_started_at).getTime() : 0)),
  );
  const finished = allGroups.length > 0 && lastStage !== undefined && allGroups.every((g) => g.current_stage >= lastStage);
  const stale = !!workshop && allGroups.length > 0 && (finished || Date.now() - lastActivity > STALE_HOURS * 3600_000);
  const askFresh = stale && screenNumber !== ROOM_SCREEN && resumeChosen !== workshop?.id;

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
        description="בסדנה יש ארבעה מסכים: שלושה לקבוצות (1-3) ומסך משותף לחדר (4)."
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

  // המסך הרביעי: לא קבוצה - מציג את כל החדר (בלי myGroup, בלי "הבא")
  if (screenNumber === ROOM_SCREEN) {
    // תוכן "room" של כל שלב (program_stages.content.room) - הטקסטים של המסך הרביעי
    const roomContent = Object.fromEntries(
      stages.map((st) => [st.stage_number, (st.content as { room?: { title?: string } } | null)?.room]),
    );
    // תוכן שלב 2 - הטיפים, "כלל הפרקטל" ו"מי בחדר" מוצגים גם במסך הגדול
    const stage2Content = stages.find((st) => st.stage_number === 2)?.content as
      | { identification?: Record<string, unknown>; room?: Record<string, unknown> }
      | null
      | undefined;
    return (
      <RoomScreen
        allGroups={allGroups}
        stageNumbers={stageNumbers}
        roomContent={roomContent}
        stage2Content={stage2Content ?? undefined}
        stage6Content={
          (stages.find((st) => st.stage_number === 6)?.content as
            | { tips_title?: string; tips?: { title: string; text: string }[]; fractal_title?: string; fractal_text?: string }
            | null
            | undefined) ?? undefined
        }
      />
    );
  }

  if (askFresh) {
    return (
      <EmptyState
        title={finished ? "הסדנה הקודמת הסתיימה" : "הסדנה הקודמת לא פעילה כבר כמה שעות"}
        description="להתחיל סדנה חדשה מההתחלה? הנתונים של הסדנה הקודמת יימחקו - אם צריך אותם, אפשר לייצא אותם קודם במסך הניהול."
        icon="hourglass"
      >
        <GlassButton
          variant="primary"
          disabled={starting}
          onClick={async () => {
            setStarting(true);
            const { error } = await startNewWorkshop();
            if (error) {
              setStarting(false);
              window.alert(error);
            }
            // שלושת המסכים עוברים לסדנה החדשה לבד (useScreenData)
          }}
        >
          {starting ? "פותחות סדנה חדשה..." : "סדנה חדשה מההתחלה"}
        </GlassButton>
        <GlassButton
          variant="glass"
          onClick={() => {
            try {
              sessionStorage.setItem("fractal-resume", workshop.id);
            } catch {
              // בלי אחסון - הבחירה תישאר רק עד הרענון
            }
            setResumeChosen(workshop.id);
          }}
        >
          להמשיך מאיפה שעצרנו
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
