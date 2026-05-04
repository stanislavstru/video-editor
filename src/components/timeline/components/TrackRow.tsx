import { type PointerEvent as ReactPointerEvent } from "react";
import { Trash2, Volume2, VolumeX } from "lucide-react";
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
  onToggleRowMuted: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
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
  onToggleRowMuted,
  onDeleteRow,
}: TrackRowProps) {
  const isGhostRow = ghostRowId === row.id;
  const isActiveRow =
    selectedClipId !== null && clips.some((c) => c.id === selectedClipId);
  const rowHeight = getRowHeight(row.type);
  const canMute = row.type === "audio" || row.type === "video";

  return (
    <div className="flex" style={{ height: rowHeight }}>
      {/* Label */}
      <div
        className="shrink-0 flex items-center px-3 text-[11px] font-medium border-r border-border bg-muted transition-colors"
        style={{
          width: ROW_LABEL_WIDTH,
          height: rowHeight,
          color: isActiveRow ? "var(--color-foreground)" : undefined,
          borderLeft: isActiveRow
            ? "2px solid #e84040"
            : "2px solid transparent",
        }}
      >
        <div className="flex w-full flex-col items-start justify-center gap-1">
          <span className="w-full truncate">{row.label}</span>
          <div className="flex items-center gap-1">
            {canMute && (
              <button
                type="button"
                className="shrink-0 cursor-pointer rounded border border-border p-1 text-muted-foreground hover:bg-background"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleRowMuted(row.id);
                }}
                title={row.muted ? "Unmute track" : "Mute track"}
                aria-label={row.muted ? "Unmute track" : "Mute track"}
              >
                {row.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            )}
            <button
              type="button"
              className="shrink-0 cursor-pointer rounded border border-border p-1 text-muted-foreground hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteRow(row.id);
              }}
              title="Delete track"
              aria-label="Delete track"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Track area */}
      <div
        className="relative border-b border-border transition-colors"
        style={{
          width: totalWidth,
          height: rowHeight,
          backgroundColor: isActiveRow
            ? "rgba(232,64,64,0.06)"
            : isGhostRow
              ? "rgba(255,255,255,0.04)"
              : undefined,
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
