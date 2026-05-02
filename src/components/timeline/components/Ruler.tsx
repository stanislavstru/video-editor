import { timeToPx, formatTime, computeTickInterval } from "../timelineUtils";
import { ROW_HEIGHT, RULER_HEIGHT } from "../constants";

interface RulerProps {
  zoom: number;
  duration: number;
}

export function Ruler({ zoom, duration }: RulerProps) {
  const totalWidth = timeToPx(duration, zoom);
  const interval = computeTickInterval(zoom);
  const ticks: number[] = [];
  for (let t = 0; t <= duration + interval; t += interval) {
    ticks.push(Math.round(t * 100) / 100);
  }

  return (
    <div
      className="relative select-none"
      style={{ width: totalWidth, height: RULER_HEIGHT, flexShrink: 0 }}
    >
      {ticks.map((t) => {
        const x = timeToPx(t, zoom);
        return (
          <div
            key={t}
            className="absolute top-0 flex flex-col items-start"
            style={{ left: x }}
          >
            <div className="w-px bg-border" style={{ height: 10 }} />
            <span
              className="text-[10px] text-muted-foreground ml-1"
              style={{ whiteSpace: "nowrap" }}
            >
              {formatTime(t)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
