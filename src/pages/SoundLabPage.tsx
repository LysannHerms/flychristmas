import {
  useEffect,
  useState,
} from "react";
import { Link } from "react-router-dom";
import SoundLab from "../miniApps/soundLab/SoundLab";
import { hasAppUnlock } from "../services/appUnlocks";

type AccessState =
  | "loading"
  | "allowed"
  | "locked"
  | "error";

export default function SoundLabPage() {
  const [accessState, setAccessState] =
    useState<AccessState>("loading");

  useEffect(() => {
    let cancelled = false;

    hasAppUnlock("sound-labor")
      .then((isUnlocked) => {
        if (cancelled) return;

        setAccessState(
          isUnlocked ? "allowed" : "locked",
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
      <main className="sound-lab-gate">
        <p>Sound-Labor wird geladen …</p>
      </main>
    );
  }

  if (accessState !== "allowed") {
    return (
      <main className="sound-lab-gate">
        <section className="sound-lab-gate__card">
          <h1>Noch nicht freigeschaltet</h1>

          <p>
            Öffne zuerst Türchen 24 und gib dort den
            Schlüssel ein.
          </p>

          {accessState === "error" && (
            <p>
              Die Freischaltung konnte gerade nicht
              geprüft werden. Versuche es bitte noch
              einmal.
            </p>
          )}

          <Link to="/tag/24">Zu Türchen 24</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="sound-lab-page">
      <SoundLab />
    </main>
  );
}
