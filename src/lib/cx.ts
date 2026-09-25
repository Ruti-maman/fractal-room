/**
 * צירוף שמות מחלקות מותנה. מחליף ספרייה חיצונית (clsx/classnames) בשש
 * שורות - אילוץ הסינון אומר שכל תלות חיצונית צריכה הצדקה, ולזה אין.
 *
 * ערכי false/null/undefined נופלים, כך שאפשר לכתוב:
 *   cx("glass", isActive && "glass-active", className)
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
