export const MUSIC_TRACK = Object.freeze({
  id: "afterglow-action-loop-v1",
  url: "/audio/afterglow-action-loop-v1.mp3",
  durationSeconds: 74.254,
});

export const AUDIO_SAMPLE_URLS = Object.freeze({
  "blast-small": "/audio/blast-small.wav",
  "blast-medium": "/audio/blast-medium.wav",
  "blast-large": "/audio/blast-large.wav",
  "blast-low": "/audio/blast-low.wav",
  "impact-soil": "/audio/impact-soil.wav",
  "impact-rock": "/audio/impact-rock.wav",
  "impact-hull": "/audio/impact-hull.wav",
  "shield-field": "/audio/shield-field.wav",
  "laser-small": "/audio/laser-small.wav",
  "laser-large": "/audio/laser-large.wav",
  "launch-thruster": "/audio/launch-thruster.wav",
  "fire-whoosh": "/audio/fire-whoosh.wav",
});

export type AudioSampleId = keyof typeof AUDIO_SAMPLE_URLS;

export const AUDIO_SAMPLE_IDS = Object.freeze(
  Object.keys(AUDIO_SAMPLE_URLS) as AudioSampleId[],
);

export interface AudioAssetLoader {
  loadMusic(
    context: AudioContext,
    signal?: AbortSignal,
  ): Promise<AudioBuffer>;
  loadSample(
    context: AudioContext,
    sampleId: AudioSampleId,
    signal?: AbortSignal,
  ): Promise<AudioBuffer>;
}

async function fetchAndDecode(
  context: AudioContext,
  url: string,
  signal?: AbortSignal,
): Promise<AudioBuffer> {
  const response = await fetch(url, {
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Audio asset ${url} returned HTTP ${response.status}.`);
  }
  const encoded = await response.arrayBuffer();
  return context.decodeAudioData(encoded.slice(0));
}

export function createHttpAudioAssetLoader(): AudioAssetLoader {
  return {
    loadMusic: (context, signal) =>
      fetchAndDecode(context, MUSIC_TRACK.url, signal),
    loadSample: (context, sampleId, signal) =>
      fetchAndDecode(context, AUDIO_SAMPLE_URLS[sampleId], signal),
  };
}
