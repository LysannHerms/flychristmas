import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  hasAppUnlock,
  redeemAppUnlock,
} from "../services/appUnlocks";

interface AppUnlockPanelProps {
  appId: string;
  appPath: string;
}

type UnlockState =
  | "loading"
  | "locked"
  | "unlocked"
  | "error";

export default function AppUnlockPanel({
  appId,
  appPath,
}: AppUnlockPanelProps) {
  const [unlockState, setUnlockState] =
    useState<UnlockState>("loading");

  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    hasAppUnlock(appId)
      .then((isUnlocked) => {
        if (cancelled) return;

        setUnlockState(
          isUnlocked ? "unlocked" : "locked",
        );
      })
      .catch(() => {
        if (cancelled) return;
        setUnlockState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [appId]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const cleanCode = code.trim();

    if (!cleanCode || submitting) return;

    setSubmitting(true);
    setMessage("");

    try {
      const success = await redeemAppUnlock(
        appId,
        cleanCode,
      );

      if (!success) {
        setMessage(
          "Der Schlüssel passt noch nicht. Prüfe ihn bitte noch einmal.",
        );
        return;
      }

      setUnlockState("unlocked");
      setCode("");
    } catch {
      setMessage(
        "Der Schlüssel konnte gerade nicht geprüft werden.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (unlockState === "loading") {
    return (
      <div className="app-unlock-panel">
        <p className="app-unlock-status">
          Schlüssel wird geprüft …
        </p>
      </div>
    );
  }

  if (unlockState === "error") {
    return (
      <div className="app-unlock-panel">
        <p
          className="app-unlock-error"
          role="alert"
        >
          Die Freischaltung konnte gerade nicht geladen
          werden. Bitte lade die Seite noch einmal neu.
        </p>
      </div>
    );
  }

  if (unlockState === "unlocked") {
    return (
      <div className="app-unlock-panel app-unlock-panel--open">
        <span className="app-unlock-label">
          FREIGESCHALTET
        </span>

        <Link
          className="app-unlock-open"
          to={appPath}
        >
          Beat It öffnen
        </Link>
      </div>
    );
  }

  return (
    <div className="app-unlock-panel">
      <p className="app-unlock-hint">
        Scanne den Code, um zu sehen, was sich hier
        verbirgt.
      </p>

      <form
        className="app-unlock-form"
        onSubmit={handleSubmit}
      >
        <label htmlFor={`unlock-code-${appId}`}>
          Schlüssel
        </label>

        <input
          id={`unlock-code-${appId}`}
          type="text"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.toUpperCase())
          }
          placeholder="BEAT-…"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          required
        />

        <button
          type="submit"
          disabled={!code.trim() || submitting}
        >
          {submitting
            ? "Wird geprüft …"
            : "Freischalten"}
        </button>
      </form>

      {message && (
        <p
          className="app-unlock-error"
          role="alert"
        >
          {message}
        </p>
      )}
    </div>
  );
}