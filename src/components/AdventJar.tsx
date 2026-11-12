
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CalendarDay } from "../data/calendar";
import {
  getUnlockMessage,
  isDayUnlocked,
} from "../utils/calendarTime";

interface AdventJarProps {
  item: CalendarDay;
}

export default function AdventJar({ item }: AdventJarProps) {
  const navigate = useNavigate();

  const [opened, setOpened] = useState(false);
  const [unlocked, setUnlocked] = useState(
    isDayUnlocked(item.day)
  );

  useEffect(() => {
    const update = () => {
      setUnlocked(isDayUnlocked(item.day));
    };

    update();

    // Regelmäßig und bei Rückkehr in den Tab prüfen
    const interval = window.setInterval(update, 1000);
    window.addEventListener("focus", update);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
    };
  }, [item.day]);

  function handleClick() {
    if (!isDayUnlocked(item.day)) return;
    if (opened) return;

    setOpened(true);

    // Erst die Animation, dann die Tagesseite
    window.setTimeout(() => {
      navigate(`/tag/${item.day}`);
    }, 1500);
  }

  return (
    <button
      type="button"
      className={[
        "advent-jar",
        opened ? "advent-jar--opening" : "",
        !unlocked ? "advent-jar--locked" : "",
      ].join(" ")}
      onClick={handleClick}
      aria-label={
        unlocked
          ? `Gurkenglas ${item.day} öffnen`
          : getUnlockMessage(item.day)
      }
      title={
        unlocked
          ? item.title
          : getUnlockMessage(item.day)
      }
    >
      <span className="jar-lid" aria-hidden="true">
        <span className="jar-lid-top" />
      </span>

      <span className="jar-body">
        <span className="jar-highlight" />

        <span className="pickle pickle--one" />
        <span className="pickle pickle--two" />
        <span className="pickle pickle--three" />

        <span className="jar-label">
          <span className="jar-number">{item.day}</span>
        </span>
      </span>

      <span className="jar-sparkle jar-sparkle--one">✦</span>
      <span className="jar-sparkle jar-sparkle--two">✧</span>
      <span className="jar-sparkle jar-sparkle--three">✦</span>
    </button>
  );
}
