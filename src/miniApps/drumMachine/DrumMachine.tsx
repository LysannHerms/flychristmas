import { useEffect, useRef, useState } from "react";
import {
  prepareAudio,
  renderBeatToWav,
  triggerDrumSound,
  type DrumSoundId,
} from "./audioEngine";
import "./drumMachine.css";

interface PadDefinition {
  id: DrumSoundId;
  label: string;
}

type Pattern = boolean[][];

interface DrumMachineState {
  pattern: Pattern;
  trackLengths: number[];
  bpm: number;
}

const STORAGE_KEY = "flychristmas-beat-it-pattern-v2";
const STEP_COUNT = 16;
const BANK_SIZE = 4;
const BANK_NAMES = ["CORE", "HITS", "PERC", "USER"];
const TRACK_LENGTH_OPTIONS = [4, 6, 7, 8, 12, 16];

const pads: PadDefinition[] = [
  { id: "kick", label: "KICK" },
  { id: "snare", label: "SNARE" },
  { id: "closedHat", label: "CLOSED HAT" },
  { id: "openHat", label: "OPEN HAT" },

  { id: "clap", label: "CLAP" },
  { id: "rim", label: "RIM" },
  { id: "tom1", label: "TOM 1" },
  { id: "tom2", label: "TOM 2" },

  { id: "shaker", label: "SHAKER" },
  { id: "crash", label: "CRASH" },
  { id: "perc1", label: "PERC 1" },
  { id: "perc2", label: "PERC 2" },

  { id: "user1", label: "USER 1" },
  { id: "user2", label: "USER 2" },
  { id: "user3", label: "USER 3" },
  { id: "user4", label: "USER 4" },
];

function createEmptyPattern(): Pattern {
  return pads.map(() =>
    Array.from({ length: STEP_COUNT }, () => false),
  );
}

function clonePattern(pattern: Pattern): Pattern {
  return pattern.map((track) => [...track]);
}

function isValidPattern(value: unknown): value is Pattern {
  return (
    Array.isArray(value) &&
    value.length === pads.length &&
    value.every(
      (track) =>
        Array.isArray(track) &&
        track.length === STEP_COUNT &&
        track.every((step) => typeof step === "boolean"),
    )
  );
}

function isValidTrackLengths(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === pads.length &&
    value.every(
      (length) =>
        typeof length === "number" &&
        TRACK_LENGTH_OPTIONS.includes(length),
    )
  );
}

function readSavedState(): DrumMachineState {
  const fallback: DrumMachineState = {
    pattern: createEmptyPattern(),
    trackLengths: pads.map(() => 16),
    bpm: 112,
  };

  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);

    if (!rawValue) return fallback;

    const saved = JSON.parse(rawValue) as {
      pattern?: unknown;
      trackLengths?: unknown;
      bpm?: unknown;
    };

    return {
      pattern: isValidPattern(saved.pattern)
        ? saved.pattern
        : fallback.pattern,

      trackLengths: isValidTrackLengths(saved.trackLengths)
        ? saved.trackLengths
        : fallback.trackLengths,

      bpm:
        typeof saved.bpm === "number"
          ? Math.min(180, Math.max(60, saved.bpm))
          : fallback.bpm,
    };
  } catch {
    return fallback;
  }
}

