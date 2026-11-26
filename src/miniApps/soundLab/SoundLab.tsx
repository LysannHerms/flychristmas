import { Link } from "react-router-dom";
import "./soundLab.css";

export default function SoundLab() {
  return (
    <section
      className="sound-lab-placeholder"
      aria-labelledby="sound-lab-title"
    >
      <span className="sound-lab-placeholder__eyebrow">
        OPEN SESSION
      </span>

      <h1 id="sound-lab-title">Sound-Labor</h1>

      <p>
        Das Labor wird gerade für die erste Session
        vorbereitet.
      </p>

      <Link to="/tag/24">
        ← Zurück zu Türchen 24
      </Link>
    </section>
  );
}
