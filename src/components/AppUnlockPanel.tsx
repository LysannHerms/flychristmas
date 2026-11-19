import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";
import {
  hasAppUnlock,
  redeemAppUnlock,
} from "../services/appUnlocks";
import {
  ensureAudioReady,
  preloadDrumSounds,
} from "../miniApps/drumMachine/audioEngine";

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
  const navigate = useNavigate();

  const [unlockState, setUnlockState] =
    useState<UnlockState>("loading");

  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] =
    useState(false);

  const [opening, setOpening] =
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

  useEffect(() => {
    if (appId !== "drum-machine") return;

    // Die Samples werden bereits auf der Türchen-Seite geladen.
    // Der AudioContext bleibt dabei bis zum Öffnen pausiert.
    void preloadDrumSounds();
  }, [appId]);

  async function handleOpenDrumMachine() {
    if (opening) return;

    setOpening(true);
    setMessage("");

    try {
      // Wichtig für iOS: resume() wird hier direkt aus dem Klick
      // heraus gestartet, bevor auf irgendein Promise gewartet wird.
      const audioReadyPromise = ensureAudioReady();

      await Promise.all([
        audioReadyPromise,
        preloadDrumSounds(),
      ]);

      navigate(appPath);
    } catch {
      setMessage(
        "Audio konnte noch nicht gestartet werden. Tippe bitte erneut auf Beat It öffnen.",
      );
      setOpening(false);
    }
  }

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

        {appId === "drum-machine" ? (
          <button
            className="app-unlock-open"
            type="button"
            onClick={() =>
              void handleOpenDrumMachine()
            }
            disabled={opening}
          >
            {opening
              ? "Audio wird vorbereitet …"
              : "Beat It öffnen"}
          </button>
        ) : (
          <Link
            className="app-unlock-open"
            to={appPath}
          >
            App öffnen
          </Link>
        )}

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
