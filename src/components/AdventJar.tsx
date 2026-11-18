import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CalendarDay } from "../data/calendar";
import { getUnlockMessage, isDayUnlocked } from "../utils/calendarTime";

import Gurke1 from "../assets/decorations/cucumbers/Gurke1.png";
import Gurke2 from "../assets/decorations/cucumbers/Gurke2.png";
import Gurke3 from "../assets/decorations/cucumbers/Gurke3.png";
import Gurke4 from "../assets/decorations/cucumbers/Gurke4.png";
import Gurke5 from "../assets/decorations/cucumbers/Gurke5.png";
import Gurke6 from "../assets/decorations/cucumbers/Gurke6.png";
import Gurke7 from "../assets/decorations/cucumbers/Gurke7.png";
import Gurke8 from "../assets/decorations/cucumbers/Gurke8.png";
import Gurke9 from "../assets/decorations/cucumbers/Gurke9.png";
import Gurke10 from "../assets/decorations/cucumbers/Gurke10.png";

interface AdventJarProps {
  item: CalendarDay;
}

const wideDays = new Set([6, 10, 15, 21]);
const tallDays = new Set([4, 8, 12, 18, 23]);
const featureDays = new Set([1, 16, 24]);

const cucumberStickerByDay = new Map<number, string>([
  [21, Gurke1],
  [18, Gurke2],
  [24, Gurke3],
  [8, Gurke4],
  [1, Gurke5],
  [4, Gurke6],
  [10, Gurke7],
  [16, Gurke8],
  [12, Gurke9],
  [15, Gurke10],
]);

export default function AdventJar({ item }: AdventJarProps) {
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const [unlocked, setUnlocked] = useState(() =>
    isDayUnlocked(item.day),
  );

  const cucumberSticker = cucumberStickerByDay.get(item.day);

  useEffect(() => {
    const update = () => setUnlocked(isDayUnlocked(item.day));

    update();

    const interval = window.setInterval(update, 1000);
    window.addEventListener("focus", update);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
    };
  }, [item.day]);

  function handleClick() {
    if (!isDayUnlocked(item.day) || opened) return;

    setOpened(true);
    window.setTimeout(() => navigate(`/tag/${item.day}`), 1250);
  }

  const sizeClass = featureDays.has(item.day)
    ? "advent-jar--feature"
    : wideDays.has(item.day)
      ? "advent-jar--wide"
      : tallDays.has(item.day)
        ? "advent-jar--tall"
        : "";

  return (
    <button
      type="button"
      className={[
        "advent-jar",
        sizeClass,
        opened ? "advent-jar--opening" : "",
        !unlocked ? "advent-jar--locked" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      aria-label={
        unlocked
          ? `Türchen ${item.day} öffnen`
          : getUnlockMessage(item.day)
      }
      aria-disabled={!unlocked}
      title={unlocked ? item.title : getUnlockMessage(item.day)}
    >
      <span className="jar-body" aria-hidden="true">
        <span className="jar-label">
          <span className="jar-number">{item.day}</span>
        </span>

        {cucumberSticker && (
          <img
            className="door-detail-image"
            src={cucumberSticker}
            alt=""
          />
        )}
      </span>
    </button>
  );
}