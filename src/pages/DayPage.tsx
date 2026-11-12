
import { Link, useParams, useSearchParams } from "react-router-dom";
import { calendarDays } from "../data/calendar";
import { isDayUnlocked, getUnlockMessage } from "../utils/calendarTime";

export default function DayPage() {
  const { day } = useParams();
  const [searchParams] = useSearchParams();

  const dayNumber = Number(day);
  const item = calendarDays.find(
    (entry) => entry.day === dayNumber
  );

  if (!item) {
    return (
      <main className="day-page">
        <h1>Dieses Glas gibt es nicht.</h1>
        <Link to="/">Zurück zum Regal</Link>
      </main>
    );
  }

  if (!isDayUnlocked(item.day)) {
    return (
      <main className="day-page">
        <div className="day-paper">
          <span className="eyebrow">NOCH VERSCHLOSSEN</span>
          <h1>Geduld, kleine Gurke!</h1>
          <p>{getUnlockMessage(item.day)}</p>
          <Link className="back-link" to="/">
            Zurück zum Regal
          </Link>
        </div>
      </main>
    );
  }

  // Einfacher Bonus-Link für NFC oder QR
  const bonusUnlocked =
    item.hasNfcBonus &&
    Boolean(item.bonusToken) &&
    searchParams.get("bonus") === item.bonusToken;

  return (
    <main className="day-page">
      <article className="day-paper">
        <span className="eyebrow">
          {item.day}. DEZEMBER
        </span>

        <div className="day-illustration" aria-hidden="true">
          ✦
        </div>

        <h1>{item.title}</h1>

        <p>{item.message}</p>

        {item.image && (
          <img
            className="day-image"
            src={item.image}
            alt={item.title}
          />
        )}

        {item.url && (
          <a
            className="content-link"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Überraschung öffnen ↗
          </a>
        )}

        {item.hasNfcBonus && (
          <div className="bonus-section">
            {bonusUnlocked ? (
              <>
                <span className="eyebrow">
                  GEHEIME ÜBERRASCHUNG
                </span>
                <h2>Ein verstecktes Extra!</h2>
                <p>{item.bonusText}</p>
              </>
            ) : (
              <p>
                In diesem Glas versteckt sich noch
                ein kleines Geheimnis ...
              </p>
            )}
          </div>
        )}

        <Link className="back-link" to="/">
          ← Zurück zum Gurkenregal
        </Link>
      </article>
    </main>
  );
}
