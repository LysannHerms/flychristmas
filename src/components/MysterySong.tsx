import {
  useEffect,
  useRef,
  useState,
} from "react";

import "./mysterySong.css";

interface SpotifyEmbedController {
  play: () => void;
  destroy?: () => void;
}

interface SpotifyIframeApi {
  createController: (
    element: HTMLElement,
    options: {
      uri: string;
      width: string;
      height: string;
      theme: "dark";
    },
    callback: (
      controller: SpotifyEmbedController,
    ) => void,
  ) => void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (
      api: SpotifyIframeApi,
    ) => void;
  }
}

let spotifyApiPromise:
  | Promise<SpotifyIframeApi>
  | undefined;

function loadSpotifyIframeApi() {
  if (spotifyApiPromise) {
    return spotifyApiPromise;
  }

  spotifyApiPromise = new Promise<SpotifyIframeApi>(
    (resolve, reject) => {
      window.onSpotifyIframeApiReady = resolve;

      const existingScript = document.querySelector<
        HTMLScriptElement
      >('script[src="https://open.spotify.com/embed/iframe-api/v1"]');

      if (existingScript) return;

      const script = document.createElement("script");
      script.src =
        "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      script.onerror = () =>
        reject(
          new Error(
            "Der Spotify-Player konnte nicht geladen werden.",
          ),
        );

      document.body.appendChild(script);
    },
  );

  return spotifyApiPromise;
}

function getSpotifyTrackId(url: string) {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname !== "open.spotify.com") {
      return null;
    }

    const parts = parsedUrl.pathname
      .split("/")
      .filter(Boolean);
    const trackIndex = parts.indexOf("track");
    const trackId = parts[trackIndex + 1];

    return trackIndex >= 0 &&
      /^[A-Za-z0-9]{22}$/.test(trackId ?? "")
      ? trackId
      : null;
  } catch {
    return null;
  }
}

interface MysterySongProps {
  url: string;
}

export default function MysterySong({
  url,
}: MysterySongProps) {
  const trackId = getSpotifyTrackId(url);
  const playerElement = useRef<HTMLDivElement>(null);
  const controller =
    useRef<SpotifyEmbedController | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isRevealed, setIsRevealed] =
    useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!trackId || !playerElement.current) {
      setHasError(true);
      return;
    }

    let cancelled = false;

    loadSpotifyIframeApi()
      .then((api) => {
        if (cancelled || !playerElement.current) {
          return;
        }

        api.createController(
          playerElement.current,
          {
            uri: `spotify:track:${trackId}`,
            width: "100%",
            height: "152",
            theme: "dark",
          },
          (embedController) => {
            if (cancelled) {
              embedController.destroy?.();
              return;
            }

            controller.current = embedController;
            setIsReady(true);
          },
        );
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      });

    return () => {
      cancelled = true;
      controller.current?.destroy?.();
      controller.current = null;
    };
  }, [trackId]);

  function revealAndPlay() {
    setIsRevealed(true);
    controller.current?.play();
  }

  if (hasError || !trackId) {
    return (
      <a
        className="mystery-song__fallback"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Song in Spotify öffnen
      </a>
    );
  }

  return (
    <section
      className={[
        "mystery-song",
        isRevealed ? "is-revealed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Überraschungssong"
    >
      <div
        className="mystery-song__player"
        ref={playerElement}
      />

      {!isRevealed && (
        <div className="mystery-song__cover">
          <button
            className="mystery-song__play"
            type="button"
            onClick={revealAndPlay}
            disabled={!isReady}
          >
            <span aria-hidden="true">▶</span>
            {isReady
              ? "Überraschungssong starten"
              : "Song wird vorbereitet …"}
          </button>
        </div>
      )}
    </section>
  );
}
