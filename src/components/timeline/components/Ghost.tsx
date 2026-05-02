import type { Clip, ClipType } from "../../../store/editorStore";
import type { DragState } from "../types";
import { timeToPx } from "../utils";
import { getClipHeight } from "../constants";

interface GhostProps {
  dragState: DragState;
  clips: Clip[];
  zoom: number;
  rowType: ClipType;
}

export function Ghost({ dragState, clips, zoom, rowType }: GhostProps) {
  if (dragState.kind !== "moving") return null;
  const clip = clips.find((c) => c.id === dragState.clipId);
  if (!clip) return null;
  const width = Math.max(timeToPx(clip.duration, zoom), 2);
  const clipHeight = getClipHeight(rowType);

  return (
    <div
      className="absolute top-1  pointer-events-none z-40"
      style={{
        left: dragState.ghostLeft,
        width,
        height: clipHeight,
        backgroundColor: clip.color,
        opacity: 0.7,
        border: "2px solid white",
        boxSizing: "border-box",
      }}
    >
      <span className="absolute inset-0 flex items-center px-3 text-[11px] font-medium text-white truncate">
        {clip.label}
      </span>
    </div>
  );
}
