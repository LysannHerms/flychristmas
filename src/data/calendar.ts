export type ContentType =
  | "text"
  | "song"
  | "image"
  | "game"
  | "gift"
  | "activity"
  | "app";

export interface CalendarAppData {
  answers?: string[];
}

export interface CalendarDay {
  day: number;
  title: string;
  type: ContentType;
  message: string;
  url?: string;
  image?: string;
  appId?: string;
  appData?: CalendarAppData;
  hasNfcBonus?: boolean;
  bonusText?: string;
  bonusToken?: string;
}