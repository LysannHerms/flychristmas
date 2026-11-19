export type DrumSoundId =
  | "kick"
  | "snare"
  | "closedHat"
  | "openHat"
  | "clap"
  | "rim"
  | "tom1"
  | "tom2"
  | "shaker"
  | "crash"
  | "perc1"
  | "perc2"
  | "user1"
  | "user2"
  | "user3"
  | "user4";

export type PadSampleSource =
  | "custom"
  | "default"
  | "synth";

export interface PadSampleInfo {
  soundId: DrumSoundId;
  source: PadSampleSource;
  name: string;
}

interface BeatExportOptions {
  pattern: boolean[][];
  trackLengths: number[];
  soundIds: DrumSoundId[];
  bpm: number;
  durationSeconds: number;
}

interface StoredSample {
  soundId: DrumSoundId;
  name: string;
  mimeType: string;
  data: ArrayBuffer;
  updatedAt: number;
}

interface WebKitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const SAMPLE_DATABASE = "flychristmas-beat-it";
const SAMPLE_STORE = "pad-samples";
const SAMPLE_DATABASE_VERSION = 1;
const MAX_SAMPLE_BYTES = 15 * 1024 * 1024;

/*
 * Fest mit der App ausgelieferte WAVs liegen in public/sounds.
 * Weitere feste Samples können später einfach hier ergänzt werden,
 * zum Beispiel:
 * snare: `${import.meta.env.BASE_URL}sounds/snare.wav`,
 */
const DEFAULT_SAMPLE_URLS: Partial<
  Record<DrumSoundId, string>
> = {
  kick: `${import.meta.env.BASE_URL}sounds/audio-test.wav`,
};

const DEFAULT_SAMPLE_NAMES: Partial<
  Record<DrumSoundId, string>
> = {
  kick: "audio-test.wav",
};

let audioContext: AudioContext | null = null;
let masterOutput: AudioNode | null = null;
let defaultSamplesPromise: Promise<void> | null = null;
let storedSamplesPromise: Promise<void> | null = null;

const defaultSampleBuffers = new Map<DrumSoundId, AudioBuffer>();
const customSampleBuffers = new Map<DrumSoundId, AudioBuffer>();
const customSampleNames = new Map<DrumSoundId, string>();

function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === "closed") {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as WebKitWindow).webkitAudioContext;

    if (!AudioContextConstructor) {
      throw new Error(
        "Dieser Browser unterstützt die Web Audio API nicht.",
      );
    }

    try {
      audioContext = new AudioContextConstructor({
        latencyHint: "interactive",
      });
    } catch {
      // Fallback für ältere Safari-Versionen, die die Optionen
      // des Konstruktors noch nicht akzeptieren.
      audioContext = new AudioContextConstructor();
    }
    masterOutput = null;
  }

  return audioContext;
}

function playSilentUnlockSound(context: AudioContext) {
  const buffer = context.createBuffer(1, 1, context.sampleRate);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start(0);
}

function playAudibleUnlockSound(context: AudioContext) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const when = context.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, when);
  oscillator.frequency.exponentialRampToValueAtTime(
    520,
    when + 0.07,
  );

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.08, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(when);
  oscillator.stop(when + 0.09);
}

export async function ensureAudioReady(): Promise<AudioContext> {
  const context = getAudioContext();

  if (context.state !== "running") {
    // Vor resume() darf kein await stehen: Der Aufruf muss noch
    // direkt zur Nutzeraktion auf „Beat It öffnen“ gehören.
    const resumePromise = context.resume();
    playSilentUnlockSound(context);
    await resumePromise;
  }

  if (context.state !== "running") {
    throw new Error("Audio konnte noch nicht aktiviert werden.");
  }

  return context;
}

export async function activateAudioWithFeedback(): Promise<AudioContext> {
  const context = getAudioContext();

  // Der kurze hörbare Ton wird noch innerhalb der direkten
  // Nutzeraktion geplant. Das ist auf iOS zuverlässiger als ein
  // vollständig stummer Unlock-Buffer.
  playAudibleUnlockSound(context);

  if (context.state !== "running") {
    const resumePromise = context.resume();
    await resumePromise;
  }

  if (context.state !== "running") {
    throw new Error("Audio konnte noch nicht aktiviert werden.");
  }

  return context;
}

