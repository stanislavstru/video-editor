import { Sidebar } from "./components/sidebar/Sidebar";
import { Preview } from "./components/preview/Preview";
import { Timeline } from "./components/timeline/Timeline";
import { Toaster } from "./components/ui/sonner";
import { useState, useCallback, useRef } from "react";

const MIN_TIMELINE_HEIGHT = 80;
const MAX_TIMELINE_HEIGHT = 600;

function App() {
  const [timelineHeight, setTimelineHeight] = useState(256);
  const dragStartRef = useRef<{ y: number; height: number } | null>(null);

  const onResizerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragStartRef.current = { y: e.clientY, height: timelineHeight };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [timelineHeight],
  );

  const onResizerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStartRef.current) return;
      const delta = dragStartRef.current.y - e.clientY;
      const newHeight = Math.min(
        MAX_TIMELINE_HEIGHT,
        Math.max(MIN_TIMELINE_HEIGHT, dragStartRef.current.height + delta),
      );
      setTimelineHeight(newHeight);
    },
    [],
  );

  const onResizerPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragStartRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
    [],
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-hidden bg-surface-raised">
          <Preview />
        </main>

        <div
          className="group flex cursor-ns-resize items-center justify-center border-t border-zinc-800 hover:border-zinc-500"
          style={{ height: 6 }}
          onPointerDown={onResizerPointerDown}
          onPointerMove={onResizerPointerMove}
          onPointerUp={onResizerPointerUp}
          onPointerCancel={onResizerPointerUp}
        >
          <div className="h-0.5 w-10 rounded-full bg-zinc-700 group-hover:bg-zinc-400 transition-colors" />
        </div>

        <div
          className="shrink-0 border-zinc-800"
          style={{ height: timelineHeight }}
        >
          <Timeline />
        </div>
      </div>

      <Toaster />
    </div>
  );
}

export default App;
