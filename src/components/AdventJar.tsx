import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getUnlockMessage,
  isDayUnlocked,
} from "../utils/calendarTime";

import Gurke1 from "../assets/decorations/cucumbers/Gurke1.webp";
import Gurke2 from "../assets/decorations/cucumbers/Gurke2.webp";
import Gurke3 from "../assets/decorations/cucumbers/Gurke3.webp";
import Gurke4 from "../assets/decorations/cucumbers/Gurke4.webp";
import Gurke5 from "../assets/decorations/cucumbers/Gurke5.webp";
import Gurke6 from "../assets/decorations/cucumbers/Gurke6.webp";
import Gurke7 from "../assets/decorations/cucumbers/Gurke7.webp";
import Gurke8 from "../assets/decorations/cucumbers/Gurke8.webp";
import Gurke9 from "../assets/decorations/cucumbers/Gurke9.webp";
import Gurke10 from "../assets/decorations/cucumbers/Gurke10.webp";

interface AdventJarProps {
  day: number;
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

export default function AdventJar({
  day,
}: AdventJarProps) {
  const navigate = useNavigate();

  const [opened, setOpened] = useState(false);

  const [unlocked, setUnlocked] = useState(() =>
    isDayUnlocked(day),
  );

  const cucumberSticker =
    cucumberStickerByDay.get(day);

  useEffect(() => {
    const update = () =>
      setUnlocked(isDayUnlocked(day));

    update();

    const interval = window.setInterval(
      update,
      1000,
    );

    window.addEventListener("focus", update);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
    };
  }, [day]);

  function handleClick() {
    if (!isDayUnlocked(day) || opened) return;

    setOpened(true);

    window.setTimeout(
      () => navigate(`/tag/${day}`),
      1250,
    );
  }

  const sizeClass = featureDays.has(day)
    ? "advent-jar--feature"
    : wideDays.has(day)
      ? "advent-jar--wide"
      : tallDays.has(day)
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
          ? `Türchen ${day} öffnen`
          : getUnlockMessage(day)
      }
      aria-disabled={!unlocked}
      title={
        unlocked
          ? `Türchen ${day}`
          : getUnlockMessage(day)
      }
    >
      <span
        className="jar-body"
        aria-hidden="true"
      >
        <span className="jar-label">
          <span className="jar-number">
            {day}
          </span>
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