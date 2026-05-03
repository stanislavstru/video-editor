import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore, type Clip } from "../../store/editorStore";
import {
  getActiveTextClips,
  getActiveVideoLayers,
  getMediaTime,
} from "./previewModel";
import { WebGLPreviewRenderer } from "./webglRenderer";

const SEEK_EPSILON = 0.08;

interface ManagedVideo {
  element: HTMLVideoElement;
  dispose: () => void;
}

export const Preview = () => {
  const rows = useEditorStore((s) => s.rows);
  const clips = useEditorStore((s) => s.clips);
  const currentTime = useEditorStore((s) => s.currentTime);
  const playing = useEditorStore((s) => s.playing);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLPreviewRenderer | null>(null);
  const videoRegistryRef = useRef<Map<string, ManagedVideo>>(new Map());
  const desiredMediaTimesRef = useRef<Map<string, number>>(new Map());
  const activeVideoClipsRef = useRef<Clip[]>([]);
  const rafRef = useRef<number | null>(null);

  const [initError, setInitError] = useState<string | null>(null);

  const activeVideoClips = useMemo(
    () => getActiveVideoLayers(rows, clips, currentTime),
    [rows, clips, currentTime],
  );
  const activeTextClips = useMemo(
    () => getActiveTextClips(clips, currentTime),
    [clips, currentTime],
  );

  const drawActiveFrame = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const videos: HTMLVideoElement[] = [];
    for (const clip of activeVideoClipsRef.current) {
      const managed = videoRegistryRef.current.get(clip.id);
      if (managed) videos.push(managed.element);
    }

    renderer.draw(videos);
  }, []);

  useEffect(() => {
    activeVideoClipsRef.current = activeVideoClips;
  }, [activeVideoClips]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    try {
      const renderer = new WebGLPreviewRenderer(canvas);
      rendererRef.current = renderer;

      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        renderer.resize(
          container.clientWidth * dpr,
          container.clientHeight * dpr,
        );
      };

      resize();
      drawActiveFrame();

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);

      return () => {
        resizeObserver.disconnect();
        renderer.dispose();
        rendererRef.current = null;
      };
    } catch (error) {
      setInitError(
        error instanceof Error ? error.message : "Failed to init WebGL",
      );
    }
  }, [drawActiveFrame]);

  useEffect(() => {
    const registry = videoRegistryRef.current;
    const existingIds = new Set(
      clips
        .filter((clip) => clip.type === "video" && clip.src)
        .map((clip) => clip.id),
    );

    for (const [clipId, video] of registry.entries()) {
      if (!existingIds.has(clipId)) {
        video.dispose();
        desiredMediaTimesRef.current.delete(clipId);
        registry.delete(clipId);
      }
    }
  }, [clips]);

  const getOrCreateVideo = (clip: Clip): HTMLVideoElement | null => {
    if (!clip.src) return null;

    const existing = videoRegistryRef.current.get(clip.id);
    if (existing) return existing.element;

    const video = document.createElement("video");
    video.src = clip.src;
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    const syncAndDraw = () => {
      const desired = desiredMediaTimesRef.current.get(clip.id);
      if (
        typeof desired === "number" &&
        video.readyState >= HTMLMediaElement.HAVE_METADATA
      ) {
        if (Math.abs(video.currentTime - desired) > SEEK_EPSILON) {
          try {
            video.currentTime = desired;
          } catch {
            // Ignore seek errors while metadata is still stabilizing.
          }
        }
      }
      drawActiveFrame();
    };

    video.addEventListener("loadedmetadata", syncAndDraw);
    video.addEventListener("seeked", drawActiveFrame);
    video.addEventListener("canplay", drawActiveFrame);

    videoRegistryRef.current.set(clip.id, {
      element: video,
      dispose: () => {
        video.removeEventListener("loadedmetadata", syncAndDraw);
        video.removeEventListener("seeked", drawActiveFrame);
        video.removeEventListener("canplay", drawActiveFrame);
        video.pause();
        video.src = "";
      },
    });
    return video;
  };

  useEffect(() => {
    const activeIds = new Set(activeVideoClips.map((clip) => clip.id));

    for (const [clipId, managed] of videoRegistryRef.current.entries()) {
      if (!activeIds.has(clipId)) {
        managed.element.pause();
      }
    }

    for (const clip of activeVideoClips) {
      const video = getOrCreateVideo(clip);
      if (!video) continue;

      const targetTime = getMediaTime(clip, currentTime);
      desiredMediaTimesRef.current.set(clip.id, targetTime);
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        if (Math.abs(video.currentTime - targetTime) > SEEK_EPSILON) {
          try {
            video.currentTime = targetTime;
          } catch {
            // Ignore transient seek errors.
          }
        }
      }

      if (playing) {
        void video.play().catch(() => {
          // Ignore browser autoplay restrictions for now.
        });
      } else {
        video.pause();
      }
    }

    drawActiveFrame();
  }, [activeVideoClips, currentTime, drawActiveFrame, playing]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = () => {
      drawActiveFrame();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [drawActiveFrame, playing]);

  useEffect(() => {
    return () => {
      for (const managed of videoRegistryRef.current.values()) {
        managed.dispose();
      }
      videoRegistryRef.current.clear();
      desiredMediaTimesRef.current.clear();
    };
  }, []);

  return (
    <section className="flex h-full w-full items-center justify-center p-6">
      <div
        ref={containerRef}
        className="relative w-full max-w-5xl overflow-hidden border border-border bg-black"
        style={{ aspectRatio: "16 / 9" }}
      >
        <canvas ref={canvasRef} className="h-full w-full" />

        {activeTextClips.length > 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end gap-2 px-8 pb-8">
            {activeTextClips.map((clip) => (
              <div
                key={clip.id}
                className="max-w-full rounded bg-black/55 px-3 py-1.5 text-center text-lg font-medium text-white backdrop-blur-sm"
              >
                {clip.label}
              </div>
            ))}
          </div>
        )}

        {!initError && activeVideoClips.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded border border-white/20 bg-black/45 px-4 py-2 text-sm text-white/90">
              Add video clips to see layered preview
            </div>
          </div>
        )}

        {initError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center text-sm text-white">
            WebGL preview is unavailable: {initError}
          </div>
        )}
      </div>
    </section>
  );
};
