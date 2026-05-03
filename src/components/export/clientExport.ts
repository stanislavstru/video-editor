import type { Clip, Row } from "../../store/editorStore";
import {
  getActiveTextClips,
  getActiveVideoLayers,
  getMediaTime,
} from "../preview/previewModel";

interface ExportOptions {
  rows: Row[];
  clips: Clip[];
  duration: number;
  fps: number;
  width: number;
  height: number;
  onProgress?: (value: number) => void;
}

function sleepFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked, { once: true });
  });
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onLoaded = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Failed to load video metadata"));
    };

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };

    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  throw new Error("This browser does not support WebM recording");
}

function createRecorder(stream: MediaStream): {
  recorder: MediaRecorder;
  chunks: BlobPart[];
} {
  const mimeType = pickMimeType();
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  return { recorder, chunks };
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#161925");
  gradient.addColorStop(1, "#0b0e16");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawVideoContain(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const videoWidth = video.videoWidth || width;
  const videoHeight = video.videoHeight || height;
  const sourceRatio = videoWidth / Math.max(1, videoHeight);
  const targetRatio = width / Math.max(1, height);

  let drawWidth = width;
  let drawHeight = height;

  if (sourceRatio > targetRatio) {
    drawHeight = width / sourceRatio;
  } else {
    drawWidth = height * sourceRatio;
  }

  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(video, x, y, drawWidth, drawHeight);
}

function drawTextOverlays(
  ctx: CanvasRenderingContext2D,
  textClips: Clip[],
  width: number,
  height: number,
) {
  if (textClips.length === 0) return;

  const maxWidth = width * 0.82;
  const lineHeight = 40;
  const boxPaddingX = 18;
  const boxPaddingY = 10;

  ctx.font = "600 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const baseY = height - 70;

  textClips.forEach((clip, index) => {
    const text = clip.label;
    const textWidth = Math.min(maxWidth, ctx.measureText(text).width);
    const boxWidth = textWidth + boxPaddingX * 2;
    const boxHeight = lineHeight + boxPaddingY * 2;
    const x = width / 2;
    const y = baseY - index * (boxHeight + 10);

    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.beginPath();
    ctx.roundRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight, 10);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x, y + 1);
  });
}

async function seekVideoToTime(
  video: HTMLVideoElement,
  time: number,
): Promise<void> {
  const clamped = Number.isFinite(video.duration)
    ? Math.max(0, Math.min(time, Math.max(0, video.duration - 0.001)))
    : Math.max(0, time);

  if (Math.abs(video.currentTime - clamped) < 0.02) {
    return;
  }

  const seekPromise = waitForSeek(video);
  video.currentTime = clamped;
  await seekPromise;
}

export async function exportTimelineToWebM(
  options: ExportOptions,
): Promise<Blob> {
  const { rows, clips, duration, fps, width, height, onProgress } = options;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create 2D canvas context");
  }

  const stream = canvas.captureStream(fps);
  const { recorder, chunks } = createRecorder(stream);

  const videoClips = clips.filter((clip) => clip.type === "video" && clip.src);
  const videoElements = new Map<string, HTMLVideoElement>();

  for (const clip of videoClips) {
    const video = document.createElement("video");
    video.src = clip.src!;
    video.muted = true;
    video.preload = "auto";
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    await waitForMetadata(video);
    videoElements.set(clip.id, video);
  }

  recorder.start();

  const frameDuration = 1 / fps;
  const totalFrames = Math.max(1, Math.ceil(duration * fps));

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
    const t = frameIndex * frameDuration;
    const activeVideos = getActiveVideoLayers(rows, clips, t);
    const activeTexts = getActiveTextClips(clips, t);

    const seekTasks: Promise<void>[] = [];
    for (const clip of activeVideos) {
      const video = videoElements.get(clip.id);
      if (!video) continue;
      const mediaTime = getMediaTime(clip, t);
      seekTasks.push(seekVideoToTime(video, mediaTime));
    }

    await Promise.all(seekTasks);

    drawBackground(ctx, width, height);
    for (const clip of activeVideos) {
      const video = videoElements.get(clip.id);
      if (!video) continue;
      drawVideoContain(ctx, video, width, height);
    }
    drawTextOverlays(ctx, activeTexts, width, height);

    onProgress?.((frameIndex + 1) / totalFrames);

    await sleepFrame();
    await wait(frameDuration * 1000);
  }

  const result = await new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const mimeType = recorder.mimeType || "video/webm";
      resolve(new Blob(chunks, { type: mimeType }));
    };
    recorder.onerror = () => {
      reject(new Error("MediaRecorder failed during export"));
    };
    recorder.stop();
  });

  for (const video of videoElements.values()) {
    video.pause();
    video.src = "";
  }

  stream.getTracks().forEach((track) => track.stop());

  return result;
}
