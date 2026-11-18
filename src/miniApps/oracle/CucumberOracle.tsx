import { useEffect, useRef, useState } from "react";
import type { MiniAppProps } from "../miniAppRegistry";

import Gurke1 from "../../assets/decorations/cucumbers/Gurke1.png";
import Gurke2 from "../../assets/decorations/cucumbers/Gurke2.png";
import Gurke3 from "../../assets/decorations/cucumbers/Gurke3.png";
import Gurke4 from "../../assets/decorations/cucumbers/Gurke4.png";
import Gurke5 from "../../assets/decorations/cucumbers/Gurke5.png";
import Gurke6 from "../../assets/decorations/cucumbers/Gurke6.png";
import Gurke7 from "../../assets/decorations/cucumbers/Gurke7.png";
import Gurke8 from "../../assets/decorations/cucumbers/Gurke8.png";
import Gurke9 from "../../assets/decorations/cucumbers/Gurke9.png";
import Gurke10 from "../../assets/decorations/cucumbers/Gurke10.png";

import "./miniApps.css";

const cucumberImages = [
  Gurke1,
  Gurke2,
  Gurke3,
  Gurke4,
  Gurke5,
  Gurke6,
  Gurke7,
  Gurke8,
  Gurke9,
  Gurke10,
];

const animationCucumbers = cucumberImages.slice(0, 6);

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
      1400,
    );
  }

  return (
    <section className="cucumber-oracle">
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
            {isConsulting && (
              <div
                className="cucumber-oracle__cloud"
                aria-hidden="true"
              >
                {animationCucumbers.map(
                  (image, index) => (
                    <img
                      key={image}
                      className={`cucumber-oracle__floating cucumber-oracle__floating--${index + 1}`}
                      src={image}
                      alt=""
                    />
                  ),
                )}
              </div>
            )}

            {!isConsulting &&
              resultIndex === null && (
                <div
                  className="cucumber-oracle__idle"
                  aria-hidden="true"
                >
                  <img src={Gurke1} alt="" />
                  <span>?</span>
                </div>
              )}

            {!isConsulting &&
              resultIndex !== null && (
                <div className="cucumber-oracle__result">
                  <img
                    className="cucumber-oracle__result-image"
                    src={
                      cucumberImages[
                        resultIndex %
                          cucumberImages.length
                      ]
                    }
                    alt=""
                  />

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