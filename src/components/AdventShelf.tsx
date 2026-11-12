
import AdventJar from "./AdventJar";
import { calendarDays } from "../data/calendar";

export default function AdventShelf() {
  const rows = Array.from({ length: 8 }, (_, row) =>
    calendarDays.slice(row * 3, row * 3 + 3)
  );

  return (
    <div className="shelf">
      <div className="shelf-decoration" aria-hidden="true">
        <span>✦</span>
        <span>✧</span>
        <span>✦</span>
        <span>✧</span>
        <span>✦</span>
      </div>

      {rows.map((row, index) => (
        <div className="shelf-row" key={index}>
          <div className="shelf-jars">
            {row.map((item) => (
              <AdventJar key={item.day} item={item} />
            ))}
          </div>

          <div className="wooden-shelf" />
        </div>
      ))}
    </div>
  );
}
