import { type PointerEvent as ReactPointerEvent } from "react";
import type { Clip } from "../../../store/editorStore";
import type { DragState } from "../types";
import { timeToPx } from "../timelineUtils";
import { ROW_HEIGHT, TRIM_HANDLE_WIDTH } from "../constants";

export interface ClipBlockProps {
  clip: Clip;
  zoom: number;
  isSelected: boolean;
  dragState: DragState;
  onPointerDownClip: (e: ReactPointerEvent<HTMLDivElement>, clip: Clip) => void;
  onPointerDownTrimLeft: (
    e: ReactPointerEvent<HTMLDivElement>,
    clip: Clip,
  ) => void;
  onPointerDownTrimRight: (
    e: ReactPointerEvent<HTMLDivElement>,
    clip: Clip,
  ) => void;
}

export function ClipBlock({
  clip,
  zoom,
  isSelected,
  dragState,
  onPointerDownClip,
  onPointerDownTrimLeft,
  onPointerDownTrimRight,
}: ClipBlockProps) {
  const isDragging =
    dragState.kind === "moving" && dragState.clipId === clip.id;

  const left = timeToPx(clip.start, zoom);
  const width = Math.max(timeToPx(clip.duration, zoom), 2);

  return (
    <div
      className="absolute top-1 rounded select-none group"
      style={{
        left,
        width,
        height: ROW_HEIGHT - 8,
        backgroundColor: clip.color,
        opacity: isDragging ? 0.35 : 1,
        outline: isSelected ? "2px solid white" : "none",
        cursor: "grab",
        zIndex: isSelected ? 10 : 5,
        transition: isDragging ? "none" : "opacity 0.1s",
        boxSizing: "border-box",
      }}
      onPointerDown={(e) => onPointerDownClip(e, clip)}
    >
      {/* Left trim handle */}
      <div
        className="absolute top-0 left-0 h-full cursor-ew-resize z-10 flex items-center justify-center rounded-l"
        style={{ width: TRIM_HANDLE_WIDTH, backgroundColor: "rgba(0,0,0,0.3)" }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDownTrimLeft(e, clip);
        }}
      />
      {/* Label */}
      <span
        className="absolute inset-0 flex items-center px-3 text-[11px] font-medium text-white truncate pointer-events-none"
        style={{ left: TRIM_HANDLE_WIDTH, right: TRIM_HANDLE_WIDTH }}
      >
        {clip.label}
      </span>
      {/* Right trim handle */}
      <div
        className="absolute top-0 right-0 h-full cursor-ew-resize z-10 flex items-center justify-center rounded-r"
        style={{ width: TRIM_HANDLE_WIDTH, backgroundColor: "rgba(0,0,0,0.3)" }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDownTrimRight(e, clip);
        }}
      />
    </div>
  );
}
