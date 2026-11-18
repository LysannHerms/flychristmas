import type {
  CalendarAppData,
  CalendarDay,
  ContentType,
} from "../data/calendar";
import { supabase } from "../auth/supabase";

const IMAGE_BUCKET = "calendar-images";
const SIGNED_URL_DURATION = 60 * 60;

const CALENDAR_DAY_COLUMNS =
  "day, title, content_type, message, image_path, link_url, app_id, app_data";

interface CalendarDayRow {
  day: number;
  title: string;
  content_type: string;
  message: string | null;
  image_path: string | null;
  link_url: string | null;
  app_id: string | null;
  app_data: unknown;
}

function parseAppData(
  value: unknown,
): CalendarAppData | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return undefined;
  }

  const answers = (
    value as { answers?: unknown }
  ).answers;

  if (!Array.isArray(answers)) {
    return undefined;
  }

  const validAnswers = answers.filter(
    (answer): answer is string =>
      typeof answer === "string" &&
      answer.trim().length > 0,
  );

  return validAnswers.length > 0
    ? { answers: validAnswers }
    : undefined;
}

async function mapCalendarDay(
  data: CalendarDayRow,
): Promise<CalendarDay> {
  let imageUrl: string | undefined;

  if (data.image_path) {
    const imagePath =
      data.image_path.replace(/^\/+/, "");

    const {
      data: signedImage,
      error: imageError,
    } = await supabase!.storage
      .from(IMAGE_BUCKET)
      .createSignedUrl(
        imagePath,
        SIGNED_URL_DURATION,
      );

    if (imageError) {
      throw new Error(
        `Das Bild "${imagePath}" konnte nicht geladen werden: ${imageError.message}`,
      );
    }

    imageUrl = signedImage.signedUrl;
  }

  return {
    day: data.day,
    title: data.title,
    type: data.content_type as ContentType,
    message: data.message ?? "",
    image: imageUrl,
    url: data.link_url ?? undefined,
    appId: data.app_id ?? undefined,
    appData: parseAppData(data.app_data),
  };
}

export async function getCalendarDay(
  day: number,
): Promise<CalendarDay | null> {
  if (!supabase) {
    throw new Error(
      "Die Supabase-Verbindung ist nicht eingerichtet.",
    );
  }

  const { data, error } = await supabase
    .from("calendar_days")
    .select(CALENDAR_DAY_COLUMNS)
    .eq("day", day)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapCalendarDay(
    data as CalendarDayRow,
  );
}

export async function getCalendarApp(
  appId: string,
): Promise<CalendarDay | null> {
  if (!supabase) {
    throw new Error(
      "Die Supabase-Verbindung ist nicht eingerichtet.",
    );
  }

  const { data, error } = await supabase
    .from("calendar_days")
    .select(CALENDAR_DAY_COLUMNS)
    .eq("app_id", appId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapCalendarDay(
    data as CalendarDayRow,
  );
}