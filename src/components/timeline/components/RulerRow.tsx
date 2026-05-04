import {
  useRef,
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { pxToTime, timeToPx, snapTime } from "../utils";
import { ROW_LABEL_WIDTH, RULER_HEIGHT, SNAP_GRID } from "../constants";
import { Ruler } from "./Ruler";

interface RulerRowProps {
  zoom: number;
  duration: number;
  totalWidth: number;
  currentTime: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  setCurrentTime: (t: number) => void;
  setPlaying: (playing: boolean) => void;
}

export function RulerRow({
  zoom,
  duration,
  totalWidth,
  currentTime,
  scrollRef,
  setCurrentTime,
  setPlaying,
}: RulerRowProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const timeToRulerLeft = useCallback((t: number) => timeToPx(t, zoom), [zoom]);

  const pxToClampedTime = useCallback(
    (clientX: number) => {
      if (!rulerRef.current || !scrollRef.current) return null;
      const rect = rulerRef.current.getBoundingClientRect();
      const scrollLeft = scrollRef.current.scrollLeft;
      const px = clientX - rect.left + scrollLeft;
      return Math.max(0, Math.min(pxToTime(px, zoom), duration));
    },
    [zoom, duration, scrollRef],
  );

  const onRulerPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Only react to clicks directly on the ruler (not on the marker)
      if ((e.target as HTMLElement).dataset.marker) return;
      setPlaying(false);
      const t = pxToClampedTime(e.clientX);
      if (t !== null) setCurrentTime(snapTime(t, SNAP_GRID));
    },
    [pxToClampedTime, setCurrentTime, setPlaying],
  );

  // Marker drag via pointer capture
  const onMarkerPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      setPlaying(false);
      isDraggingRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [setPlaying],
  );

  const onMarkerPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      const t = pxToClampedTime(e.clientX);
      if (t !== null) setCurrentTime(snapTime(t, SNAP_GRID));
    },
    [pxToClampedTime, setCurrentTime],
  );

  const onMarkerPointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Auto-scroll when dragging near edges
  useEffect(() => {
    // nothing persistent needed — pointer capture handles movement
  }, []);

  const markerLeft = timeToRulerLeft(currentTime);
  const HEAD_SIZE = 10; // half-width of the triangular head
  const HEAD_HEIGHT = 8;

  return (
    <div className="flex" style={{ minWidth: totalWidth + ROW_LABEL_WIDTH }}>
      {/* Sticky label cell */}
      <div
        className="shrink-0 bg-muted border-r border-b border-border z-20"
        style={{
          width: ROW_LABEL_WIDTH,
          height: RULER_HEIGHT,
          position: "sticky",
          left: 0,
        }}
      />

      {/* Ruler area */}
      <div
        ref={rulerRef}
        className="relative bg-muted border-b border-border cursor-pointer z-10 overflow-visible"
        style={{ height: RULER_HEIGHT, flex: 1 }}
        onPointerDown={onRulerPointerDown}
      >
        <Ruler zoom={zoom} duration={duration} />

        {/* Playhead marker */}
        <div
          data-marker="1"
          className="absolute top-0 z-30 flex flex-col items-center cursor-grab active:cursor-grabbing"
          style={{
            left: markerLeft,
            transform: "translateX(-50%)",
            // Make the hit area taller than the visual head
            paddingBottom: 4,
            touchAction: "none",
          }}
          onPointerDown={onMarkerPointerDown}
          onPointerMove={onMarkerPointerMove}
          onPointerUp={onMarkerPointerUp}
        >
          {/* Triangle head */}
          <svg
            width={HEAD_SIZE * 2}
            height={HEAD_HEIGHT + 4}
            viewBox={`0 0 ${HEAD_SIZE * 2} ${HEAD_HEIGHT + 4}`}
            style={{ display: "block", overflow: "visible" }}
          >
            {/* Outer stroke */}
            <polygon
              points={`${HEAD_SIZE},${HEAD_HEIGHT + 3} 1,1 ${HEAD_SIZE * 2 - 1},1`}
              fill="#1a1d27"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
