import {
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";

export default function KeyPage() {
  const [searchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [copyState, setCopyState] = useState<
    "idle" | "copied" | "error"
  >("idle");

  const code = (
    searchParams.get("code") ?? ""
  )
    .trim()
    .toUpperCase();

  async function copyCode() {
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      const input = inputRef.current;

      if (!input) {
        setCopyState("error");
        return;
      }

      input.focus();
      input.select();
      input.setSelectionRange(0, code.length);

      const copied = document.execCommand("copy");

      setCopyState(
        copied ? "copied" : "error",
      );
    }
  }

  return (
    <main className="key-page">
      <section
        className="key-card"
        aria-labelledby="key-title"
      >
        <span className="key-eyebrow">
          EIN KLEINER SCHLÜSSEL
        </span>

        <h1 id="key-title">Beat It</h1>

        {code ? (
          <>
            <p>
              Kopiere den Schlüssel und öffne danach
              FlyChristmas über das Icon auf deinem
              Home-Bildschirm.
            </p>

            <input
              ref={inputRef}
              className="key-code"
              type="text"
              value={code}
              readOnly
              aria-label="Freischaltcode"
              onFocus={(event) =>
                event.currentTarget.select()
              }
            />

            <button
              className="key-copy-button"
              type="button"
              onClick={copyCode}
            >
              {copyState === "copied"
                ? "Schlüssel kopiert"
                : "Schlüssel kopieren"}
            </button>

            {copyState === "error" && (
              <p
                className="key-error"
                role="alert"
              >
                Halte den Schlüssel gedrückt und
                kopiere ihn manuell.
              </p>
            )}
          </>
        ) : (
          <p
            className="key-error"
            role="alert"
          >
            Dieser Schlüssel ist leider unvollständig.
          </p>
        )}
      </section>
    </main>
  );
}