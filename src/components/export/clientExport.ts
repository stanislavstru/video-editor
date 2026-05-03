import {
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  QUALITY_HIGH,
  QUALITY_VERY_HIGH,
  getFirstEncodableVideoCodec,
  getFirstEncodableAudioCodec,
} from "mediabunny";
import type { Quality } from "mediabunny";

import type { Clip, Row } from "../../store/editorStore";
import { getActiveVisualLayers, getMediaTime } from "../preview/previewModel";

export type ExportQuality = "low" | "medium" | "high" | "very_high";
export type ExportFormat = "auto" | "mp4" | "webm";

const QUALITY_MAP: Record<ExportQuality, Quality> = {
  low: QUALITY_LOW,
  medium: QUALITY_MEDIUM,
  high: QUALITY_HIGH,
  very_high: QUALITY_VERY_HIGH,
};

interface ExportOptions {
  rows: Row[];
  clips: Clip[];
  duration: number;
  fps: number;
  width: number;
  height: number;
  quality?: ExportQuality;
  format?: ExportFormat;
  onProgress?: (value: number) => void;
}

export interface ExportResult {
  blob: Blob;
  extension: string;
}

const PREVIEW_ZONE_INSET_RATIO = 0.04;

interface PreviewZoneRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getPreviewZoneRect(width: number, height: number): PreviewZoneRect {
  const insetX = width * PREVIEW_ZONE_INSET_RATIO;
  const insetY = height * PREVIEW_ZONE_INSET_RATIO;

