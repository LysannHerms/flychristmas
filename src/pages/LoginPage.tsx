import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { hasSupabaseConfig, supabase } from "../auth/supabase";

export default function LoginPage() {
  const { status } = useAuth();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const returnTo =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? "/";

  if (status === "signedIn") {
    return <Navigate to={returnTo} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!supabase || !hasSupabaseConfig) {
      setError("Die Verbindung zu Supabase ist noch nicht eingerichtet.");
      return;
    }

    setSubmitting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError("Die E-Mail-Adresse oder das Passwort stimmt nicht.");
      }
    } catch {
      setError(
        "Die Anmeldung ist gerade nicht möglich. Bitte versuche es später erneut.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="eyebrow">DEZEMBER 2026</span>

        <div className="auth-sparkle" aria-hidden="true">
          ✦
        </div>

        <h1 id="auth-title">Dein Kalender</h1>
        <p className="auth-intro">
          Melde dich an, um die Türchen zu öffnen.
        </p>

        {!hasSupabaseConfig ? (
          <p className="auth-error" role="alert">
            Die Supabase-Verbindung fehlt. Prüfe die Werte in deiner Datei{" "}
            <code>.env.local</code> und starte Vite danach neu.
          </p>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="email">E-Mail-Adresse</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <label htmlFor="password">Passwort</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Anmeldung läuft …" : "Anmelden"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}