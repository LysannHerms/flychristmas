import type { ContentType, CalendarDay } from "../data/calendar";
import { supabase } from "../auth/supabase";

export async function getCalendarDay(
  day: number,
): Promise<CalendarDay | null> {
  if (!supabase) {
    throw new Error("Die Supabase-Verbindung ist nicht eingerichtet.");
  }

  const { data, error } = await supabase
    .from("calendar_days")
    .select("day, title, content_type, message, image_path, link_url")
    .eq("day", day)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    day: data.day,
    title: data.title,
    type: data.content_type as ContentType,
    message: data.message ?? "",
    image: data.image_path ?? undefined,
    url: data.link_url ?? undefined,
  };
}