  return {
    left: insetX,
    top: insetY,
    width: Math.max(1, width - insetX * 2),
    height: Math.max(1, height - insetY * 2),
  };
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

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

function drawVideoInPreviewZone(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  video: HTMLVideoElement,
  zone: PreviewZoneRect,
) {
  const videoWidth = video.videoWidth || zone.width;
  const videoHeight = video.videoHeight || zone.height;
  const sourceRatio = videoWidth / Math.max(1, videoHeight);
  const targetRatio = zone.width / Math.max(1, zone.height);

  let drawWidth = zone.width;
  let drawHeight = zone.height;

  if (sourceRatio > targetRatio) {
    drawWidth = zone.width;
    drawHeight = zone.width / Math.max(sourceRatio, 0.00001);
  } else {
    drawHeight = zone.height;
    drawWidth = zone.height * sourceRatio;
  }

  const centerX = zone.left + clamp01(clip.videoX ?? 0.5) * zone.width;
  const centerY = zone.top + clamp01(clip.videoY ?? 0.5) * zone.height;
  const dx = centerX - drawWidth / 2;
  const dy = centerY - drawHeight / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(zone.left, zone.top, zone.width, zone.height);
  ctx.clip();
  ctx.drawImage(video, dx, dy, drawWidth, drawHeight);
  ctx.restore();
}

async function renderFrameAtTime(
  rows: Row[],
  clips: Clip[],
  currentTime: number,
  videoElements: Map<string, HTMLVideoElement>,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const activeLayers = getActiveVisualLayers(rows, clips, currentTime);
  const activeVideos = activeLayers.filter((clip) => clip.type === "video");

  const seekTasks: Promise<void>[] = [];
  for (const clip of activeVideos) {
    const video = videoElements.get(clip.id);
    if (!video) continue;
    const mediaTime = getMediaTime(clip, currentTime);
    seekTasks.push(seekVideoToTime(video, mediaTime));
  }

  await Promise.all(seekTasks);

  drawBackground(ctx, width, height);
  const previewZone = getPreviewZoneRect(width, height);

  let textFallbackIndex = 0;
  for (const clip of activeLayers) {
    if (clip.type === "video") {
      const video = videoElements.get(clip.id);
      if (!video) continue;
      drawVideoInPreviewZone(ctx, clip, video, previewZone);
      continue;
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fallbackY = 0.84 - textFallbackIndex * 0.1;
    const x = Math.max(0, Math.min(1, clip.textX ?? 0.5)) * width;
    const y = Math.max(0, Math.min(1, clip.textY ?? fallbackY)) * height;

    ctx.font = `500 ${clip.textSize ?? 18}px sans-serif`;
    ctx.fillStyle = clip.textColor ?? "#ffffff";
    ctx.fillText(clip.label, x, y);
    textFallbackIndex += 1;
  }
}

// ─── Audio helpers ────────────────────────────────────────────────────────────

/**
 * Renders all non-muted audio/video clips into a single AudioBuffer using
 * OfflineAudioContext. Returns null if there is no audio to render.
 */
async function mixAudioOffline(
  rows: Row[],
  clips: Clip[],
  duration: number,
): Promise<AudioBuffer | null> {
  const mutedRowIds = new Set(rows.filter((r) => r.muted).map((r) => r.id));

  const audioClips = clips.filter(
    (c) =>
      (c.type === "video" || c.type === "audio") &&
      !!c.src &&
      !mutedRowIds.has(c.rowId),
  );

  if (audioClips.length === 0) return null;

  const sampleRate = 48000;
  const frameCount = Math.ceil(duration * sampleRate);
  const offlineCtx = new OfflineAudioContext(2, frameCount, sampleRate);

  const bufferCache = new Map<string, AudioBuffer | null>();

  for (const clip of audioClips) {
    const src = clip.src!;
    if (bufferCache.has(src)) continue;
    try {
      const resp = await fetch(src);
      if (!resp.ok) {
        bufferCache.set(src, null);
        continue;
      }
      const arrayBuffer = await resp.arrayBuffer();
      const buffer = await offlineCtx.decodeAudioData(arrayBuffer);
      bufferCache.set(src, buffer);
    } catch {
      // No decodable audio in this file — skip silently.
      bufferCache.set(src, null);
    }
  }

  let hasAudio = false;

  for (const clip of audioClips) {
    const buffer = bufferCache.get(clip.src!);
    if (!buffer) continue;

    const offset = Math.max(0, clip.trimStart);
    const available = Math.max(0, buffer.duration - offset);
    const playDuration = Math.min(clip.duration, available);
    if (playDuration <= 0) continue;

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start(clip.start, offset, playDuration);
    hasAudio = true;
  }

  if (!hasAudio) return null;

  return offlineCtx.startRendering();
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function exportTimeline(
  options: ExportOptions,
): Promise<ExportResult> {
  const {
    rows,
    clips,
    duration,
    fps,
    width,
    height,
    quality = "high",
    format = "auto",
    onProgress,
  } = options;

  const qualityValue = QUALITY_MAP[quality];

  // Pick the best available codecs via WebCodecs
  const preferMp4 = format === "mp4" || format === "auto";
  const videoCodecPriority: ("avc" | "vp9" | "vp8")[] = preferMp4
    ? ["avc", "vp9", "vp8"]
    : ["vp9", "vp8", "avc"];
  const videoCodec = await getFirstEncodableVideoCodec(videoCodecPriority);
  if (!videoCodec) {
    throw new Error(
      "No supported video codec found. Use a modern browser with WebCodecs support.",
    );
  }

  const audioCodec = await getFirstEncodableAudioCodec(["aac", "opus"]);
  if (!audioCodec) {
    throw new Error(
      "No supported audio codec found. Use a modern browser with WebCodecs support.",
    );
  }

  // Respect forced format; otherwise derive from codec
  const usesMp4 =
    format === "mp4" || (format === "auto" && videoCodec === "avc");
  const extension = usesMp4 ? "mp4" : "webm";

  // ── Setup canvas ──────────────────────────────────────────────────────────
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create 2D canvas context");

  // ── Load video elements ───────────────────────────────────────────────────
  const videoClips = clips.filter((c) => c.type === "video" && c.src);
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

  // ── Mix audio offline (faster than realtime) ──────────────────────────────
  const mixedAudio = await mixAudioOffline(rows, clips, duration);

  // ── Setup Mediabunny output ───────────────────────────────────────────────
  const target = new BufferTarget();
  const output = new Output({
    format: usesMp4 ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target,
  });

  const videoSource = new CanvasSource(canvas, {
    codec: videoCodec,
    bitrate: qualityValue,
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: AudioBufferSource | null = null;
  if (mixedAudio) {
    audioSource = new AudioBufferSource({
      codec: audioCodec,
      bitrate: qualityValue,
    });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  // Add the fully-mixed audio buffer (starts at t=0, same as video)
  if (audioSource && mixedAudio) {
    await audioSource.add(mixedAudio);
    audioSource.close();
  }

  // ── Render frames as fast as possible ────────────────────────────────────
  const frameDuration = 1 / fps;
  const totalFrames = Math.max(1, Math.ceil(duration * fps));

  for (let i = 0; i < totalFrames; i++) {
    const t = i * frameDuration;
    await renderFrameAtTime(rows, clips, t, videoElements, ctx, width, height);
    // CanvasSource captures the canvas state at the time of this call
    await videoSource.add(t, frameDuration);
    onProgress?.((i + 1) / totalFrames);
  }

  videoSource.close();

  // ── Cleanup ───────────────────────────────────────────────────────────────
  for (const video of videoElements.values()) {
    video.pause();
    video.src = "";
  }

  await output.finalize();

  const buffer = target.buffer;
  if (!buffer) throw new Error("Export produced no data");

  const mimeType = usesMp4 ? "video/mp4" : "video/webm";
  const blob = new Blob([buffer], { type: mimeType });

  return { blob, extension };
}
