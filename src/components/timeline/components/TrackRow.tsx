import { type PointerEvent as ReactPointerEvent } from "react";
import type { Clip, Row } from "../../../store/editorStore";
import type { DragState } from "../types";
import { getRowHeight, ROW_LABEL_WIDTH } from "../constants";
import { ClipBlock } from "./ClipBlock";
import { Ghost } from "./Ghost";

export interface TrackRowProps {
  row: Row;
  clips: Clip[];
  zoom: number;
  totalWidth: number;
  dragState: DragState;
  selectedClipId: string | null;
  ghostRowId: string | null;
  onPointerDownClip: (e: ReactPointerEvent<HTMLDivElement>, clip: Clip) => void;
  onPointerDownTrimLeft: (
    e: ReactPointerEvent<HTMLDivElement>,
    clip: Clip,
  ) => void;
  onPointerDownTrimRight: (
    e: ReactPointerEvent<HTMLDivElement>,
    clip: Clip,
  ) => void;
  onRowPointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    rowId: string,
  ) => void;
}

export function TrackRow({
  row,
  clips,
  zoom,
  totalWidth,
  dragState,
  selectedClipId,
  ghostRowId,
  onPointerDownClip,
  onPointerDownTrimLeft,
  onPointerDownTrimRight,
  onRowPointerDown,
}: TrackRowProps) {
  const isGhostRow = ghostRowId === row.id;
  const rowHeight = getRowHeight(row.type);

  return (
    <div className="flex" style={{ height: rowHeight }}>
      {/* Label */}
      <div
        className="shrink-0 flex items-center px-3 text-[11px] font-medium text-muted-foreground border-r border-border bg-muted"
        style={{ width: ROW_LABEL_WIDTH, height: rowHeight }}
      >
        {row.label}
      </div>

      {/* Track area */}
      <div
        className="relative border-b border-border"
        style={{
          width: totalWidth,
          height: rowHeight,
          backgroundColor: isGhostRow ? "rgba(255,255,255,0.04)" : undefined,
          flexShrink: 0,
        }}
        onPointerDown={(e) => onRowPointerDown(e, row.id)}
      >
        {clips.map((clip) => (
          <ClipBlock
            key={clip.id}
            clip={clip}
            zoom={zoom}
            rowType={row.type}
            isSelected={clip.id === selectedClipId}
            dragState={dragState}
            onPointerDownClip={onPointerDownClip}
            onPointerDownTrimLeft={onPointerDownTrimLeft}
            onPointerDownTrimRight={onPointerDownTrimRight}
          />
        ))}

        {isGhostRow && (
          <Ghost
            dragState={dragState}
            clips={clips}
            zoom={zoom}
            rowType={row.type}
          />
        )}
      </div>
    </div>
  );
}
