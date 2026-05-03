import type { Clip, Row } from "../../store/editorStore";

type VisualClip = Clip & { type: "video" | "text" };

export function isClipActive(clip: Clip, currentTime: number): boolean {
  return currentTime >= clip.start && currentTime < clip.start + clip.duration;
}

export function getActiveVideoLayers(
  rows: Row[],
  clips: Clip[],
  currentTime: number,
): Clip[] {
  const rowOrder = new Map(rows.map((row, index) => [row.id, index]));
  const activeByRow = new Map<string, Clip>();

  for (const clip of clips) {
    if (
      clip.type !== "video" ||
      !clip.src ||
      !isClipActive(clip, currentTime)
    ) {
      continue;
    }

    const prev = activeByRow.get(clip.rowId);
    if (!prev || clip.start >= prev.start) {
      activeByRow.set(clip.rowId, clip);
    }
  }

  return Array.from(activeByRow.values()).sort((a, b) => {
    const rowA = rowOrder.get(a.rowId) ?? Number.MAX_SAFE_INTEGER;
    const rowB = rowOrder.get(b.rowId) ?? Number.MAX_SAFE_INTEGER;

    if (rowA !== rowB) {
      // Draw from bottom to top so upper rows can overlay lower rows.
      return rowB - rowA;
    }

    return a.start - b.start;
  });
}

export function getActiveTextClips(clips: Clip[], currentTime: number): Clip[] {
  return clips.filter(
    (clip) => clip.type === "text" && isClipActive(clip, currentTime),
  );
}

function getActiveClipByRow(rows: Row[], clips: Clip[], currentTime: number) {
  const rowTypes = new Map(rows.map((row) => [row.id, row.type]));
  const activeByRow = new Map<string, VisualClip>();

  for (const clip of clips) {
    if (!isClipActive(clip, currentTime)) continue;
    if (clip.type !== "video" && clip.type !== "text") continue;
    if (rowTypes.get(clip.rowId) !== clip.type) continue;
    if (clip.type === "video" && !clip.src) continue;

    const prev = activeByRow.get(clip.rowId);
    if (!prev || clip.start >= prev.start) {
      activeByRow.set(clip.rowId, clip);
    }
  }

  return activeByRow;
}

export function getActiveVisualLayers(
  rows: Row[],
  clips: Clip[],
  currentTime: number,
): VisualClip[] {
  const activeByRow = getActiveClipByRow(rows, clips, currentTime);

  // Draw from bottom to top: larger row index first.
  return rows
    .map((row) => activeByRow.get(row.id))
    .filter((clip): clip is VisualClip => Boolean(clip))
    .reverse();
}

export function getVisibleTextLayers(
  rows: Row[],
  clips: Clip[],
  currentTime: number,
): Clip[] {
  const activeByRow = getActiveClipByRow(rows, clips, currentTime);
  const topVideoIndex = rows.findIndex((row) => {
    const active = activeByRow.get(row.id);
    return active?.type === "video";
  });

  return rows
    .map((row, index) => {
      const active = activeByRow.get(row.id);
      if (!active || active.type !== "text") return null;
      if (topVideoIndex !== -1 && index > topVideoIndex) return null;
      return active;
    })
    .filter((clip): clip is Clip => Boolean(clip));
}

export function getTopVisibleVideoLayer(
  rows: Row[],
  clips: Clip[],
  currentTime: number,
): Clip | null {
  const activeByRow = getActiveClipByRow(rows, clips, currentTime);

  for (const row of rows) {
    const active = activeByRow.get(row.id);
    if (active?.type === "video") {
      return active;
    }
  }

  return null;
}

export function getActiveAudioClips(
  rows: Row[],
  clips: Clip[],
  currentTime: number,
): Clip[] {
  const mutedRowIds = new Set(
    rows.filter((row) => row.muted).map((row) => row.id),
  );

  return clips.filter(
    (clip) =>
      (clip.type === "audio" || clip.type === "video") &&
      !!clip.src &&
      !mutedRowIds.has(clip.rowId) &&
      isClipActive(clip, currentTime),
  );
}

export function getMediaTime(clip: Clip, currentTime: number): number {
  const raw = currentTime - clip.start + clip.trimStart;
  const max = clip.sourceDuration > 0 ? clip.sourceDuration : clip.duration;
  return Math.max(0, Math.min(raw, max));
}
