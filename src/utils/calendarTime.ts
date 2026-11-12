
export const CALENDAR_YEAR = 2026;
export const UNLOCK_HOUR = 7;
export const TIME_ZONE = "Europe/Berlin";

// TESTMODUS
// true  = Alle Gläser lassen sich öffnen
// false = Freischaltung erst am jeweiligen Dezembertag
export const DEV_MODE = true;

function berlinDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
  };
}

export function isDayUnlocked(
  day: number,
  now = new Date()
): boolean {
  if (day < 1 || day > 24) return false;

  // Im Testmodus sind alle 24 Gläser freigeschaltet.
  if (DEV_MODE) return true;

  const date = berlinDateParts(now);

  if (date.year > CALENDAR_YEAR) return true;
  if (date.year < CALENDAR_YEAR) return false;

  if (date.month < 12) return false;

  if (date.day > day) return true;
  if (date.day < day) return false;

  return date.hour >= UNLOCK_HOUR;
}

export function getUnlockMessage(day: number): string {
  return `Dieses Glas öffnet sich am ${day}. Dezember ${CALENDAR_YEAR} um 7:00 Uhr.`;
}
