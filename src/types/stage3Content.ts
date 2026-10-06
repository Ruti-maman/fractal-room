export interface Stage3Content {
  dilemma_text: string;
  transition_text: string;
}

export interface InspirationItem {
  text: string;
  /**
   * הקבוצה שכתבה את ההשראה - רק היא יכולה לערוך אותה. שדה בתוך ה-JSON,
   * לא עמודה בטבלה. השראות ישנות בלי השדה הזה פתוחות לעריכה לכולן.
   */
  author?: string;
}
