/** Convert seconds to pixels */
export function timeToPx(seconds: number, zoom: number): number {
  return seconds * zoom;
}

/** Convert pixels to seconds */
export function pxToTime(px: number, zoom: number): number {
  return px / zoom;
}

/** Snap a time value to the nearest snap grid (in seconds) */
export function snapTime(t: number, snapGrid: number): number {
  if (snapGrid <= 0) return t;
  return Math.round(t / snapGrid) * snapGrid;
}

/** Format seconds as MM:SS.f */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, "0")}.${f}`;
}

/** Given a ruler width in pixels and zoom, compute sensible tick interval in seconds */
export function computeTickInterval(zoom: number): number {
  // target ~80px between ticks
  const target = 80;
  const rawInterval = target / zoom;
  // round to nice value: 0.5, 1, 2, 5, 10, 30, 60…
  const nice = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  return nice.find((n) => n >= rawInterval) ?? 300;
}
