import AdventJar from "./AdventJar";
import { calendarDays } from "../data/calendar";

const displayOrder = [
  14, 2, 21, 5, 11, 18,
  7, 24, 3, 16, 9, 1,
  20, 6, 13, 22, 4, 17,
  10, 23, 8, 15, 12, 19,
];

export default function AdventShelf() {
  return (
    <div className="shelf">
     

      <div className="shelf-jars">
        {displayOrder.map((day) => {
          const item = calendarDays.find((entry) => entry.day === day);
          if (!item) return null;

          return <AdventJar key={item.day} item={item} />;
        })}
      </div>
    </div>
  );
}