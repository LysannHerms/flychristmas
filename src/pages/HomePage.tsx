import AdventShelf from "../components/AdventShelf";
import { useAuth } from "../auth/AuthProvider";

export default function HomePage() {
  const { signOut } = useAuth();

  return (
    <main className="home-page">
      <button
        className="sign-out-button"
        type="button"
        onClick={() => void signOut()}
      >
        Abmelden
      </button>

      <header className="calendar-header">
        <span className="eyebrow">DEZEMBER 2026</span>

        <h1>24 kleine Überraschungen</h1>

        <p>
          Jeden Tag ein neues Türchen.
          <br />
          Ab 7 Uhr wartet hier was auf dich.
        </p>
      </header>

      <AdventShelf />

      <footer className="calendar-footer">Mit einer Prise Gurke.</footer>
    </main>
  );
}