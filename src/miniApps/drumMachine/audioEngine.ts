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

interface BeatExportOptions {
  pattern: boolean[][];
  trackLengths: number[];
  soundIds: DrumSoundId[];
  bpm: number;
  bars?: number;
}

let audioContext: AudioContext | null = null;
let masterOutput: AudioNode | null = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  return audioContext;
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

export async function prepareAudio() {
  const context = getAudioContext();

  if (context.state === "suspended") {
    await context.resume();
  }

  return context;
}

function createNoiseBuffer(
  context: BaseAudioContext,
  duration: number,
) {
  const frameCount = Math.ceil(
    context.sampleRate * duration,
  );

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

  oscillator.frequency.setValueAtTime(
    startFrequency,
    when,
  );

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
  switch (soundId) {
    case "kick":
      playTone(
        context,
        output,
        when,
        155,
        44,
        0.42,
        0.95,
      );
      break;

    case "snare":
      playNoise(
        context,
        output,
        when,
        0.2,
        0.5,
        "highpass",
        1150,
      );

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
      playNoise(
        context,
        output,
        when,
        0.38,
        0.2,
        "highpass",
        6500,
      );
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
      playTone(
        context,
        output,
        when,
        210,
        108,
        0.28,
        0.55,
      );
      break;

    case "tom2":
      playTone(
        context,
        output,
        when,
        145,
        72,
        0.34,
        0.58,
      );
      break;

    case "shaker":
      playNoise(
        context,
        output,
        when,
        0.11,
        0.22,
        "bandpass",
        5200,
        1.8,
      );
      break;

    case "crash":
      playNoise(
        context,
        output,
        when,
        0.85,
        0.23,
        "highpass",
        4200,
      );
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
      playTone(
        context,
        output,
        when,
        820,
        390,
        0.12,
        0.3,
      );
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
      playNoise(
        context,
        output,
        when,
        0.22,
        0.28,
        "bandpass",
        2400,
        4,
      );
      break;

    case "user4":
      playTone(
        context,
        output,
        when,
        1180,
        160,
        0.45,
        0.32,
      );
      break;
  }
}

export async function triggerDrumSound(
  soundId: DrumSoundId,
  scheduledTime?: number,
) {
  const context = await prepareAudio();
  const output = getMasterOutput(context);
  const when = scheduledTime ?? context.currentTime;

  scheduleDrumSound(
    context,
    output,
    soundId,
    when,
  );
}

function writeAscii(
  view: DataView,
  offset: number,
  value: string,
) {
  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    view.setUint8(
      offset + index,
      value.charCodeAt(index),
    );
  }
}

function audioBufferToWav(
  buffer: AudioBuffer,
) {
  const channelCount =
    buffer.numberOfChannels;

  const bytesPerSample = 2;

  const dataLength =
    buffer.length *
    channelCount *
    bytesPerSample;

  const arrayBuffer =
    new ArrayBuffer(44 + dataLength);

  const view = new DataView(arrayBuffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(
    4,
    36 + dataLength,
    true,
  );

  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");

  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);

  view.setUint16(
    22,
    channelCount,
    true,
  );

  view.setUint32(
    24,
    buffer.sampleRate,
    true,
  );

  view.setUint32(
    28,
    buffer.sampleRate *
      channelCount *
      bytesPerSample,
    true,
  );

  view.setUint16(
    32,
    channelCount * bytesPerSample,
    true,
  );

  view.setUint16(34, 16, true);

  writeAscii(view, 36, "data");

  view.setUint32(
    40,
    dataLength,
    true,
  );

  const channels = Array.from(
    { length: channelCount },
    (_, channelIndex) =>
      buffer.getChannelData(channelIndex),
  );

  let offset = 44;

  for (
    let frame = 0;
    frame < buffer.length;
    frame += 1
  ) {
    for (
      let channelIndex = 0;
      channelIndex < channelCount;
      channelIndex += 1
    ) {
      const sample = Math.max(
        -1,
        Math.min(
          1,
          channels[channelIndex][frame],
        ),
      );

      view.setInt16(
        offset,
        sample < 0
          ? sample * 0x8000
          : sample * 0x7fff,
        true,
      );

      offset += bytesPerSample;
    }
  }

  return new Blob(
    [arrayBuffer],
    { type: "audio/wav" },
  );
}

export async function renderBeatToWav({
  pattern,
  trackLengths,
  soundIds,
  bpm,
  bars = 4,
}: BeatExportOptions) {
  const sampleRate = 44100;
  const stepDuration = 60 / bpm / 4;
  const totalSteps = 16 * bars;
  const tailDuration = 1;

  const totalDuration =
    totalSteps *
      stepDuration +
    tailDuration;

  const frameCount = Math.ceil(
    totalDuration * sampleRate,
  );

  const context =
    new OfflineAudioContext(
      2,
      frameCount,
      sampleRate,
    );

  const output =
    createMasterOutput(context);

  for (
    let tick = 0;
    tick < totalSteps;
    tick += 1
  ) {
    const when =
      tick * stepDuration;

    soundIds.forEach(
      (soundId, trackIndex) => {
        const track =
          pattern[trackIndex];

        const length =
          trackLengths[trackIndex];

        if (!track || !length) {
          return;
        }

        const stepIndex =
          tick % length;

        if (track[stepIndex]) {
          scheduleDrumSound(
            context,
            output,
            soundId,
            when,
          );
        }
      },
    );
  }

  const renderedBuffer =
    await context.startRendering();

  return audioBufferToWav(
    renderedBuffer,
  );
}