export default function DrumMachine() {
  const initialState = useRef(readSavedState()).current;

  const [pattern, setPattern] = useState<Pattern>(
    initialState.pattern,
  );

  const [trackLengths, setTrackLengths] = useState<number[]>(
    initialState.trackLengths,
  );

  const [bpm, setBpm] = useState(initialState.bpm);
  const [selectedBank, setSelectedBank] = useState(0);

  const [selectedTrack, setSelectedTrack] = useState<
    number | null
  >(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [activePad, setActivePad] =
    useState<DrumSoundId | null>(null);

  const [playheads, setPlayheads] = useState<number[]>(
    pads.map(() => -1),
  );

  const [helpOpen, setHelpOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [exportMessage, setExportMessage] = useState("");

  const patternRef = useRef<Pattern>(pattern);
  const trackLengthsRef = useRef<number[]>(trackLengths);
  const bpmRef = useRef<number>(bpm);
  const playingRef = useRef(false);
  const tickRef = useRef(0);
  const audibleTickRef = useRef(0);
  const nextStepTimeRef = useRef(0);
  const schedulerRef = useRef<number | null>(null);
  const playheadTimeoutsRef = useRef<number[]>([]);
  const undoStackRef = useRef<Pattern[]>([]);

  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  useEffect(() => {
    trackLengthsRef.current = trackLengths;
  }, [trackLengths]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  function rememberPattern(currentPattern: Pattern) {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-19),
      clonePattern(currentPattern),
    ];
  }

  function clearPlayheadTimeouts() {
    playheadTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });

    playheadTimeoutsRef.current = [];
  }

  function stopPlayback() {
    playingRef.current = false;

    setIsPlaying(false);
    setIsRecording(false);

    if (schedulerRef.current !== null) {
      window.clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    }

    clearPlayheadTimeouts();

    setPlayheads(pads.map(() => -1));

    tickRef.current = 0;
    audibleTickRef.current = 0;
  }

  useEffect(() => {
    return () => {
      if (schedulerRef.current !== null) {
        window.clearInterval(schedulerRef.current);
      }

      clearPlayheadTimeouts();
    };
  }, []);

  async function schedule() {
    if (!playingRef.current) return;

    const context = await prepareAudio();

    while (
      nextStepTimeRef.current <
      context.currentTime + 0.1
    ) {
      const scheduledTick = tickRef.current;
      const scheduledTime = nextStepTimeRef.current;

      const delay = Math.max(
        0,
        (scheduledTime - context.currentTime) * 1000,
      );

      pads.forEach((pad, trackIndex) => {
        const length = trackLengthsRef.current[trackIndex];
        const stepIndex = scheduledTick % length;

        if (patternRef.current[trackIndex][stepIndex]) {
          void triggerDrumSound(pad.id, scheduledTime);
        }
      });

      const timeoutId = window.setTimeout(() => {
        audibleTickRef.current = scheduledTick;

        setPlayheads(
          trackLengthsRef.current.map(
            (length) => scheduledTick % length,
          ),
        );
      }, delay);

      playheadTimeoutsRef.current.push(timeoutId);

      tickRef.current += 1;

      nextStepTimeRef.current +=
        60 / bpmRef.current / 4;
    }
  }

  async function startPlayback() {
    if (playingRef.current) return;

    const context = await prepareAudio();

    playingRef.current = true;
    setIsPlaying(true);

    tickRef.current = 0;
    audibleTickRef.current = 0;

    nextStepTimeRef.current =
      context.currentTime + 0.05;

    await schedule();

    schedulerRef.current = window.setInterval(() => {
      void schedule();
    }, 25);
  }

  async function toggleRecording() {
    const nextRecordingState = !isRecording;

    setIsRecording(nextRecordingState);

    if (nextRecordingState && !playingRef.current) {
      await startPlayback();
    }
  }

  function changeBpm(amount: number) {
    setBpm((currentBpm) =>
      Math.min(
        180,
        Math.max(60, currentBpm + amount),
      ),
    );
  }

  function recordPadHit(trackIndex: number) {
    const trackLength =
      trackLengthsRef.current[trackIndex];

    const stepIndex =
      audibleTickRef.current % trackLength;

    rememberPattern(patternRef.current);

    setPattern((currentPattern) => {
      const nextPattern = clonePattern(currentPattern);

      nextPattern[trackIndex][stepIndex] = true;

      return nextPattern;
    });
  }

  async function playPad(
    pad: PadDefinition,
    trackIndex: number,
  ) {
    await triggerDrumSound(pad.id);

    setSelectedTrack(trackIndex);

    setSelectedBank(
      Math.floor(trackIndex / BANK_SIZE),
    );

    setActivePad(pad.id);

    window.setTimeout(() => {
      setActivePad((currentPad) =>
        currentPad === pad.id ? null : currentPad,
      );
    }, 120);

    if (isRecording) {
      recordPadHit(trackIndex);
    }

    if ("vibrate" in navigator) {
      navigator.vibrate(12);
    }
  }

  function toggleStep(
    trackIndex: number,
    stepIndex: number,
  ) {
    rememberPattern(patternRef.current);

    setPattern((currentPattern) => {
      const nextPattern = clonePattern(currentPattern);

      nextPattern[trackIndex][stepIndex] =
        !nextPattern[trackIndex][stepIndex];

      return nextPattern;
    });
  }

  function changeTrackLength(
    trackIndex: number,
    length: number,
  ) {
    setTrackLengths((currentLengths) =>
      currentLengths.map((currentLength, index) =>
        index === trackIndex
          ? length
          : currentLength,
      ),
    );
  }

  function undo() {
    const previousPattern =
      undoStackRef.current.pop();

    if (previousPattern) {
      setPattern(previousPattern);
    }
  }

  function clearPattern() {
    const hasSounds = patternRef.current.some(
      (track) => track.some(Boolean),
    );

    if (!hasSounds) return;

    rememberPattern(patternRef.current);
    setPattern(createEmptyPattern());
  }

  function clearTrack(trackIndex: number) {
    if (
      !patternRef.current[trackIndex].some(Boolean)
    ) {
      return;
    }

    rememberPattern(patternRef.current);

    setPattern((currentPattern) =>
      currentPattern.map((track, index) =>
        index === trackIndex
          ? Array.from(
              { length: STEP_COUNT },
              () => false,
            )
          : [...track],
      ),
    );
  }

  function bankHasSounds(bankIndex: number) {
    const firstTrack =
      bankIndex * BANK_SIZE;

    return pattern
      .slice(
        firstTrack,
        firstTrack + BANK_SIZE,
      )
      .some((track) => track.some(Boolean));
  }

  function savePattern() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        pattern,
        trackLengths,
        bpm,
      }),
    );

    setSaveMessage("GESPEICHERT");

    window.setTimeout(() => {
      setSaveMessage("");
    }, 1600);
  }

  async function exportWav() {
    const hasSounds = pattern.some(
      (track) => track.some(Boolean),
    );

    if (
      !hasSounds ||
      exportMessage === "RENDER…"
    ) {
      return;
    }

    setExportMessage("RENDER…");

    try {
      const wavBlob = await renderBeatToWav({
        pattern,
        trackLengths,
        soundIds: pads.map((pad) => pad.id),
        bpm,
        bars: 4,
      });

      const objectUrl =
        URL.createObjectURL(wavBlob);

      const downloadLink =
        document.createElement("a");

      downloadLink.href = objectUrl;
      downloadLink.download =
        `beat-it-${bpm}-bpm.wav`;

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 2000);

      setExportMessage("FERTIG");
    } catch (error) {
      console.error(
        "WAV-Export fehlgeschlagen:",
        error,
      );

      setExportMessage("FEHLER");
    }

    window.setTimeout(() => {
      setExportMessage("");
    }, 1800);
  }

  const firstVisibleTrack =
    selectedBank * BANK_SIZE;

  const visiblePads = pads.slice(
    firstVisibleTrack,
    firstVisibleTrack + BANK_SIZE,
  );

  const patternHasSounds = pattern.some(
    (track) => track.some(Boolean),
  );

  return (
    <section
  className="beat-machine"
  aria-label="Beat It Drum Machine"
  onPointerDown={() => {
    void prepareAudio().catch((error) => {
      console.error(
        "Audio konnte nicht aktiviert werden:",
        error,
      );
    });
  }}
>
      <header className="beat-machine__header">
        <div className="beat-machine__title">
          <span>BEAT</span> IT
        </div>

        <div
          className="beat-tempo"
          aria-label="Tempo"
        >
          <button
            type="button"
            onClick={() => changeBpm(-2)}
            aria-label="Tempo verringern"
          >
            −
          </button>

          <output>{bpm} BPM</output>

          <button
            type="button"
            onClick={() => changeBpm(2)}
            aria-label="Tempo erhöhen"
          >
            +
          </button>
        </div>

        <span className="beat-kit">
          KIT 01
        </span>

        <button
          className="beat-help-button"
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="Hilfe öffnen"
        >
          ?
        </button>
      </header>

      <div className="beat-machine__workspace">
        <div
          className="beat-pads"
          aria-label="Drum Pads"
        >
          {pads.map((pad, trackIndex) => {
            const padHasSteps =
              pattern[trackIndex].some(Boolean);

            return (
              <button
                key={pad.id}
                className={[
                  "beat-pad",

                  selectedTrack === trackIndex
                    ? "beat-pad--selected"
                    : "",

                  activePad === pad.id
                    ? "beat-pad--active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                onPointerDown={() =>
                  void playPad(
                    pad,
                    trackIndex,
                  )
                }
                aria-pressed={
                  selectedTrack === trackIndex
                }
              >
                <span className="beat-pad__label">
                  {pad.label}
                </span>

                {padHasSteps && (
                  <span
                    className="beat-pad__activity"
                    aria-label="Im Beat verwendet"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div
          className="beat-sequencer"
          aria-label="Step Sequencer"
        >
          <div className="beat-sequencer__top">
            <div
              className="beat-bank-tabs"
              aria-label="Sound-Bank auswählen"
            >
              {BANK_NAMES.map(
                (bankName, bankIndex) => (
                  <button
                    key={bankName}
                    className={
                      selectedBank === bankIndex
                        ? "is-active"
                        : ""
                    }
                    type="button"
                    onClick={() =>
                      setSelectedBank(bankIndex)
                    }
                    aria-pressed={
                      selectedBank === bankIndex
                    }
                    aria-label={`${bankName}-Bank auswählen`}
                  >
                    {bankName}

                    {bankHasSounds(bankIndex) && (
                      <span aria-hidden="true" />
                    )}
                  </button>
                ),
              )}
            </div>

            <div
              className="beat-step-numbers"
              aria-hidden="true"
            >
              {Array.from(
                { length: STEP_COUNT },
                (_, index) => (
                  <span key={index}>
                    {index + 1}
                  </span>
                ),
              )}
            </div>
          </div>

          {visiblePads.map(
            (pad, visibleTrackIndex) => {
              const trackIndex =
                firstVisibleTrack +
                visibleTrackIndex;

              const trackHasSounds =
                pattern[trackIndex].some(Boolean);

              return (
                <div
                  className={[
                    "beat-track",

                    `beat-track--${
                      visibleTrackIndex + 1
                    }`,

                    selectedTrack === trackIndex
                      ? "is-selected"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={pad.id}
                >
                  <strong>{pad.label}</strong>

                  <label>
                    <span className="sr-only">
                      Länge der Spur {pad.label}
                    </span>

                    <select
                      value={
                        trackLengths[trackIndex]
                      }
                      onChange={(event) =>
                        changeTrackLength(
                          trackIndex,
                          Number(
                            event.target.value,
                          ),
                        )
                      }
                    >
                      {TRACK_LENGTH_OPTIONS.map(
                        (length) => (
                          <option
                            key={length}
                            value={length}
                          >
                            {length}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <button
                    className="beat-track__clear"
                    type="button"
                    onClick={() =>
                      clearTrack(trackIndex)
                    }
                    disabled={!trackHasSounds}
                    aria-label={`Spur ${pad.label} löschen`}
                    title={`${pad.label}-Spur löschen`}
                  >
                    ×
                  </button>

                  <div className="beat-track__steps">
                    {Array.from(
                      { length: STEP_COUNT },
                      (_, stepIndex) => {
                        const hasSound =
                          pattern[trackIndex][stepIndex];

                        const isOutsideLoop =
                          stepIndex >=
                          trackLengths[trackIndex];

                        const isPlayhead =
                          playheads[trackIndex] ===
                          stepIndex;

                        return (
                          <button
                            key={stepIndex}
                            type="button"
                            disabled={isOutsideLoop}
                            className={[
                              hasSound
                                ? "is-set"
                                : "",

                              isPlayhead
                                ? "is-playhead"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() =>
                              toggleStep(
                                trackIndex,
                                stepIndex,
                              )
                            }
                            aria-label={`${pad.label}, Schritt ${
                              stepIndex + 1
                            }${
                              hasSound
                                ? ", gesetzt"
                                : ""
                            }`}
                          />
                        );
                      },
                    )}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </div>

      <footer className="beat-transport">
        <button
          className={
            isRecording
              ? "transport-button record-button is-active"
              : "transport-button record-button"
          }
          type="button"
          onClick={() =>
            void toggleRecording()
          }
          aria-pressed={isRecording}
        >
          <span aria-hidden="true">●</span>
          REC
        </button>

        <button
          className="transport-button"
          type="button"
          onClick={stopPlayback}
        >
          <span aria-hidden="true">■</span>
          STOP
        </button>

        <button
          className={
            isPlaying
              ? "transport-button play-button is-active"
              : "transport-button play-button"
          }
          type="button"
          onClick={() =>
            void startPlayback()
          }
          disabled={isPlaying}
        >
          <span aria-hidden="true">▶</span>
          PLAY
        </button>

        <button
          className="transport-button"
          type="button"
          onClick={undo}
          disabled={
            undoStackRef.current.length === 0
          }
        >
          <span aria-hidden="true">↶</span>
          UNDO
        </button>

        <button
          className="transport-button"
          type="button"
          onClick={clearPattern}
        >
          <span aria-hidden="true">×</span>
          CLEAR
        </button>

        <button
          className="transport-button save-button"
          type="button"
          onClick={savePattern}
        >
          <span aria-hidden="true">↓</span>
          {saveMessage || "LOCAL"}
        </button>

        <button
          className="transport-button export-button"
          type="button"
          onClick={() => void exportWav()}
          disabled={
            !patternHasSounds ||
            exportMessage === "RENDER…"
          }
        >
          <span aria-hidden="true">⇩</span>
          {exportMessage || "WAV"}
        </button>
      </footer>

      {helpOpen && (
        <div
          className="beat-help-backdrop"
          role="presentation"
          onPointerDown={() =>
            setHelpOpen(false)
          }
        >
          <section
            className="beat-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="beat-help-title"
            onPointerDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="beat-help-close"
              type="button"
              onClick={() =>
                setHelpOpen(false)
              }
              aria-label="Hilfe schließen"
            >
              ×
            </button>

            <h2 id="beat-help-title">
              So funktioniert’s
            </h2>

            <ul>
              <li>
                CORE, HITS, PERC und USER wechseln
                zwischen vier Sound-Banks mit jeweils
                vier eigenen Spuren.
              </li>

              <li>
                Tippe auf ein Pad, um den Sound zu hören.
                Die passende Bank öffnet sich dabei
                automatisch.
              </li>

              <li>
                Tippe auf einen Step, um genau diesen
                Sound dort ein- oder auszuschalten.
              </li>

              <li>
                REC startet den Loop und nimmt deine
                Pad-Schläge auf.
              </li>

              <li>
                Die Zahl neben jeder Spur bestimmt ihre
                eigene Loop-Länge.
              </li>

              <li>
                × löscht eine einzelne Spur und CLEAR den
                gesamten Beat. LOCAL speichert ihn in
                diesem Browser.
              </li>

              <li>
                WAV rendert vier Takte und lädt sie als
                Audiodatei herunter.
              </li>
            </ul>

            <p>
              Ein Punkt an einem Pad oder einer Bank zeigt,
              dass dort bereits Steps gesetzt sind.
              USER 1–4 bekommen später deine persönlichen
              Samples.
            </p>
          </section>
        </div>
      )}
    </section>
  );
}