import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Clip } from "../../../store/editorStore";

interface DraggableTextOverlaysProps {
  activeTextClips: Clip[];
  selectedClipId: string | null;
  containerRef: RefObject<HTMLDivElement | null>;
  onUpdateTextClipPosition: (clipId: string, x: number, y: number) => void;
}

type DragState = {
  clipId: string;
  offsetX: number;
  offsetY: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getTextPosition(clip: Clip, index: number) {
  const fallbackY = 0.84 - index * 0.1;
  return {
    x: clamp01(clip.textX ?? 0.5),
    y: clamp01(clip.textY ?? fallbackY),
  };
}

export function DraggableTextOverlays({
  activeTextClips,
  selectedClipId,
  containerRef,
  onUpdateTextClipPosition,
}: DraggableTextOverlaysProps) {
  const textDragRef = useRef<DragState | null>(null);
  const textElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastAutoFocusedClipIdRef = useRef<string | null>(null);
  const [draggingTextClipId, setDraggingTextClipId] = useState<string | null>(
    null,
  );
  const [focusedTextClipId, setFocusedTextClipId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!selectedClipId) {
      lastAutoFocusedClipIdRef.current = null;
      return;
    }
    const isActiveText = activeTextClips.some(
      (clip) => clip.id === selectedClipId,
    );
    if (!isActiveText) return;
    if (lastAutoFocusedClipIdRef.current === selectedClipId) return;

    const element = textElementRefs.current.get(selectedClipId);
    if (!element) return;

    setFocusedTextClipId(selectedClipId);
    element.focus();
    lastAutoFocusedClipIdRef.current = selectedClipId;
  }, [activeTextClips, selectedClipId]);

  const updateDraggedTextPosition = useCallback(
    (clientX: number, clientY: number) => {
      const drag = textDragRef.current;
      const container = containerRef.current;
      if (!drag || !container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const pointerX = (clientX - rect.left) / rect.width;
      const pointerY = (clientY - rect.top) / rect.height;

      onUpdateTextClipPosition(
        drag.clipId,
        clamp01(pointerX - drag.offsetX),
        clamp01(pointerY - drag.offsetY),
      );
    },
    [containerRef, onUpdateTextClipPosition],
  );

  if (activeTextClips.length === 0) return null;

  return (
    <div className="absolute inset-0">
      {activeTextClips.map((clip, index) => {
        const position = getTextPosition(clip, index);
        const isHighlighted =
          draggingTextClipId === clip.id || focusedTextClipId === clip.id;

        return (
          <div
            key={clip.id}
            role="button"
            tabIndex={0}
            ref={(el) => {
              if (el) {
                textElementRefs.current.set(clip.id, el);
              } else {
                textElementRefs.current.delete(clip.id);
              }
            }}
            className={`absolute max-w-[80%] -translate-x-1/2 -translate-y-1/2 cursor-grab border-2 border-transparent bg-transparent px-3 py-1.5 text-center text-lg font-medium text-white select-none outline-none ${draggingTextClipId === clip.id ? "cursor-grabbing" : ""} ${isHighlighted ? "border-[#00ff00] shadow-[0_0_0_2px_rgba(0,255,0,0.55)]" : ""}`}
            style={{
              left: `${position.x * 100}%`,
              top: `${position.y * 100}%`,
            }}
            onFocus={() => setFocusedTextClipId(clip.id)}
            onBlur={() => {
              setFocusedTextClipId((prev) => (prev === clip.id ? null : prev));
            }}
            onPointerDown={(e) => {
              const container = containerRef.current;
              if (!container) return;

              const rect = container.getBoundingClientRect();
              if (rect.width <= 0 || rect.height <= 0) return;

              const pointerX = (e.clientX - rect.left) / rect.width;
              const pointerY = (e.clientY - rect.top) / rect.height;
              const { x, y } = getTextPosition(clip, index);

              textDragRef.current = {
                clipId: clip.id,
                offsetX: pointerX - x,
                offsetY: pointerY - y,
              };
              setDraggingTextClipId(clip.id);
              setFocusedTextClipId(clip.id);
              e.currentTarget.focus();

              e.currentTarget.setPointerCapture(e.pointerId);
              e.stopPropagation();
              e.preventDefault();
            }}
            onPointerMove={(e) => {
              if (textDragRef.current?.clipId !== clip.id) return;
              updateDraggedTextPosition(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              if (textDragRef.current?.clipId === clip.id) {
                updateDraggedTextPosition(e.clientX, e.clientY);
                textDragRef.current = null;
                setDraggingTextClipId(null);
              }
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
            onPointerCancel={(e) => {
              textDragRef.current = null;
              setDraggingTextClipId(null);
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
          >
            {clip.label}
          </div>
        );
      })}
    </div>
  );
}
