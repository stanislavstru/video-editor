import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore, type Clip } from "../../store/editorStore";
import { DraggableTextOverlays } from "./components/DraggableTextOverlays";
import { TextEditPanel } from "./components/TextEditPanel";
import { PreviewOverlayMessages } from "./components/PreviewOverlayMessages";
import {
  getActiveAudioClips,
  getActiveVisualLayers,
  getMediaTime,
  getTopVisibleVideoLayer,
  getVisibleTextLayers,
} from "./previewModel";
import { WebGLPreviewRenderer } from "./webglRenderer";

const SEEK_EPSILON = 0.08;
const AUDIO_SEEK_EPSILON = 0.12;

interface ManagedVideo {
  element: HTMLVideoElement;
  dispose: () => void;
}

interface ManagedAudio {
  element: HTMLAudioElement;
  dispose: () => void;
}

export const Preview = () => {
  const rows = useEditorStore((s) => s.rows);
  const clips = useEditorStore((s) => s.clips);
  const currentTime = useEditorStore((s) => s.currentTime);
  const playing = useEditorStore((s) => s.playing);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectClip = useEditorStore((s) => s.selectClip);
  const updateTextClipPosition = useEditorStore(
    (s) => s.updateTextClipPosition,
  );
  const updateVideoClipPosition = useEditorStore(
    (s) => s.updateVideoClipPosition,
  );
  const deleteClip = useEditorStore((s) => s.deleteClip);
  const updateClipLabel = useEditorStore((s) => s.updateClipLabel);
  const updateTextClipStyle = useEditorStore((s) => s.updateTextClipStyle);

  const [editingClipId, setEditingClipId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLPreviewRenderer | null>(null);
  const videoRegistryRef = useRef<Map<string, ManagedVideo>>(new Map());
  const audioRegistryRef = useRef<Map<string, ManagedAudio>>(new Map());
  const desiredMediaTimesRef = useRef<Map<string, number>>(new Map());
  const desiredAudioTimesRef = useRef<Map<string, number>>(new Map());
  const activeVideoClipsRef = useRef<Clip[]>([]);
  const rafRef = useRef<number | null>(null);
  const videoDragRef = useRef<
    | {
        clipId: string;
        offsetX: number;
        offsetY: number;
      }
    | null
  >(null);
  const [draggingVideoClipId, setDraggingVideoClipId] = useState<string | null>(
    null,
  );

  const [initError, setInitError] = useState<string | null>(null);

  const rowOrderById = useMemo(
    () => new Map(rows.map((row, index) => [row.id, index])),
    [rows],
  );
  const activeVisualLayers = useMemo(
    () => getActiveVisualLayers(rows, clips, currentTime),
    [rows, clips, currentTime],
  );
  const activeVideoClips = useMemo(
    () => activeVisualLayers.filter((clip) => clip.type === "video"),
    [activeVisualLayers],
  );
  const activeTextClips = useMemo(
    () => getVisibleTextLayers(rows, clips, currentTime),
    [rows, clips, currentTime],
  );
  const topVisibleVideoClip = useMemo(
    () => getTopVisibleVideoLayer(rows, clips, currentTime),
    [rows, clips, currentTime],
  );
  const activeAudioClips = useMemo(
    () => getActiveAudioClips(rows, clips, currentTime),
    [rows, clips, currentTime],
  );

  const drawActiveFrame = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const videos: Array<{ element: HTMLVideoElement; x: number; y: number }> =
      [];
    for (const clip of activeVideoClipsRef.current) {
      const managed = videoRegistryRef.current.get(clip.id);
      if (managed) {
        videos.push({
          element: managed.element,
          x: Math.max(0, Math.min(1, clip.videoX ?? 0.5)),
          y: Math.max(0, Math.min(1, clip.videoY ?? 0.5)),
        });
      }
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
      const message =
        error instanceof Error ? error.message : "Failed to init WebGL";
      queueMicrotask(() => {
        setInitError(message);
      });
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

  useEffect(() => {
    const registry = audioRegistryRef.current;
    const existingIds = new Set(
      clips
        .filter(
          (clip) =>
            (clip.type === "audio" || clip.type === "video") && !!clip.src,
        )
        .map((clip) => clip.id),
    );

    for (const [clipId, audio] of registry.entries()) {
      if (!existingIds.has(clipId)) {
        audio.dispose();
        desiredAudioTimesRef.current.delete(clipId);
        registry.delete(clipId);
      }
    }
  }, [clips]);

  const getOrCreateVideo = useCallback(
    (clip: Clip): HTMLVideoElement | null => {
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
    },
    [drawActiveFrame],
  );

  const getOrCreateAudio = useCallback(
    (clip: Clip): HTMLAudioElement | null => {
      if (!clip.src) return null;

      const existing = audioRegistryRef.current.get(clip.id);
      if (existing) return existing.element;

      const audio = document.createElement("audio");
      audio.src = clip.src;
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";

      audioRegistryRef.current.set(clip.id, {
        element: audio,
        dispose: () => {
          audio.pause();
          audio.src = "";
        },
      });

      return audio;
    },
    [],
  );

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
  }, [
    activeVideoClips,
    currentTime,
    drawActiveFrame,
    getOrCreateVideo,
    playing,
  ]);

  useEffect(() => {
    const activeIds = new Set(activeAudioClips.map((clip) => clip.id));

    for (const [clipId, managed] of audioRegistryRef.current.entries()) {
      if (!activeIds.has(clipId)) {
        managed.element.pause();
      }
    }

    for (const clip of activeAudioClips) {
      const audio = getOrCreateAudio(clip);
      if (!audio) continue;

      const targetTime = getMediaTime(clip, currentTime);
      desiredAudioTimesRef.current.set(clip.id, targetTime);
      if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
        if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON) {
          try {
            audio.currentTime = targetTime;
          } catch {
            // Ignore transient seek errors while media is loading.
          }
        }
      }

      if (playing) {
        void audio.play().catch(() => {
          // Ignore autoplay restrictions until user interaction occurs.
        });
      } else {
        audio.pause();
      }
    }
  }, [activeAudioClips, currentTime, getOrCreateAudio, playing]);

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

  const updateDraggedVideoPosition = useCallback(
    (clientX: number, clientY: number) => {
      const drag = videoDragRef.current;
      const container = containerRef.current;
      if (!drag || !container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const pointerX = (clientX - rect.left) / rect.width;
      const pointerY = (clientY - rect.top) / rect.height;

      updateVideoClipPosition(
        drag.clipId,
        Math.max(0, Math.min(1, pointerX - drag.offsetX)),
        Math.max(0, Math.min(1, pointerY - drag.offsetY)),
      );
    },
    [updateVideoClipPosition],
  );

  useEffect(() => {
    const videoRegistry = videoRegistryRef.current;
    const audioRegistry = audioRegistryRef.current;
    const desiredMediaTimes = desiredMediaTimesRef.current;
    const desiredAudioTimes = desiredAudioTimesRef.current;

    return () => {
      for (const managed of videoRegistry.values()) {
        managed.dispose();
      }
      for (const managed of audioRegistry.values()) {
        managed.dispose();
      }
      videoRegistry.clear();
      audioRegistry.clear();
      desiredMediaTimes.clear();
      desiredAudioTimes.clear();
    };
  }, []);

  return (
    <section className="relative flex h-full w-full items-center justify-center p-6">
      <div
        ref={containerRef}
        className="relative w-full max-w-5xl overflow-hidden border border-border bg-black"
        style={{ aspectRatio: "16 / 9" }}
      >
        <canvas ref={canvasRef} className="h-full w-full" />

        {topVisibleVideoClip && selectedClipId === topVisibleVideoClip.id && (
          <div
            className={`absolute inset-0 ${draggingVideoClipId === topVisibleVideoClip.id ? "cursor-grabbing" : "cursor-grab"}`}
            style={{ zIndex: 1000 }}
            onPointerDown={(e) => {
              const container = containerRef.current;
              if (!container) return;

              const rect = container.getBoundingClientRect();
              if (rect.width <= 0 || rect.height <= 0) return;

              const clip = topVisibleVideoClip;
              const pointerX = (e.clientX - rect.left) / rect.width;
              const pointerY = (e.clientY - rect.top) / rect.height;
              const currentX = Math.max(0, Math.min(1, clip.videoX ?? 0.5));
              const currentY = Math.max(0, Math.min(1, clip.videoY ?? 0.5));

              videoDragRef.current = {
                clipId: clip.id,
                offsetX: pointerX - currentX,
                offsetY: pointerY - currentY,
              };
              setDraggingVideoClipId(clip.id);
              selectClip(clip.id);
              e.currentTarget.setPointerCapture(e.pointerId);
              e.preventDefault();
            }}
            onPointerMove={(e) => {
              if (videoDragRef.current?.clipId !== topVisibleVideoClip.id) {
                return;
              }
              updateDraggedVideoPosition(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              if (videoDragRef.current?.clipId === topVisibleVideoClip.id) {
                updateDraggedVideoPosition(e.clientX, e.clientY);
              }
              videoDragRef.current = null;
              setDraggingVideoClipId(null);
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
            onPointerCancel={(e) => {
              videoDragRef.current = null;
              setDraggingVideoClipId(null);
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
          />
        )}

        <DraggableTextOverlays
          activeTextClips={activeTextClips}
          selectedClipId={selectedClipId}
          rowOrderById={rowOrderById}
          containerRef={containerRef}
          onUpdateTextClipPosition={updateTextClipPosition}
          onDeleteClip={deleteClip}
          onOpenEditor={(clipId) => setEditingClipId(clipId)}
        />

        <PreviewOverlayMessages
          initError={initError}
          hasActiveVideos={activeVideoClips.length > 0}
        />
      </div>

      {editingClipId !== null &&
        (() => {
          const clip = activeTextClips.find((c) => c.id === editingClipId);
          if (!clip) return null;
          return (
            <TextEditPanel
              key={editingClipId}
              clip={clip}
              onClose={() => setEditingClipId(null)}
              onUpdateLabel={(label) => updateClipLabel(editingClipId, label)}
              onUpdateStyle={(color, size) =>
                updateTextClipStyle(editingClipId, color, size)
              }
            />
          );
        })()}
    </section>
  );
};
