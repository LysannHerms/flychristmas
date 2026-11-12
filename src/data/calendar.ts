
export type ContentType =
  | "text"
  | "song"
  | "image"
  | "game"
  | "gift"
  | "activity";

export interface CalendarDay {
  day: number;
  title: string;
  type: ContentType;
  message: string;
  url?: string;
  image?: string;
  hasNfcBonus?: boolean;
  bonusText?: string;
  bonusToken?: string;
}

export const calendarDays: CalendarDay[] = Array.from(
  { length: 24 },
  (_, index) => ({
    day: index + 1,
    title: `Gurkenglas ${index + 1}`,
    type: "text",
    message: "Hier wartet bald eine Überraschung auf dich!",
  })
);

// Beispielinhalte – später einfach ersetzen
calendarDays[0] = {
  day: 1,
  title: "Willkommen im Gurkenregal!",
  type: "text",
  message: "24 Gläser. 24 Überraschungen. Und jede Menge Gurken.",
};

calendarDays[2] = {
  day: 3,
  title: "Ein Lied für dich",
  type: "song",
  message: "Dieses Lied musste heute einfach sein.",
  url: "https://open.spotify.com/",
};

calendarDays[5] = {
  day: 6,
  title: "Die große Gurken-WM",
  type: "activity",
  message: "Heute wird die ultimative Gewürzgurke gekürt!",
  hasNfcBonus: true,
  bonusText: "Willkommen bei der offiziellen Gurken-WM!",
  bonusToken: "gurken-wm-2026",
};

calendarDays[23] = {
  day: 24,
  title: "Frohe Weihnachten!",
  type: "gift",
  message: "Das letzte Glas ist geöffnet. Frohe Weihnachten!",
};
