import type { Clip, Row } from "../../store/editorStore";

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

export function getActiveAudioClips(
  clips: Clip[],
  currentTime: number,
): Clip[] {
  return clips.filter(
    (clip) =>
      (clip.type === "audio" || clip.type === "video") &&
      !!clip.src &&
      isClipActive(clip, currentTime),
  );
}

export function getMediaTime(clip: Clip, currentTime: number): number {
  const raw = currentTime - clip.start + clip.trimStart;
  const max = clip.sourceDuration > 0 ? clip.sourceDuration : clip.duration;
  return Math.max(0, Math.min(raw, max));
}
