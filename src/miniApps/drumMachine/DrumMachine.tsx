import { useEffect, useRef, useState } from "react";
import {
  activateAudioWithFeedback,
  ensureAudioReady,
  getAudioState,
  getPadSampleInfo,
  preloadDrumSounds,
  removeCustomPadSample,
  renderBeatToWav,
  setCustomPadSample,
  triggerDrumSound,
  type DrumSoundId,
  type PadSampleInfo,
} from "./audioEngine";
import "./drumMachine.css";

interface PadDefinition {
  id: DrumSoundId;
  label: string;
}

interface ScheduledStep {
  tick: number;
  time: number;
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
const MAX_EXPORT_SECONDS = 5 * 60;

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

function readSampleInfos(): Record<DrumSoundId, PadSampleInfo> {
  return Object.fromEntries(
    pads.map((pad) => [pad.id, getPadSampleInfo(pad.id)]),
  ) as Record<DrumSoundId, PadSampleInfo>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unbekannter Fehler";
}

export default function DrumMachine() {
  const [initialState] = useState(readSavedState);

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
  const [sampleManagerOpen, setSampleManagerOpen] =
    useState(false);
  const [sampleInfos, setSampleInfos] = useState(
    readSampleInfos,
  );
  const [sampleMessage, setSampleMessage] = useState("");
  const [audioStatus, setAudioStatus] = useState("");
  const [audioVerified, setAudioVerified] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [exportMinutes, setExportMinutes] = useState(0);
  const [exportSeconds, setExportSeconds] = useState(30);
  const [undoDepth, setUndoDepth] = useState(0);

  const patternRef = useRef<Pattern>(pattern);
  const trackLengthsRef = useRef<number[]>(trackLengths);
  const bpmRef = useRef<number>(bpm);
  const playingRef = useRef(false);
  const recordingRef = useRef(false);
  const audioVerifiedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const tickRef = useRef(0);
  const audibleTickRef = useRef(0);
  const nextStepTimeRef = useRef(0);
  const scheduledStepsRef = useRef<ScheduledStep[]>([]);
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

  useEffect(() => {
    let cancelled = false;

    void preloadDrumSounds().then(() => {
      if (!cancelled) setSampleInfos(readSampleInfos());
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function checkAudioAfterInterruption() {
      try {
        if (getAudioState() !== "running") {
          audioVerifiedRef.current = false;
          setAudioVerified(false);
          setAudioStatus(
            "AUDIO PAUSIERT – tippe auf AUDIO NEU STARTEN.",
          );
        }
      } catch (error) {
        setAudioStatus(getErrorMessage(error));
      }
    }

    window.addEventListener(
      "orientationchange",
      checkAudioAfterInterruption,
    );
    document.addEventListener(
      "visibilitychange",
      checkAudioAfterInterruption,
    );

    return () => {
      window.removeEventListener(
        "orientationchange",
        checkAudioAfterInterruption,
      );
      document.removeEventListener(
        "visibilitychange",
        checkAudioAfterInterruption,
      );
    };
  }, []);

  function rememberPattern(currentPattern: Pattern) {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-19),
      clonePattern(currentPattern),
    ];
    setUndoDepth(undoStackRef.current.length);
  }

  function updatePattern(
    update: (nextPattern: Pattern) => void,
  ) {
    setPattern((currentPattern) => {
      rememberPattern(currentPattern);
      const nextPattern = clonePattern(currentPattern);
      update(nextPattern);
      patternRef.current = nextPattern;
      return nextPattern;
    });
  }

  function clearPlayheadTimeouts() {
    playheadTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    playheadTimeoutsRef.current = [];
  }

  function stopPlayback() {
    playingRef.current = false;
    recordingRef.current = false;
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
    scheduledStepsRef.current = [];
  }

  useEffect(() => {
    return () => {
      if (schedulerRef.current !== null) {
        window.clearInterval(schedulerRef.current);
      }
      clearPlayheadTimeouts();
    };
  }, []);

  function schedule() {
    if (!playingRef.current) return;

    const context = audioContextRef.current;
    if (!context || context.state !== "running") return;

    while (
      nextStepTimeRef.current < context.currentTime + 0.1
    ) {
      const scheduledTick = tickRef.current;
      const scheduledTime = nextStepTimeRef.current;
      const delay = Math.max(
        0,
        (scheduledTime - context.currentTime) * 1000,
      );

      scheduledStepsRef.current.push({
        tick: scheduledTick,
        time: scheduledTime,
      });
      scheduledStepsRef.current = scheduledStepsRef.current.filter(
        (step) => step.time >= context.currentTime - 2,
      );

      pads.forEach((pad, trackIndex) => {
        const length = trackLengthsRef.current[trackIndex];
        const stepIndex = scheduledTick % length;

        if (patternRef.current[trackIndex][stepIndex]) {
          triggerDrumSound(pad.id, scheduledTime);
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
      nextStepTimeRef.current += 60 / bpmRef.current / 4;
    }
  }

  async function restartAudio(forceFeedback = false) {
    setAudioStatus("AUDIO WIRD GESTARTET …");

    try {
      // Beide Funktionen werden absichtlich vor jedem await
      // gestartet, damit sie direkt zur Nutzeraktion gehören.
      const needsAudibleFeedback =
        forceFeedback || !audioVerifiedRef.current;

      const contextPromise = needsAudibleFeedback
        ? activateAudioWithFeedback()
        : ensureAudioReady();

      const context = await contextPromise;
      await preloadDrumSounds();
      audioContextRef.current = context;
      audioVerifiedRef.current = true;
      setAudioVerified(true);
      setSampleInfos(readSampleInfos());
      setAudioStatus("AUDIO BEREIT");
      return context;
    } catch (error) {
      setAudioStatus(`AUDIO-FEHLER: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async function startPlayback() {
    if (playingRef.current) return;

    try {
      const context = await restartAudio();
      playingRef.current = true;
      setIsPlaying(true);
      tickRef.current = 0;
      audibleTickRef.current = 0;
      scheduledStepsRef.current = [];
      nextStepTimeRef.current = context.currentTime + 0.05;
      schedule();
      schedulerRef.current = window.setInterval(schedule, 25);
    } catch {
      // Die verständliche Meldung setzt restartAudio().
    }
  }

  async function toggleRecording() {
    const nextRecordingState = !recordingRef.current;

    if (nextRecordingState) {
      try {
        await restartAudio();
      } catch {
        return;
      }
    }

    recordingRef.current = nextRecordingState;
    setIsRecording(nextRecordingState);

    if (nextRecordingState && !playingRef.current) {
      await startPlayback();
    }
  }

  function changeBpm(amount: number) {
    setBpm((currentBpm) =>
      Math.min(180, Math.max(60, currentBpm + amount)),
    );
  }

  function findNearestRecordedTick(hitTime: number) {
    const candidates = [...scheduledStepsRef.current];

    if (playingRef.current) {
      candidates.push({
        tick: tickRef.current,
        time: nextStepTimeRef.current,
      });
    }

    if (candidates.length === 0) {
      return audibleTickRef.current;
    }

    return candidates.reduce((nearest, candidate) =>
      Math.abs(candidate.time - hitTime) <
      Math.abs(nearest.time - hitTime)
        ? candidate
        : nearest,
    ).tick;
  }

  function recordPadHit(trackIndex: number, hitTime: number) {
    const trackLength = trackLengthsRef.current[trackIndex];
    const recordedTick = findNearestRecordedTick(hitTime);
    const stepIndex = recordedTick % trackLength;

    updatePattern((nextPattern) => {
      nextPattern[trackIndex][stepIndex] = true;
    });
  }

  async function playPad(
    pad: PadDefinition,
    trackIndex: number,
  ) {
    try {
      const context = await restartAudio();
      const hitTime = context.currentTime;
      triggerDrumSound(pad.id, hitTime);

      if (recordingRef.current) {
        recordPadHit(trackIndex, hitTime);
      }
    } catch {
      return;
    }

    setSelectedTrack(trackIndex);
    setSelectedBank(Math.floor(trackIndex / BANK_SIZE));
    setActivePad(pad.id);

    window.setTimeout(() => {
      setActivePad((currentPad) =>
        currentPad === pad.id ? null : currentPad,
      );
    }, 120);

    if ("vibrate" in navigator) navigator.vibrate(12);
  }

  function toggleStep(trackIndex: number, stepIndex: number) {
    updatePattern((nextPattern) => {
      nextPattern[trackIndex][stepIndex] =
        !nextPattern[trackIndex][stepIndex];
    });
  }

  function changeTrackLength(trackIndex: number, length: number) {
    setTrackLengths((currentLengths) => {
      const nextLengths = currentLengths.map(
        (currentLength, index) =>
          index === trackIndex ? length : currentLength,
      );
      trackLengthsRef.current = nextLengths;
      return nextLengths;
    });
  }

  function undo() {
    const previousPattern = undoStackRef.current.pop();
    if (!previousPattern) return;

    setUndoDepth(undoStackRef.current.length);
    patternRef.current = previousPattern;
    setPattern(previousPattern);
  }

  function clearPattern() {
    const hasSounds = patternRef.current.some((track) =>
      track.some(Boolean),
    );
    if (!hasSounds) return;

    updatePattern((nextPattern) => {
      nextPattern.forEach((track) => track.fill(false));
    });
  }

  function clearTrack(trackIndex: number) {
    if (!patternRef.current[trackIndex].some(Boolean)) return;

    updatePattern((nextPattern) => {
      nextPattern[trackIndex].fill(false);
    });
  }

  function bankHasSounds(bankIndex: number) {
    const firstTrack = bankIndex * BANK_SIZE;
    return pattern
      .slice(firstTrack, firstTrack + BANK_SIZE)
      .some((track) => track.some(Boolean));
  }

  function savePattern() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ pattern, trackLengths, bpm }),
    );
    setSaveMessage("GESPEICHERT");
    window.setTimeout(() => setSaveMessage(""), 1600);
  }

  function normalizedExportDuration() {
    const safeMinutes = Math.max(
      0,
      Math.min(5, Math.trunc(exportMinutes || 0)),
    );
    const safeSeconds = Math.max(
      0,
      Math.min(59, Math.trunc(exportSeconds || 0)),
    );
    return Math.min(
      MAX_EXPORT_SECONDS,
      safeMinutes * 60 + safeSeconds,
    );
  }

  async function exportWav() {
    const hasSounds = pattern.some((track) => track.some(Boolean));
    const durationSeconds = normalizedExportDuration();

    if (!hasSounds || exportMessage === "RENDER…") return;

    if (durationSeconds < 1) {
      setExportMessage("ZEIT?");
      window.setTimeout(() => setExportMessage(""), 1800);
      return;
    }

    setExportMessage("RENDER…");

    try {
      const wavBlob = await renderBeatToWav({
        pattern,
        trackLengths,
        soundIds: pads.map((pad) => pad.id),
        bpm,
        durationSeconds,
      });
      const objectUrl = URL.createObjectURL(wavBlob);
      const downloadLink = document.createElement("a");

      downloadLink.href = objectUrl;
      downloadLink.download =
        `beat-it-${bpm}-bpm-${durationSeconds}s.wav`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
      setExportMessage("FERTIG");
    } catch (error) {
      console.error("WAV-Export fehlgeschlagen:", error);
      setExportMessage("FEHLER");
    }

    window.setTimeout(() => setExportMessage(""), 1800);
  }

  async function handleSampleFile(
    soundId: DrumSoundId,
    file: File | undefined,
  ) {
    if (!file) return;
    setSampleMessage(`${file.name} wird geladen …`);

    try {
      await setCustomPadSample(soundId, file);
      setSampleInfos(readSampleInfos());
      triggerDrumSound(soundId);
      setSampleMessage(`${file.name} ist dem Pad zugewiesen.`);
    } catch (error) {
      setSampleMessage(getErrorMessage(error));
    }
  }

  async function resetSample(soundId: DrumSoundId) {
    try {
      const info = await removeCustomPadSample(soundId);
      setSampleInfos((current) => ({
        ...current,
        [soundId]: info,
      }));
      setSampleMessage("Eigenes Sample entfernt.");
    } catch (error) {
      setSampleMessage(getErrorMessage(error));
    }
  }

  async function previewSample(soundId: DrumSoundId) {
    try {
      await restartAudio();
      triggerDrumSound(soundId);
    } catch {
      // restartAudio zeigt den Fehler bereits an.
    }
  }

  const firstVisibleTrack = selectedBank * BANK_SIZE;
  const visiblePads = pads.slice(
    firstVisibleTrack,
    firstVisibleTrack + BANK_SIZE,
  );
  const patternHasSounds = pattern.some((track) =>
    track.some(Boolean),
  );

  return (
    <section
      className="beat-machine"
      aria-label="Drum Machine"
    >
      <header className="beat-machine__header">
        <div className="beat-machine__title">
          <span>DRUM</span> MACHINE
        </div>

        <button
          className={
            audioVerified
              ? "beat-audio-button is-ready"
              : "beat-audio-button"
          }
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            void restartAudio(true);
          }}
          onClick={(event) => {
            if (event.detail === 0) {
              void restartAudio(true);
            }
          }}
          aria-pressed={audioVerified}
        >
          <span aria-hidden="true">●</span>
          {audioVerified ? "AUDIO AN" : "AUDIO START"}
        </button>

        <div className="beat-tempo" aria-label="Tempo">
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

        <button
          className="beat-kit"
          type="button"
          onClick={() => setSampleManagerOpen(true)}
        >
          SOUNDS
        </button>

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
        <div className="beat-pads" aria-label="Drum Pads">
          {pads.map((pad, trackIndex) => {
            const padHasSteps = pattern[trackIndex].some(Boolean);
            const sampleInfo = sampleInfos[pad.id];

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
                onPointerDown={() => void playPad(pad, trackIndex)}
                aria-pressed={selectedTrack === trackIndex}
              >
                <span className="beat-pad__label">{pad.label}</span>
                {sampleInfo.source === "custom" && (
                  <small>{sampleInfo.name}</small>
                )}
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

        <div className="beat-sequencer" aria-label="Step Sequencer">
          <div className="beat-sequencer__top">
            <div
              className="beat-bank-tabs"
              aria-label="Sound-Bank auswählen"
            >
              {BANK_NAMES.map((bankName, bankIndex) => (
                <button
                  key={bankName}
                  className={
                    selectedBank === bankIndex ? "is-active" : ""
                  }
                  type="button"
                  onClick={() => setSelectedBank(bankIndex)}
                  aria-pressed={selectedBank === bankIndex}
                  aria-label={`${bankName}-Bank auswählen`}
                >
                  {bankName}
                  {bankHasSounds(bankIndex) && (
                    <span aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>

            <div className="beat-step-numbers" aria-hidden="true">
              {Array.from({ length: STEP_COUNT }, (_, index) => (
                <span key={index}>{index + 1}</span>
              ))}
            </div>
          </div>

          {visiblePads.map((pad, visibleTrackIndex) => {
            const trackIndex = firstVisibleTrack + visibleTrackIndex;
            const trackHasSounds = pattern[trackIndex].some(Boolean);

            return (
              <div
                className={[
                  "beat-track",
                  `beat-track--${visibleTrackIndex + 1}`,
                  selectedTrack === trackIndex ? "is-selected" : "",
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
                    value={trackLengths[trackIndex]}
                    onChange={(event) =>
                      changeTrackLength(
                        trackIndex,
                        Number(event.target.value),
                      )
                    }
                  >
                    {TRACK_LENGTH_OPTIONS.map((length) => (
                      <option key={length} value={length}>
                        {length}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  className="beat-track__clear"
                  type="button"
                  onClick={() => clearTrack(trackIndex)}
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
                        stepIndex >= trackLengths[trackIndex];
                      const isPlayhead =
                        playheads[trackIndex] === stepIndex;

                      return (
                        <button
                          key={stepIndex}
                          type="button"
                          disabled={isOutsideLoop}
                          className={[
                            hasSound ? "is-set" : "",
                            isPlayhead ? "is-playhead" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() =>
                            toggleStep(trackIndex, stepIndex)
                          }
                          aria-label={`${pad.label}, Schritt ${
                            stepIndex + 1
                          }${hasSound ? ", gesetzt" : ""}`}
                        />
                      );
                    },
                  )}
                </div>
              </div>
            );
          })}
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
          onClick={() => void toggleRecording()}
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
          onClick={() => void startPlayback()}
          disabled={isPlaying}
        >
          <span aria-hidden="true">▶</span>
          PLAY
        </button>

        <button
          className="transport-button"
          type="button"
          onClick={undo}
          disabled={undoDepth === 0}
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

        <div className="beat-export-length" aria-label="Exportlänge">
          <label>
            <span>MIN</span>
            <input
              type="number"
              min="0"
              max="5"
              inputMode="numeric"
              value={exportMinutes}
              onChange={(event) => {
                const nextMinutes = Math.max(
                  0,
                  Math.min(5, Number(event.target.value)),
                );
                setExportMinutes(nextMinutes);
                if (nextMinutes === 5) setExportSeconds(0);
              }}
            />
          </label>
          <b>:</b>
          <label>
            <span>SEK</span>
            <input
              type="number"
              min="0"
              max="59"
              inputMode="numeric"
              value={exportSeconds}
              onChange={(event) =>
                setExportSeconds(
                  exportMinutes === 5
                    ? 0
                    : Math.max(
                        0,
                        Math.min(59, Number(event.target.value)),
                      ),
                )
              }
            />
          </label>
        </div>

        <button
          className="transport-button export-button"
          type="button"
          onClick={() => void exportWav()}
          disabled={!patternHasSounds || exportMessage === "RENDER…"}
        >
          <span aria-hidden="true">⇩</span>
          {exportMessage || "WAV"}
        </button>
      </footer>

      {helpOpen && (
        <div
          className="beat-help-backdrop"
          role="presentation"
          onClick={() => setHelpOpen(false)}
        >
          <section
            className="beat-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="beat-help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="beat-help-close"
              type="button"
              onClick={() => setHelpOpen(false)}
              aria-label="Hilfe schließen"
            >
              ×
            </button>

            <h2 id="beat-help-title">So funktioniert’s</h2>
            <ul>
              <li>
                CORE, HITS, PERC und USER wechseln zwischen vier
                Sound-Banks mit jeweils vier Spuren.
              </li>
              <li>
                Tippe ein Pad zum Spielen oder einen großen Step zum
                direkten Ein- und Ausschalten.
              </li>
              <li>
                REC ordnet Pad-Schläge dem zeitlich nächsten Step zu.
              </li>
              <li>
                Die Zahl neben jeder Spur bestimmt ihre eigene
                Loop-Länge.
              </li>
              <li>
                SOUNDS weist Pads eigene Audiodateien zu. Diese werden
                nur in diesem Browser gespeichert.
              </li>
              <li>
                MIN:SEK bestimmt die Länge der WAV-Datei. Das Pattern
                wird bis zur gewählten Zeit wiederholt.
              </li>
            </ul>

            <div className="beat-audio-test">
              <strong>Audio</strong>
              <button
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void restartAudio(true);
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (event.detail === 0) {
                    void restartAudio(true);
                  }
                }}
              >
                AUDIO NEU STARTEN
              </button>
              {audioStatus && (
                <output aria-live="polite">{audioStatus}</output>
              )}
            </div>
          </section>
        </div>
      )}

      {sampleManagerOpen && (
        <div
          className="beat-help-backdrop"
          role="presentation"
          onClick={() => setSampleManagerOpen(false)}
        >
          <section
            className="beat-sample-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="beat-sample-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="beat-help-close"
              type="button"
              onClick={() => setSampleManagerOpen(false)}
              aria-label="Sound-Verwaltung schließen"
            >
              ×
            </button>

            <h2 id="beat-sample-title">Pad-Sounds</h2>
            <p>
              Eigene Dateien bleiben lokal in diesem Browser. Sie werden
              nicht in Supabase und nicht in das Frontend hochgeladen.
            </p>

            <div className="beat-sample-list">
              {pads.map((pad) => {
                const info = sampleInfos[pad.id];

                return (
                  <div className="beat-sample-row" key={pad.id}>
                    <div>
                      <strong>{pad.label}</strong>
                      <small title={info.name}>{info.name}</small>
                    </div>

                    <button
                      type="button"
                      onClick={() => void previewSample(pad.id)}
                      aria-label={`${pad.label} vorhören`}
                    >
                      ▶
                    </button>

                    <label className="beat-sample-file">
                      ERSETZEN
                      <input
                        type="file"
                        accept="audio/*,.wav,.mp3,.ogg,.m4a,.aac,.aif,.aiff"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          void handleSampleFile(pad.id, file);
                          event.target.value = "";
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => void resetSample(pad.id)}
                      disabled={info.source !== "custom"}
                    >
                      RESET
                    </button>
                  </div>
                );
              })}
            </div>

            {sampleMessage && (
              <output className="beat-sample-message" aria-live="polite">
                {sampleMessage}
              </output>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