export function getAudioState(): AudioContextState {
  return getAudioContext().state;
}

function createMasterOutput(context: BaseAudioContext) {
  const compressor = context.createDynamicsCompressor();
  const gain = context.createGain();

  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.2;
  gain.gain.value = 0.72;

  compressor.connect(gain);
  gain.connect(context.destination);
  return compressor;
}

function getMasterOutput(context: AudioContext) {
  if (!masterOutput) {
    masterOutput = createMasterOutput(context);
  }
  return masterOutput;
}

function decodeSample(context: AudioContext, data: ArrayBuffer) {
  // Safari darf den übergebenen ArrayBuffer beim Decodieren
  // verbrauchen. Die Kopie bleibt deshalb absichtlich hier.
  return context.decodeAudioData(data.slice(0));
}

function openSampleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(
        new Error(
          "Dieser Browser kann eigene Samples nicht dauerhaft speichern.",
        ),
      );
      return;
    }

    const request = indexedDB.open(
      SAMPLE_DATABASE,
      SAMPLE_DATABASE_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SAMPLE_STORE)) {
        database.createObjectStore(SAMPLE_STORE, {
          keyPath: "soundId",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredSamples(): Promise<StoredSample[]> {
  const database = await openSampleDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      SAMPLE_STORE,
      "readonly",
    );
    const request = transaction.objectStore(SAMPLE_STORE).getAll();

    request.onsuccess = () => {
      resolve(request.result as StoredSample[]);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}

async function writeStoredSample(
  sample: StoredSample,
): Promise<void> {
  const database = await openSampleDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      SAMPLE_STORE,
      "readwrite",
    );
    transaction.objectStore(SAMPLE_STORE).put(sample);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

async function deleteStoredSample(
  soundId: DrumSoundId,
): Promise<void> {
  const database = await openSampleDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      SAMPLE_STORE,
      "readwrite",
    );
    transaction.objectStore(SAMPLE_STORE).delete(soundId);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

async function loadDefaultSamples(
  context: AudioContext,
): Promise<void> {
  if (defaultSamplesPromise) return defaultSamplesPromise;

  defaultSamplesPromise = Promise.all(
    Object.entries(DEFAULT_SAMPLE_URLS).map(
      async ([rawSoundId, url]) => {
        const soundId = rawSoundId as DrumSoundId;

        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.arrayBuffer();
          const buffer = await decodeSample(context, data);
          defaultSampleBuffers.set(soundId, buffer);
        } catch (error) {
          console.error(
            `Standardsample ${soundId} konnte nicht geladen werden:`,
            error,
          );
        }
      },
    ),
  ).then(() => undefined);

  return defaultSamplesPromise;
}

async function loadStoredSamples(
  context: AudioContext,
): Promise<void> {
  if (storedSamplesPromise) return storedSamplesPromise;

  storedSamplesPromise = (async () => {
    let samples: StoredSample[] = [];

    try {
      samples = await readStoredSamples();
    } catch (error) {
      console.error(
        "Gespeicherte Samples konnten nicht gelesen werden:",
        error,
      );
      return;
    }

    await Promise.all(
      samples.map(async (sample) => {
        try {
          const buffer = await decodeSample(context, sample.data);
          customSampleBuffers.set(sample.soundId, buffer);
          customSampleNames.set(sample.soundId, sample.name);
        } catch (error) {
          console.error(
            `Eigenes Sample ${sample.name} konnte nicht decodiert werden:`,
            error,
          );
        }
      }),
    );
  })();

  return storedSamplesPromise;
}

export async function preloadDrumSounds(): Promise<void> {
  const context = getAudioContext();
  await Promise.all([
    loadDefaultSamples(context),
    loadStoredSamples(context),
  ]);
}

export function getPadSampleInfo(
  soundId: DrumSoundId,
): PadSampleInfo {
  const customName = customSampleNames.get(soundId);

  if (customName) {
    return { soundId, source: "custom", name: customName };
  }

  const defaultName = DEFAULT_SAMPLE_NAMES[soundId];
  if (defaultName) {
    return { soundId, source: "default", name: defaultName };
  }

  return {
    soundId,
    source: "synth",
    name: "Synth-Standard",
  };
}

export async function setCustomPadSample(
  soundId: DrumSoundId,
  file: File,
): Promise<PadSampleInfo> {
  if (file.size > MAX_SAMPLE_BYTES) {
    throw new Error("Die Audiodatei darf höchstens 15 MB groß sein.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const supportedExtension = [
    "wav",
    "mp3",
    "ogg",
    "m4a",
    "aac",
    "aif",
    "aiff",
  ].includes(extension ?? "");

  if (!file.type.startsWith("audio/") && !supportedExtension) {
    throw new Error(
      "Bitte wähle eine WAV-, MP3-, OGG-, M4A- oder AIFF-Datei.",
    );
  }

  const context = getAudioContext();
  const data = await file.arrayBuffer();
  let buffer: AudioBuffer;

  try {
    buffer = await decodeSample(context, data);
  } catch {
    throw new Error("Die Audiodatei konnte nicht gelesen werden.");
  }

  const name = file.name.slice(0, 80);

  await writeStoredSample({
    soundId,
    name,
    mimeType: file.type || "application/octet-stream",
    data,
    updatedAt: Date.now(),
  });

  customSampleBuffers.set(soundId, buffer);
  customSampleNames.set(soundId, name);
  return getPadSampleInfo(soundId);
}

export async function removeCustomPadSample(
  soundId: DrumSoundId,
): Promise<PadSampleInfo> {
  await deleteStoredSample(soundId);
  customSampleBuffers.delete(soundId);
  customSampleNames.delete(soundId);
  return getPadSampleInfo(soundId);
}

function createNoiseBuffer(
  context: BaseAudioContext,
  duration: number,
) {
  const frameCount = Math.ceil(context.sampleRate * duration);
  const buffer = context.createBuffer(
    1,
    frameCount,
    context.sampleRate,
  );
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playSampleBuffer(
  context: BaseAudioContext,
  output: AudioNode,
  buffer: AudioBuffer,
  when: number,
) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(output);
  source.start(when);
}

function playTone(
  context: BaseAudioContext,
  output: AudioNode,
  when: number,
  startFrequency: number,
  endFrequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, when);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(1, endFrequency),
    when + duration,
  );
  gain.gain.setValueAtTime(volume, when);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    when + duration,
  );

  oscillator.connect(gain);
  gain.connect(output);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.02);
}

