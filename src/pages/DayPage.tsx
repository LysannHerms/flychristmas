import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { CalendarDay } from "../data/calendar";
import { getCalendarDay } from "../services/calendarContent";
import { isDayUnlocked, getUnlockMessage } from "../utils/calendarTime";

export default function DayPage() {
  const { day } = useParams();
  const [searchParams] = useSearchParams();
  const dayNumber = Number(day);
  const [item, setItem] = useState<CalendarDay | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");

    getCalendarDay(dayNumber)
      .then((calendarDay) => {
        if (cancelled) return;
        setItem(calendarDay);
        setLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [dayNumber]);

  if (loadState === "loading") {
    return (
      <main className="day-page">
        <p className="day-status">Türchen wird geladen …</p>
      </main>
    );
  }

  if (loadState === "error") {
    return (
      <main className="day-page">
        <article className="day-paper">
          <h1>Das Türchen konnte gerade nicht geladen werden.</h1>
          <Link className="back-link" to="/">
            Zurück zum Kalender
          </Link>
        </article>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="day-page">
        <h1>Dieses Türchen gibt es nicht.</h1>
        <Link to="/">Zurück zum Kalender</Link>
      </main>
    );
  }

  if (!isDayUnlocked(item.day)) {
    return (
      <main className="day-page">
        <p className="day-date">{item.day}. Dezember</p>

        <div className="day-paper">
          <span className="eyebrow">NOCH VERSCHLOSSEN</span>
          <h1>Geduld, kleine Gurke!</h1>
          <p>{getUnlockMessage(item.day)}</p>
          <Link className="back-link" to="/">
            Zurück zum Kalender
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
      <p className="day-date">{item.day}. Dezember</p>

      <article className="day-paper">
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
                <span className="eyebrow">GEHEIME ÜBERRASCHUNG</span>
                <h2>Ein verstecktes Extra!</h2>
                <p>{item.bonusText}</p>
              </>
            ) : (
              <p>
                In diesem Türchen versteckt sich noch ein kleines Geheimnis ...
              </p>
            )}
          </div>
        )}

        <Link className="back-link" to="/">
          ← Zurück zum Kalender
        </Link>
      </article>
    </main>
  );
}