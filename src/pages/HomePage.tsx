
import AdventShelf from "../components/AdventShelf";

export default function HomePage() {
  return (
    <main className="home-page">
      <header className="calendar-header">
        <span className="eyebrow">ADVENT 2026</span>

        <h1>Das Gurkenregal</h1>

        <p>
          24 Gläser voller kleiner Überraschungen.
          <br />
          Jeden Morgen um sieben öffnet sich ein neues.
        </p>
      </header>

      <AdventShelf />

      <footer className="calendar-footer">
        Mit Liebe eingelegt.
      </footer>
    </main>
  );
}
