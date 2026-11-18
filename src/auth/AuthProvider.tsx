import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase } from "./supabase";

type AuthStatus = "loading" | "signedIn" | "signedOut" | "unconfigured";

interface AuthContextValue {
  status: AuthStatus;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;

      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  const status: AuthStatus = !hasSupabaseConfig
    ? "unconfigured"
    : loading
      ? "loading"
      : session
        ? "signedIn"
        : "signedOut";

  return (
    <AuthContext.Provider value={{ status, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth muss innerhalb des AuthProvider verwendet werden.");
  }

  return context;
}