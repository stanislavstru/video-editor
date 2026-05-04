import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { Clip } from "../../../store/editorStore";

interface DraggableTextOverlaysProps {
  activeTextClips: Clip[];
  selectedClipId: string | null;
  rowOrderById: Map<string, number>;
  containerRef: RefObject<HTMLDivElement | null>;
  onUpdateTextClipPosition: (clipId: string, x: number, y: number) => void;
  onDeleteClip: (clipId: string) => void;
  onOpenEditor: (clipId: string) => void;
  onSelectClip: (clipId: string) => void;
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
  rowOrderById,
  containerRef,
  onUpdateTextClipPosition,
  onDeleteClip,
  onOpenEditor,
  onSelectClip,
}: DraggableTextOverlaysProps) {
  const textDragRef = useRef<DragState | null>(null);
  const textElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastAutoFocusedClipIdRef = useRef<string | null>(null);
  const [draggingTextClipId, setDraggingTextClipId] = useState<string | null>(
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
          draggingTextClipId === clip.id || selectedClipId === clip.id;

        return (
          <div
            key={clip.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${position.x * 100}%`,
              top: `${position.y * 100}%`,
              zIndex: 2000 - (rowOrderById.get(clip.rowId) ?? 0),
            }}
          >
            {/* Toolbar — shown when focused or dragging */}
            {isHighlighted && (
              <div
                className="absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 flex items-center gap-0.5 rounded-sm bg-white px-1 py-0.5 shadow-md"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                <button
                  type="button"
                  className="flex items-center justify-center rounded p-1 text-neutral-600 hover:bg-neutral-100"
                  title="Edit text"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEditor(clip.id);
                  }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center rounded p-1 text-neutral-600 hover:bg-neutral-100 hover:text-red-500"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteClip(clip.id);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}

            {/* Text overlay */}
            <div
              role="button"
              tabIndex={0}
              ref={(el) => {
                if (el) {
                  textElementRefs.current.set(clip.id, el);
                } else {
                  textElementRefs.current.delete(clip.id);
                }
              }}
              className={`cursor-grab whitespace-nowrap border-2  bg-transparent px-3 py-1.5 text-center select-none outline-none ${draggingTextClipId === clip.id ? "cursor-grabbing" : ""} ${isHighlighted ? "border-[#00ff00]" : "border-transparent"}`}
              style={{
                color: clip.textColor ?? "#ffffff",
                fontSize: `${clip.textSize ?? 18}px`,
                fontFamily: "sans-serif",
                fontWeight: 500,
              }}
              onFocus={() => {
                onSelectClip(clip.id);
              }}
              onBlur={() => {}}
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
                onSelectClip(clip.id);
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
          </div>
        );
      })}
    </div>
  );
}
