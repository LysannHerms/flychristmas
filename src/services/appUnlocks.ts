import { supabase } from "../auth/supabase";

export async function hasAppUnlock(
  appId: string,
): Promise<boolean> {
  if (!supabase) {
    throw new Error(
      "Die Supabase-Verbindung ist nicht eingerichtet.",
    );
  }

  const { data, error } = await supabase.rpc(
    "has_app_unlock",
    {
      p_app_id: appId,
    },
  );

  if (error) throw error;

  return data === true;
}

export async function redeemAppUnlock(
  appId: string,
  code: string,
): Promise<boolean> {
  if (!supabase) {
    throw new Error(
      "Die Supabase-Verbindung ist nicht eingerichtet.",
    );
  }

  const { data, error } = await supabase.rpc(
    "unlock_app",
    {
      p_app_id: appId,
      p_code: code.trim(),
    },
  );

  if (error) throw error;

  return data === true;
}