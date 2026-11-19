import {
  useEffect,
  useState,
} from "react";
import { Link } from "react-router-dom";
import DrumMachine from "../miniApps/drumMachine/DrumMachine";
import { hasAppUnlock } from "../services/appUnlocks";

type AccessState =
  | "loading"
  | "allowed"
  | "locked"
  | "error";

export default function DrumMachinePage() {
  const [
    accessState,
    setAccessState,
  ] = useState<AccessState>("loading");

  useEffect(() => {
    let cancelled = false;

    hasAppUnlock("drum-machine")
      .then((isUnlocked) => {
        if (cancelled) return;

        setAccessState(
          isUnlocked
            ? "allowed"
            : "locked",
        );
      })
      .catch(() => {
        if (cancelled) return;

        setAccessState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (accessState === "loading") {
    return (
      <main className="drum-machine-gate">
        <p>Beat It wird geladen …</p>
      </main>
    );
  }

  if (accessState !== "allowed") {
    return (
      <main className="drum-machine-gate">
        <section className="drum-machine-gate__card">
          <h1>
            Noch nicht freigeschaltet
          </h1>

          <p>
            Öffne zuerst Türchen 16
            und gib dort den Schlüssel
            ein.
          </p>

          <Link to="/tag/16">
            Zu Türchen 16
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="drum-machine-page">
      <div
        className="rotate-device"
        role="status"
      >
        <span aria-hidden="true">
          ↻
        </span>

        <p>
          Dreh dein Handy ins
          Querformat.
        </p>
      </div>

      <DrumMachine />
    </main>
  );
}