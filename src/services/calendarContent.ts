import type { ContentType, CalendarDay } from "../data/calendar";
import { supabase } from "../auth/supabase";

const IMAGE_BUCKET = "calendar-images";
const SIGNED_URL_DURATION = 60 * 60; // eine Stunde

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

  let imageUrl: string | undefined;

  if (data.image_path) {
    const imagePath = data.image_path.replace(/^\/+/, "");

    const { data: signedImage, error: imageError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .createSignedUrl(imagePath, SIGNED_URL_DURATION);

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
  };
}