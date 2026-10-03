/*
 * נקודת הכניסה היחידה לספריית הרכיבים. מסך מייבא מכאן:
 *   import { GlassCard, GlassButton, Icon } from "../ui";
 * ולא מהקבצים הפנימיים - כך אפשר לפצל/לאחד קבצים בהמשך בלי לגעת במסכים.
 */

export { default as Icon } from "./Icon";
export type { IconName } from "./Icon";

export {
  GlassSurface,
  GlassCard,
  GlassTile,
  GlassPill,
  GlassChip,
  GlassButton,
  GlassIconButton,
  GlassInput,
  Spinner,
} from "./Glass";

export { default as GlassModal } from "./GlassModal";
export { default as Botanical } from "./Botanical";
export { default as GameTile, LevelBadge } from "./GameTile";
export type { TileScene } from "./GameTile";
export { default as AppBackground, BackgroundLayers } from "./AppBackground";

export {
  Skeleton,
  StageSkeleton,
  LoadingState,
  EmptyState,
  ErrorState,
  InlineNotice,
  CardSprig,
} from "./Feedback";

export { ToastProvider, useToast } from "./Toast";
export { ThemeToggle, ConnectionBadge, useOnlineStatus } from "./SystemControls";
