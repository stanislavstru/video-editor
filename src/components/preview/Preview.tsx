import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore, type Clip } from "../../store/editorStore";
import { DraggableTextOverlays } from "./components/DraggableTextOverlays";
import { TextEditPanel } from "./components/TextEditPanel";
import { PreviewOverlayMessages } from "./components/PreviewOverlayMessages";
import {
  getActiveAudioClips,
  getActiveVisualLayers,
  getMediaTime,
  getVisibleTextLayers,
} from "./previewModel";
import { WebGLPreviewRenderer } from "./webglRenderer";

const SEEK_EPSILON = 0.08;
const AUDIO_SEEK_EPSILON = 0.12;
const PREVIEW_ZONE_INSET_RATIO = 0.04;

interface ZoneRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface VideoInteractionRect {
  clipId: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getPreviewZoneRect(width: number, height: number): ZoneRect {
  const insetX = width * PREVIEW_ZONE_INSET_RATIO;
  const insetY = height * PREVIEW_ZONE_INSET_RATIO;

  return {
    left: insetX,
    top: insetY,
    width: Math.max(1, width - insetX * 2),
    height: Math.max(1, height - insetY * 2),
  };
}

function getVideoRenderRect(
  clip: Clip,
  zone: ZoneRect,
  video?: HTMLVideoElement,
): VideoInteractionRect {
  const videoWidth = video?.videoWidth || zone.width;
  const videoHeight = video?.videoHeight || zone.height;
  const videoAspect = videoWidth / Math.max(1, videoHeight);
  const zoneAspect = zone.width / Math.max(1, zone.height);

  let renderWidth = zone.width;
  let renderHeight = zone.height;

  if (videoAspect > zoneAspect) {
    renderWidth = zone.width;
    renderHeight = zone.width / Math.max(videoAspect, 0.00001);
  } else {
    renderHeight = zone.height;
    renderWidth = zone.height * videoAspect;
  }

  const centerX = zone.left + clamp01(clip.videoX ?? 0.5) * zone.width;
  const centerY = zone.top + clamp01(clip.videoY ?? 0.5) * zone.height;

  return {
    clipId: clip.id,
    left: centerX - renderWidth / 2,
    top: centerY - renderHeight / 2,
    width: renderWidth,
    height: renderHeight,
  };
}

function intersectRects(
  rect: VideoInteractionRect,
  zone: ZoneRect,
): VideoInteractionRect | null {
  const left = Math.max(rect.left, zone.left);
  const top = Math.max(rect.top, zone.top);
  const right = Math.min(rect.left + rect.width, zone.left + zone.width);
  const bottom = Math.min(rect.top + rect.height, zone.top + zone.height);

  if (right <= left || bottom <= top) {
    return null;
  }

  return {
    clipId: rect.clipId,
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function pointInRect(
  pointX: number,
  pointY: number,
  rect: VideoInteractionRect,
): boolean {
  return (
    pointX >= rect.left &&
    pointX <= rect.left + rect.width &&
    pointY >= rect.top &&
    pointY <= rect.top + rect.height
  );
}

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
  const videoDragRef = useRef<{
    clipId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [draggingVideoClipId, setDraggingVideoClipId] = useState<string | null>(
    null,
  );
  const [focusedVideoClipId, setFocusedVideoClipId] = useState<string | null>(
    null,
  );
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [videoLayoutVersion, setVideoLayoutVersion] = useState(0);

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
  const activeAudioClips = useMemo(
    () => getActiveAudioClips(rows, clips, currentTime),
    [rows, clips, currentTime],
  );
  const previewZone = useMemo(
    () => getPreviewZoneRect(containerSize.width, containerSize.height),
    [containerSize],
  );
  const activeVideoRects = useMemo(() => {
    return activeVideoClips.map((clip) => {
      const video = videoRegistryRef.current.get(clip.id)?.element;
      return getVideoRenderRect(clip, previewZone, video);
    });
  }, [activeVideoClips, previewZone, videoLayoutVersion]);
  const activeVisibleVideoRects = useMemo(
    () =>
      activeVideoRects
        .map((rect) => intersectRects(rect, previewZone))
        .filter((rect): rect is VideoInteractionRect => Boolean(rect)),
    [activeVideoRects, previewZone],
  );
  const highlightedVideoRect = useMemo(() => {
    const highlightedId = draggingVideoClipId ?? focusedVideoClipId;
    if (!highlightedId) return null;
    return (
      activeVisibleVideoRects.find((rect) => rect.clipId === highlightedId) ??
      null
    );
  }, [activeVisibleVideoRects, draggingVideoClipId, focusedVideoClipId]);

  const drawActiveFrame = useCallback(() => {
    const renderer = rendererRef.current;
    const container = containerRef.current;
    if (!renderer || !container) return;

    const cssWidth = Math.max(1, container.clientWidth);
    const cssHeight = Math.max(1, container.clientHeight);
    const cssZone = getPreviewZoneRect(cssWidth, cssHeight);
    const dprX = canvasRef.current
      ? canvasRef.current.width / cssWidth
      : window.devicePixelRatio || 1;
    const dprY = canvasRef.current
      ? canvasRef.current.height / cssHeight
      : window.devicePixelRatio || 1;
    const zone = {
      left: cssZone.left * dprX,
      top: cssZone.top * dprY,
      width: cssZone.width * dprX,
      height: cssZone.height * dprY,
    };

    const videos: Array<{ element: HTMLVideoElement; x: number; y: number }> =
      [];
    for (const clip of activeVideoClipsRef.current) {
      const managed = videoRegistryRef.current.get(clip.id);
      if (managed) {
        videos.push({
          element: managed.element,
          x: clamp01(clip.videoX ?? 0.5),
          y: clamp01(clip.videoY ?? 0.5),
        });
      }
    }

    renderer.draw(videos, zone);
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
        const width = container.clientWidth;
        const height = container.clientHeight;

        setContainerSize({ width, height });
        renderer.resize(width * dpr, height * dpr);
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
        setVideoLayoutVersion((value) => value + 1);
      };

      video.addEventListener("loadedmetadata", syncAndDraw);
      video.addEventListener("loadeddata", syncAndDraw);
      video.addEventListener("seeked", drawActiveFrame);
      video.addEventListener("canplay", drawActiveFrame);

      videoRegistryRef.current.set(clip.id, {
        element: video,
        dispose: () => {
          video.removeEventListener("loadedmetadata", syncAndDraw);
          video.removeEventListener("loadeddata", syncAndDraw);
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

      const zoneRect = getPreviewZoneRect(rect.width, rect.height);
      if (zoneRect.width <= 0 || zoneRect.height <= 0) return;

      const pointerX = (clientX - rect.left - zoneRect.left) / zoneRect.width;
      const pointerY = (clientY - rect.top - zoneRect.top) / zoneRect.height;

      updateVideoClipPosition(
        drag.clipId,
        clamp01(pointerX - drag.offsetX),
        clamp01(pointerY - drag.offsetY),
      );
    },
    [updateVideoClipPosition],
  );

  useEffect(() => {
    if (!selectedClipId) {
      setFocusedVideoClipId(null);
      return;
    }

    const isActiveVideo = activeVideoClips.some(
      (clip) => clip.id === selectedClipId,
    );
    if (isActiveVideo) {
      setFocusedVideoClipId(selectedClipId);
    }
  }, [activeVideoClips, selectedClipId]);

  useEffect(() => {
    if (!focusedVideoClipId) return;
    const stillVisible = activeVideoClips.some(
      (clip) => clip.id === focusedVideoClipId,
    );
    if (!stillVisible) {
      setFocusedVideoClipId(null);
    }
  }, [activeVideoClips, focusedVideoClipId]);

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

        <div
          className="pointer-events-none absolute border border-dashed border-white/25"
          style={{
            left: `${previewZone.left}px`,
            top: `${previewZone.top}px`,
            width: `${previewZone.width}px`,
            height: `${previewZone.height}px`,
            zIndex: 900,
          }}
        />

        {highlightedVideoRect && (
          <div
            className="pointer-events-none absolute border-2 border-[#00ff00]"
            style={{
              left: `${highlightedVideoRect.left}px`,
              top: `${highlightedVideoRect.top}px`,
              width: `${highlightedVideoRect.width}px`,
              height: `${highlightedVideoRect.height}px`,
              zIndex: 1300,
            }}
          />
        )}

        {activeVisibleVideoRects.length > 0 && (
          <div
            className={`absolute inset-0 ${draggingVideoClipId ? "cursor-grabbing" : "cursor-grab"}`}
            style={{ zIndex: 1000 }}
            onPointerDown={(e) => {
              const container = containerRef.current;
              if (!container) return;

              const rect = container.getBoundingClientRect();
              if (rect.width <= 0 || rect.height <= 0) return;

              const localX = e.clientX - rect.left;
              const localY = e.clientY - rect.top;
              const hitRect = [...activeVisibleVideoRects]
                .reverse()
                .find((candidate) => pointInRect(localX, localY, candidate));
              if (!hitRect) {
                setFocusedVideoClipId(null);
                return;
              }

              const clip = activeVideoClips.find(
                (item) => item.id === hitRect.clipId,
              );
              if (!clip) return;

              const zoneRect = getPreviewZoneRect(rect.width, rect.height);
              if (zoneRect.width <= 0 || zoneRect.height <= 0) return;

              const pointerX = (localX - zoneRect.left) / zoneRect.width;
              const pointerY = (localY - zoneRect.top) / zoneRect.height;
              const currentX = clamp01(clip.videoX ?? 0.5);
              const currentY = clamp01(clip.videoY ?? 0.5);

              videoDragRef.current = {
                clipId: clip.id,
                offsetX: pointerX - currentX,
                offsetY: pointerY - currentY,
              };
              setDraggingVideoClipId(clip.id);
              setFocusedVideoClipId(clip.id);
              selectClip(clip.id);
              e.currentTarget.setPointerCapture(e.pointerId);
              e.preventDefault();
            }}
            onPointerMove={(e) => {
              if (!videoDragRef.current) {
                return;
              }
              updateDraggedVideoPosition(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              if (videoDragRef.current) {
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