function playNoise(
  context: BaseAudioContext,
  output: AudioNode,
  when: number,
  duration: number,
  volume: number,
  filterType: BiquadFilterType,
  frequency: number,
  resonance = 0.7,
) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = createNoiseBuffer(context, duration);
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, when);
  filter.Q.setValueAtTime(resonance, when);
  gain.gain.setValueAtTime(volume, when);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    when + duration,
  );

  source.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  source.start(when);
  source.stop(when + duration + 0.02);
}

function playClap(
  context: BaseAudioContext,
  output: AudioNode,
  when: number,
) {
  [0, 0.027, 0.054].forEach((offset, index) => {
    playNoise(
      context,
      output,
      when + offset,
      index === 2 ? 0.16 : 0.055,
      0.35,
      "bandpass",
      1450,
      0.8,
    );
  });
}

function scheduleDrumSound(
  context: BaseAudioContext,
  output: AudioNode,
  soundId: DrumSoundId,
  when: number,
) {
  const sampleBuffer =
    customSampleBuffers.get(soundId) ??
    defaultSampleBuffers.get(soundId);

  if (sampleBuffer) {
    playSampleBuffer(context, output, sampleBuffer, when);
    return;
  }

  switch (soundId) {
    case "kick":
      playTone(context, output, when, 155, 44, 0.42, 0.95);
      break;
    case "snare":
      playNoise(context, output, when, 0.2, 0.5, "highpass", 1150);
      playTone(
        context,
        output,
        when,
        185,
        135,
        0.12,
        0.22,
        "triangle",
      );
      break;
    case "closedHat":
      playNoise(
        context,
        output,
        when,
        0.055,
        0.23,
        "highpass",
        6900,
      );
      break;
    case "openHat":
      playNoise(context, output, when, 0.38, 0.2, "highpass", 6500);
      break;
    case "clap":
      playClap(context, output, when);
      break;
    case "rim":
      playTone(
        context,
        output,
        when,
        720,
        420,
        0.07,
        0.28,
        "square",
      );
      break;
    case "tom1":
      playTone(context, output, when, 210, 108, 0.28, 0.55);
      break;
    case "tom2":
      playTone(context, output, when, 145, 72, 0.34, 0.58);
      break;
    case "shaker":
      playNoise(context, output, when, 0.11, 0.22, "bandpass", 5200, 1.8);
      break;
    case "crash":
      playNoise(context, output, when, 0.85, 0.23, "highpass", 4200);
      break;
    case "perc1":
      playTone(
        context,
        output,
        when,
        540,
        260,
        0.15,
        0.38,
        "triangle",
      );
      break;
    case "perc2":
      playTone(context, output, when, 820, 390, 0.12, 0.3);
      break;
    case "user1":
      playTone(
        context,
        output,
        when,
        320,
        90,
        0.3,
        0.42,
        "sawtooth",
      );
      break;
    case "user2":
      playTone(
        context,
        output,
        when,
        980,
        650,
        0.18,
        0.3,
        "triangle",
      );
      break;
    case "user3":
      playNoise(context, output, when, 0.22, 0.28, "bandpass", 2400, 4);
      break;
    case "user4":
      playTone(context, output, when, 1180, 160, 0.45, 0.32);
      break;
  }
}

