import { useEffect, useRef, useState } from "react";
import type { MiniAppProps } from "../miniAppRegistry";

import Oracle1 from "../../assets/decorations/oracle/oracle1.png";
import Oracle2 from "../../assets/decorations/oracle/oracle2.png";
import Oracle3 from "../../assets/decorations/oracle/oracle3.png";

import "./miniApps.css";

const oracleImages = [Oracle1, Oracle2, Oracle3];
const sparkleCount = 14;

export default function CucumberOracle({
  item,
}: MiniAppProps) {
  const answers = item.appData?.answers ?? [];

  const [isConsulting, setIsConsulting] =
    useState(false);

  const [resultIndex, setResultIndex] =
    useState<number | null>(null);

  const previousResult =
    useRef<number | null>(null);

  const timer =
    useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    };
  }, []);

  function chooseResult() {
    let nextIndex = Math.floor(
      Math.random() * answers.length,
    );

    while (
      answers.length > 1 &&
      nextIndex === previousResult.current
    ) {
      nextIndex = Math.floor(
        Math.random() * answers.length,
      );
    }

    previousResult.current = nextIndex;

    return nextIndex;
  }

  function askOracle() {
    if (
      isConsulting ||
      answers.length === 0
    ) {
      return;
    }

    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }

    setResultIndex(null);
    setIsConsulting(true);

    timer.current = window.setTimeout(
      () => {
        setResultIndex(chooseResult());
        setIsConsulting(false);
        timer.current = null;
      },
      1800,
    );
  }

  const isActive =
    isConsulting || resultIndex !== null;

  return (
    <section
      className={[
        "cucumber-oracle",
        isActive ? "cucumber-oracle--active" : "",
        resultIndex !== null ? "cucumber-oracle--result" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {answers.length === 0 ? (
        <p className="cucumber-oracle__empty">
          Das Orakel sammelt noch seine Gedanken.
        </p>
      ) : (
        <>
          <div
            className="cucumber-oracle__stage"
            aria-live="polite"
            aria-busy={isConsulting}
          >
            <div className="cucumber-oracle__mist" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            <div
              className={[
                "cucumber-oracle__sparkles",
                isConsulting ? "is-consulting" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden="true"
            >
              {Array.from({ length: sparkleCount }, (_, index) => (
                <i key={index} />
              ))}
            </div>

            {resultIndex === null && (
              <div
                className={[
                  "cucumber-oracle__council",
                  isConsulting ? "is-consulting" : "is-idle",
                ].join(" ")}
                aria-hidden="true"
              >
                {isConsulting ? (
                  oracleImages.map((image, index) => (
                    <span
                      className={`cucumber-oracle__cucumber cucumber-oracle__cucumber--${index + 1}`}
                      key={image}
                    >
                      <img src={image} alt="" />
                    </span>
                  ))
                ) : (
                  <span className="cucumber-oracle__cucumber cucumber-oracle__cucumber--1 cucumber-oracle__cucumber--idle">
                    <img src={Oracle1} alt="" />
                  </span>
                )}

                {isConsulting ? (
                  <span className="cucumber-oracle__thinking-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  <span className="cucumber-oracle__question">?</span>
                )}
              </div>
            )}

            {!isConsulting &&
              resultIndex !== null && (
                <div className="cucumber-oracle__result">
                  <div
                    className="cucumber-oracle__result-visual"
                    aria-hidden="true"
                  >
                    <img
                      className={`cucumber-oracle__result-image cucumber-oracle__result-image--${
                        (resultIndex % oracleImages.length) + 1
                      }`}
                      src={
                        oracleImages[
                          resultIndex % oracleImages.length
                        ]
                      }
                      alt=""
                    />
                  </div>

                  <p className="cucumber-oracle__answer">
                    {answers[resultIndex]}
                  </p>
                </div>
              )}
          </div>

          <button
            className="cucumber-oracle__button"
            type="button"
            onClick={askOracle}
            disabled={isConsulting}
          >
            {isConsulting
              ? "Die Gurken beraten sich …"
              : resultIndex === null
                ? "Gurke befragen"
                : "Noch einmal fragen"}
          </button>
        </>
      )}
    </section>
  );
}
