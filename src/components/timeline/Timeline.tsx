import {
  useRef,
  useEffect,
  useCallback,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useEditorStore } from "../../store/editorStore";
import type { Clip, Row } from "../../store/editorStore";
import { timeToPx, pxToTime, snapTime, formatTime } from "./utils";
import {
  getClipHeight,
  getRowHeight,
  ROW_LABEL_WIDTH,
  RULER_HEIGHT,
  SNAP_GRID,
  MIN_CLIP_DURATION,
} from "./constants";
import type { DragState } from "./types";
import { Ruler } from "./components/Ruler";
import { TrackRow } from "./components/TrackRow";

const NEW_ROW_DROP_ZONE_HEIGHT = 48;

function getRowsHeight(rows: Row[]) {
  return rows.reduce((total, row) => total + getRowHeight(row.type), 0);
}

function getRowTop(rows: Row[], rowId: string) {
  let top = 0;
  for (const row of rows) {
    if (row.id === rowId) return top;
    top += getRowHeight(row.type);
  }
  return -1;
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
export function Timeline() {
  const rows = useEditorStore((s) => s.rows);
  const clips = useEditorStore((s) => s.clips);
  const zoom = useEditorStore((s) => s.zoom);
  const duration = useEditorStore((s) => s.duration);
  const currentTime = useEditorStore((s) => s.currentTime);
  const playing = useEditorStore((s) => s.playing);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);

  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setZoom = useEditorStore((s) => s.setZoom);
  const selectClip = useEditorStore((s) => s.selectClip);
  const moveClip = useEditorStore((s) => s.moveClip);
  const createRowOfType = useEditorStore((s) => s.createRowOfType);
  const trimClip = useEditorStore((s) => s.trimClip);
  const splitClip = useEditorStore((s) => s.splitClip);
  const deleteSelectedClip = useEditorStore((s) => s.deleteSelectedClip);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const playStartRef = useRef<{ wallTime: number; editorTime: number } | null>(
    null,
  );

  const [dragState, setDragState] = useState<DragState>({ kind: "idle" });

  const totalWidth = timeToPx(duration, zoom);
  const rowsHeight = getRowsHeight(rows);

  // ─── Playback loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (playing) {
      playStartRef.current = {
        wallTime: performance.now(),
        editorTime: currentTime,
      };

      const tick = () => {
        if (!playStartRef.current) return;
        const elapsed =
          (performance.now() - playStartRef.current.wallTime) / 1000;
        const next = playStartRef.current.editorTime + elapsed;
        if (next >= duration) {
          setCurrentTime(duration);
          setPlaying(false);
          return;
        }
        setCurrentTime(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      playStartRef.current = null;
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // We intentionally only re-run when `playing` changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.code === "Space") {
        e.preventDefault();
        setPlaying(!playing);
      }
      if (e.code === "KeyS") {
        if (selectedClipId) splitClip(selectedClipId, currentTime);
      }
      if (e.code === "Delete" || e.code === "Backspace") {
        deleteSelectedClip();
      }
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    playing,
    selectedClipId,
    currentTime,
    setPlaying,
    splitClip,
    deleteSelectedClip,
    undo,
    redo,
  ]);

  // ─── Ruler click → seek ───────────────────────────────────────────────────
  const onRulerPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!scrollRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollLeft = scrollRef.current.scrollLeft;
      const px = e.clientX - rect.left + scrollLeft;
      const t = Math.max(0, Math.min(pxToTime(px, zoom), duration));
      setCurrentTime(snapTime(t, SNAP_GRID));
      setPlaying(false);
    },
    [zoom, duration, setCurrentTime, setPlaying],
  );

  // ─── Clip drag (move) ─────────────────────────────────────────────────────
  const onPointerDownClip = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, clip: Clip) => {
      e.stopPropagation();
      e.preventDefault();
      selectClip(clip.id);

      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      const offsetInsideClip = e.clientX - rect.left;

      setDragState({
        kind: "moving",
        clipId: clip.id,
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startClipStart: clip.start,
        startRowId: clip.rowId,
        offsetInsideClip,
        ghostLeft: timeToPx(clip.start, zoom),
        ghostRowId: clip.rowId,
        ghostRowType: clip.type,
      });

      el.setPointerCapture(e.pointerId);
    },
    [selectClip, zoom],
  );

  // ─── Trim handles ─────────────────────────────────────────────────────────
  const onPointerDownTrimLeft = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, clip: Clip) => {
      e.stopPropagation();
      e.preventDefault();
      selectClip(clip.id);
      setDragState({
        kind: "trimming",
        clipId: clip.id,
        edge: "left",
        startPointerX: e.clientX,
        startClipStart: clip.start,
        startClipDuration: clip.duration,
        startTrimStart: clip.trimStart,
        sourceDuration: clip.sourceDuration,
      });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [selectClip],
  );

  const onPointerDownTrimRight = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, clip: Clip) => {
      e.stopPropagation();
      e.preventDefault();
      selectClip(clip.id);
      setDragState({
        kind: "trimming",
        clipId: clip.id,
        edge: "right",
        startPointerX: e.clientX,
        startClipStart: clip.start,
        startClipDuration: clip.duration,
        startTrimStart: clip.trimStart,
        sourceDuration: clip.sourceDuration,
      });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [selectClip],
  );

  // ─── Pointer move / up (global) ───────────────────────────────────────────
  useEffect(() => {
    if (dragState.kind === "idle") return;

    const rowElements: Array<{
      rowId: string;
      type: Row["type"];
      top: number;
      bottom: number;
    }> = [];

    const collectRowRects = () => {
      if (!scrollRef.current) return;
      const containerRect = scrollRef.current.getBoundingClientRect();
      const trackTop = containerRect.top + RULER_HEIGHT;
      let currentTop = trackTop;
      rows.forEach((row) => {
        const rowHeight = getRowHeight(row.type);
        rowElements.push({
          rowId: row.id,
          type: row.type,
          top: currentTop,
          bottom: currentTop + rowHeight,
        });
        currentTop += rowHeight;
      });
    };
    collectRowRects();

    const onPointerMove = (e: PointerEvent) => {
      if (dragState.kind === "moving") {
        const clip = clips.find((currentClip) => currentClip.id === dragState.clipId);
        if (!clip) return;
        const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
        const containerLeft = scrollRef.current
          ? scrollRef.current.getBoundingClientRect().left + ROW_LABEL_WIDTH
          : 0;
        const pointerPxInTrack = e.clientX - containerLeft + scrollLeft;
        const newClipStartPx = pointerPxInTrack - dragState.offsetInsideClip;
        const newClipStart = snapTime(
          Math.max(0, pxToTime(newClipStartPx, zoom)),
          SNAP_GRID,
        );

        let hoveredRowId: string | null = dragState.startRowId;
        let ghostRowType = clip.type;
        for (const r of rowElements) {
          if (r.type !== clip.type) continue;
          if (e.clientY >= r.top && e.clientY < r.bottom) {
            hoveredRowId = r.rowId;
            break;
          }
        }

        const lastRowBottom = rowElements[rowElements.length - 1]?.bottom;
        if (lastRowBottom !== undefined && e.clientY >= lastRowBottom) {
          hoveredRowId = null;
        }

        setDragState((prev) =>
          prev.kind === "moving"
            ? ({
                ...prev,
                ghostLeft: timeToPx(newClipStart, zoom),
                ghostRowId: hoveredRowId,
                ghostRowType,
                _pendingStart: newClipStart,
                _pendingRowId: hoveredRowId,
              } as DragState & {
                _pendingStart: number;
                _pendingRowId: string | null;
              })
            : prev,
        );
      } else if (dragState.kind === "trimming") {
        const deltaSec = pxToTime(e.clientX - dragState.startPointerX, zoom);
        const clip = clips.find((c) => c.id === dragState.clipId);
        if (!clip) return;

        if (dragState.edge === "left") {
          const rawStart = dragState.startClipStart + deltaSec;
          const maxStart =
            dragState.startClipStart +
            dragState.startClipDuration -
            MIN_CLIP_DURATION;
          // Can't move left edge further left than the source beginning
          const minStart = Math.max(
            0,
            dragState.startClipStart - dragState.startTrimStart,
          );
          const newStart = snapTime(
            Math.max(minStart, Math.min(rawStart, maxStart)),
            SNAP_GRID,
          );
          const newDuration =
            dragState.startClipStart + dragState.startClipDuration - newStart;
          const newTrimStart =
            dragState.startTrimStart + (newStart - dragState.startClipStart);
          useEditorStore.setState((s) => ({
            clips: s.clips.map((c) =>
              c.id === dragState.clipId
                ? {
                    ...c,
                    start: newStart,
                    duration: newDuration,
                    trimStart: newTrimStart,
                  }
                : c,
            ),
          }));
        } else {
          const rawDuration = dragState.startClipDuration + deltaSec;
          // Can't extend beyond the available source material
          const maxDuration =
            dragState.sourceDuration - dragState.startTrimStart;
          const newDuration = snapTime(
            Math.min(Math.max(MIN_CLIP_DURATION, rawDuration), maxDuration),
            SNAP_GRID,
          );
          useEditorStore.setState((s) => ({
            clips: s.clips.map((c) =>
              c.id === dragState.clipId ? { ...c, duration: newDuration } : c,
            ),
          }));
        }
      }
    };

    const onPointerUp = (_e: PointerEvent) => {
      if (dragState.kind === "moving") {
        const ds = dragState as DragState & {
          _pendingStart?: number;
          _pendingRowId?: string | null;
        };
        const toStart = ds._pendingStart ?? dragState.startClipStart;
        const createdRow =
          ds._pendingRowId === null ? createRowOfType(dragState.ghostRowType) : null;
        const toRowId = createdRow?.id ?? ds._pendingRowId ?? dragState.startRowId;
        moveClip(dragState.clipId, toRowId, toStart);
      } else if (dragState.kind === "trimming") {
        const clip = clips.find((c) => c.id === dragState.clipId);
        if (clip) {
          trimClip(dragState.clipId, dragState.edge, clip.start, clip.duration);
        }
      }
      setDragState({ kind: "idle" });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragState, zoom, rows, clips, createRowOfType, moveClip, trimClip]);

  // ─── Row click (deselect) ─────────────────────────────────────────────────
  const onRowPointerDown = useCallback(
    (_e: ReactPointerEvent<HTMLDivElement>, _rowId: string) => {
      selectClip(null);
    },
    [selectClip],
  );

  // ─── Zoom via wheel ───────────────────────────────────────────────────────
  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        setZoom(zoom * factor);
      }
    },
    [zoom, setZoom],
  );

  // ─── Auto-scroll playhead into view ───────────────────────────────────────
  useEffect(() => {
    if (!playing || !scrollRef.current) return;
    const el = scrollRef.current;
    const playheadPx = timeToPx(currentTime, zoom) + ROW_LABEL_WIDTH;
    const visibleRight = el.scrollLeft + el.clientWidth;
    const margin = 80;
    if (playheadPx > visibleRight - margin) {
      el.scrollLeft = playheadPx - el.clientWidth / 2;
    }
  }, [currentTime, zoom, playing]);

  const ghostRowId =
    dragState.kind === "moving"
      ? (dragState as Extract<DragState, { kind: "moving" }>).ghostRowId
      : null;
  const showNewRowDropZone =
    dragState.kind === "moving" && dragState.ghostRowId === null;

  return (
    <div
      className="flex flex-col h-full bg-background text-foreground select-none"
      onWheel={onWheel}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0">
        <button
          className="px-3 py-1 rounded text-xs bg-muted hover:bg-muted/70 transition-colors"
          onClick={() => setPlaying(!playing)}
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <span className="text-xs text-muted-foreground font-mono">
          {formatTime(currentTime)}
        </span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">Zoom</span>
        <input
          type="range"
          min={10}
          max={400}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-24 accent-brand"
        />
        <span className="text-xs text-muted-foreground font-mono w-12">
          {zoom.toFixed(0)}px/s
        </span>
        <button
          className="px-2 py-1 rounded text-xs bg-muted hover:bg-muted/70 transition-colors"
          onClick={undo}
          title="Undo (Cmd+Z)"
        >
          ↩
        </button>
        <button
          className="px-2 py-1 rounded text-xs bg-muted hover:bg-muted/70 transition-colors"
          onClick={redo}
          title="Redo (Cmd+Shift+Z)"
        >
          ↪
        </button>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto relative"
        style={{ overflowX: "auto", overflowY: "auto" }}
      >
        {/* Ruler row */}
        <div
          className="flex"
          style={{ minWidth: totalWidth + ROW_LABEL_WIDTH }}
        >
          <div
            className="shrink-0 bg-muted border-r border-b border-border z-20"
            style={{
              width: ROW_LABEL_WIDTH,
              height: RULER_HEIGHT,
              position: "sticky",
              left: 0,
            }}
          />
          <div
            ref={rulerRef}
            className="relative bg-muted border-b border-border cursor-pointer z-10"
            style={{ height: RULER_HEIGHT, flex: 1 }}
            onPointerDown={onRulerPointerDown}
          >
            <Ruler zoom={zoom} duration={duration} />
          </div>
        </div>

        {/* Tracks */}
        <div
          className="relative"
          style={{ minWidth: totalWidth + ROW_LABEL_WIDTH }}
        >
          {/* Playhead line */}
          <div
            className="absolute top-0 z-30 pointer-events-none"
            style={{
              left: ROW_LABEL_WIDTH + timeToPx(currentTime, zoom),
              width: 1,
              height: rowsHeight,
              backgroundColor: "#e84040",
              transform: "translateX(-0.5px)",
            }}
          />

          {rows.map((row) => (
            <TrackRow
              key={row.id}
              row={row}
              clips={clips.filter((c) => c.rowId === row.id)}
              zoom={zoom}
              totalWidth={totalWidth}
              dragState={dragState}
              selectedClipId={selectedClipId}
              ghostRowId={ghostRowId}
              onPointerDownClip={onPointerDownClip}
              onPointerDownTrimLeft={onPointerDownTrimLeft}
              onPointerDownTrimRight={onPointerDownTrimRight}
              onRowPointerDown={onRowPointerDown}
            />
          ))}

          {showNewRowDropZone && (
            <div className="flex" style={{ height: NEW_ROW_DROP_ZONE_HEIGHT }}>
              <div
                className="shrink-0 flex items-center px-3 text-[11px] font-medium text-muted-foreground border-r border-border bg-muted/60"
                style={{ width: ROW_LABEL_WIDTH, height: NEW_ROW_DROP_ZONE_HEIGHT }}
              >
                New {dragState.ghostRowType}
              </div>
              <div
                className="relative border-b border-dashed border-border/80 bg-muted/30"
                style={{
                  width: totalWidth,
                  height: NEW_ROW_DROP_ZONE_HEIGHT,
                  flexShrink: 0,
                }}
              />
            </div>
          )}

          {/* Global ghost overlay positioned in correct row */}
          {dragState.kind === "moving" &&
            (() => {
              const ds = dragState as Extract<DragState, { kind: "moving" }>;
              const clip = clips.find((c) => c.id === ds.clipId);
              if (!clip) return null;
              const width = Math.max(timeToPx(clip.duration, zoom), 2);
              const ghostRow = ds.ghostRowId
                ? rows.find((row) => row.id === ds.ghostRowId)
                : null;
              const ghostTop = ds.ghostRowId
                ? getRowTop(rows, ds.ghostRowId)
                : rowsHeight;
              const ghostHeight = ghostRow
                ? getClipHeight(ghostRow.type)
                : getClipHeight(ds.ghostRowType);
              if (ghostTop === -1) return null;
              return (
                <div
                  className="absolute rounded pointer-events-none z-40"
                  style={{
                    left: ROW_LABEL_WIDTH + ds.ghostLeft,
                    top: ghostTop + 4,
                    width,
                    height: ghostHeight,
                    backgroundColor: clip.color,
                    opacity: 0.75,
                    border: "2px solid rgba(0,0,0,0.25)",
                    boxSizing: "border-box",
                  }}
                >
                  <span className="absolute inset-0 flex items-center px-3 text-[11px] font-medium text-white truncate">
                    {clip.label}
                  </span>
                </div>
              );
            })()}
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="flex gap-4 px-3 py-1 border-t border-border text-[10px] text-muted-foreground shrink-0">
        <span>Space: play/pause</span>
        <span>S: split at playhead</span>
        <span>Del: delete clip</span>
        <span>Ctrl+Z: undo</span>
        <span>Ctrl+Wheel: zoom</span>
      </div>
    </div>
  );
}