export function triggerDrumSound(
  soundId: DrumSoundId,
  scheduledTime?: number,
): void {
  const context = getAudioContext();
  const output = getMasterOutput(context);
  const when = Math.max(
    context.currentTime,
    scheduledTime ?? context.currentTime,
  );
  scheduleDrumSound(context, output, soundId, when);
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function audioBufferToWav(buffer: AudioBuffer) {
  const channelCount = buffer.numberOfChannels;
  const bytesPerSample = 2;
  const dataLength =
    buffer.length * channelCount * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(
    28,
    buffer.sampleRate * channelCount * bytesPerSample,
    true,
  );
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataLength, true);

  const channels = Array.from(
    { length: channelCount },
    (_, channelIndex) => buffer.getChannelData(channelIndex),
  );
  let offset = 44;

  for (let frame = 0; frame < buffer.length; frame += 1) {
    for (
      let channelIndex = 0;
      channelIndex < channelCount;
      channelIndex += 1
    ) {
      const sample = Math.max(
        -1,
        Math.min(1, channels[channelIndex][frame]),
      );
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export async function renderBeatToWav({
  pattern,
  trackLengths,
  soundIds,
  bpm,
  durationSeconds,
}: BeatExportOptions) {
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 1 ||
    durationSeconds > 300
  ) {
    throw new Error(
      "Die Exportlänge muss zwischen einer Sekunde und fünf Minuten liegen.",
    );
  }

  await preloadDrumSounds();

  const sampleRate = 44100;
  const stepDuration = 60 / bpm / 4;
  const totalSteps = Math.ceil(durationSeconds / stepDuration);
  const frameCount = Math.ceil(durationSeconds * sampleRate);
  const context = new OfflineAudioContext(
    2,
    frameCount,
    sampleRate,
  );
  const output = createMasterOutput(context);

  for (let tick = 0; tick < totalSteps; tick += 1) {
    const when = tick * stepDuration;
    if (when >= durationSeconds) break;

    soundIds.forEach((soundId, trackIndex) => {
      const track = pattern[trackIndex];
      const length = trackLengths[trackIndex];
      if (!track || !length) return;

      const stepIndex = tick % length;
      if (track[stepIndex]) {
        scheduleDrumSound(context, output, soundId, when);
      }
    });
  }

  const renderedBuffer = await context.startRendering();
  return audioBufferToWav(renderedBuffer);
}
