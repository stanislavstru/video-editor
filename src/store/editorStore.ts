import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type ClipType = "video" | "audio" | "text";

export interface Clip {
  id: string;
  rowId: string;
  /** Start time in seconds */
  start: number;
  /** Duration in seconds */
  duration: number;
  label: string;
  type: ClipType;
  color: string;
  /** For video clips – the source URL */
  src?: string;
  /** Trim: offset into the source where this clip begins */
  trimStart: number;
  /** Original full duration of the source */
  sourceDuration: number;
}

export interface Row {
  id: string;
  label: string;
  type: ClipType;
}

export interface MediaItem {
  id: string;
  name: string;
  src: string;
  duration: number;
  type: "video" | "audio";
}

export type Command =
  | {
      type: "MOVE_CLIP";
      clipId: string;
      fromRowId: string;
      fromStart: number;
      toRowId: string;
      toStart: number;
    }
  | {
      type: "TRIM_CLIP";
      clipId: string;
      edge: "left" | "right";
      oldStart: number;
      oldDuration: number;
      newStart: number;
      newDuration: number;
    }
  | {
      type: "SPLIT_CLIP";
      originalId: string;
      leftId: string;
      rightId: string;
      rowId: string;
      splitPoint: number;
      originalStart: number;
      originalDuration: number;
    }
  | { type: "ADD_CLIP"; clip: Clip }
  | { type: "REMOVE_CLIP"; clip: Clip };

interface EditorState {
  rows: Row[];
  clips: Clip[];
  mediaItems: MediaItem[];
  currentTime: number;
  duration: number;
  playing: boolean;
  zoom: number; // pixels per second
  selectedClipId: string | null;
  undoStack: Command[];
  redoStack: Command[];

  // Actions
  setCurrentTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setZoom: (z: number) => void;
  selectClip: (id: string | null) => void;

  moveClip: (clipId: string, toRowId: string, toStart: number) => void;
  trimClip: (
    clipId: string,
    edge: "left" | "right",
    newStart: number,
    newDuration: number,
  ) => void;
  splitClip: (clipId: string, atTime: number) => void;
  deleteSelectedClip: () => void;

  addClip: (clip: Clip) => void;
  addRow: (row: Row) => void;

  addMediaItem: (item: MediaItem) => void;
  removeMediaItem: (id: string) => void;
  addClipFromMedia: (mediaId: string) => void;

  undo: () => void;
  redo: () => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function recalcDuration(clips: Clip[]): number {
  if (clips.length === 0) return 60;
  return Math.max(60, ...clips.map((c) => c.start + c.duration + 10));
}

const CLIP_COLORS: Record<ClipType, string> = {
  video: "#3b82f6",
  audio: "#10b981",
  text: "#f59e0b",
};

const INITIAL_ROWS: Row[] = [
  { id: "row-video-1", label: "Video 1", type: "video" },
  { id: "row-video-2", label: "Video 2", type: "video" },
  { id: "row-audio-1", label: "Audio 1", type: "audio" },
];

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    rows: INITIAL_ROWS,
    clips: [],
    mediaItems: [],
    currentTime: 0,
    duration: recalcDuration([]),
    playing: false,
    zoom: 80, // 80px per second default
    selectedClipId: null,
    undoStack: [],
    redoStack: [],

    setCurrentTime: (t) =>
      set((s) => {
        s.currentTime = Math.max(0, Math.min(t, s.duration));
      }),

    setPlaying: (p) =>
      set((s) => {
        s.playing = p;
      }),

    setZoom: (z) =>
      set((s) => {
        s.zoom = Math.max(10, Math.min(500, z));
      }),

    selectClip: (id) =>
      set((s) => {
        s.selectedClipId = id;
      }),

    moveClip: (clipId, toRowId, toStart) => {
      const s = get();
      const clip = s.clips.find((c) => c.id === clipId);
      if (!clip) return;
      const cmd: Command = {
        type: "MOVE_CLIP",
        clipId,
        fromRowId: clip.rowId,
        fromStart: clip.start,
        toRowId,
        toStart: Math.max(0, toStart),
      };
      set((draft) => {
        const c = draft.clips.find((c) => c.id === clipId)!;
        c.rowId = toRowId;
        c.start = Math.max(0, toStart);
        draft.duration = recalcDuration(draft.clips);
        draft.undoStack.push(cmd);
        draft.redoStack = [];
      });
    },

    trimClip: (clipId, edge, newStart, newDuration) => {
      const s = get();
      const clip = s.clips.find((c) => c.id === clipId);
      if (!clip) return;
      const cmd: Command = {
        type: "TRIM_CLIP",
        clipId,
        edge,
        oldStart: clip.start,
        oldDuration: clip.duration,
        newStart,
        newDuration,
      };
      set((draft) => {
        const c = draft.clips.find((c) => c.id === clipId)!;
        c.start = newStart;
        c.duration = newDuration;
        draft.duration = recalcDuration(draft.clips);
        draft.undoStack.push(cmd);
        draft.redoStack = [];
      });
    },

    splitClip: (clipId, atTime) => {
      const s = get();
      const clip = s.clips.find((c) => c.id === clipId);
      if (!clip) return;
      if (atTime <= clip.start || atTime >= clip.start + clip.duration) return;

      const leftDuration = atTime - clip.start;
      const rightDuration = clip.duration - leftDuration;
      const leftId = generateId();
      const rightId = generateId();

      const leftClip: Clip = {
        ...clip,
        id: leftId,
        duration: leftDuration,
      };
      const rightClip: Clip = {
        ...clip,
        id: rightId,
        start: atTime,
        duration: rightDuration,
        trimStart: clip.trimStart + leftDuration,
      };

      const cmd: Command = {
        type: "SPLIT_CLIP",
        originalId: clipId,
        leftId,
        rightId,
        rowId: clip.rowId,
        splitPoint: atTime,
        originalStart: clip.start,
        originalDuration: clip.duration,
      };

      set((draft) => {
        const idx = draft.clips.findIndex((c) => c.id === clipId);
        draft.clips.splice(idx, 1, leftClip, rightClip);
        draft.undoStack.push(cmd);
        draft.redoStack = [];
      });
    },

    deleteSelectedClip: () => {
      const s = get();
      if (!s.selectedClipId) return;
      const clip = s.clips.find((c) => c.id === s.selectedClipId);
      if (!clip) return;
      const cmd: Command = { type: "REMOVE_CLIP", clip };
      set((draft) => {
        draft.clips = draft.clips.filter((c) => c.id !== s.selectedClipId);
        draft.selectedClipId = null;
        draft.undoStack.push(cmd);
        draft.redoStack = [];
        draft.duration = recalcDuration(draft.clips);
      });
    },

    addClip: (clip) => {
      const cmd: Command = { type: "ADD_CLIP", clip };
      set((draft) => {
        draft.clips.push(clip);
        draft.duration = recalcDuration(draft.clips);
        draft.undoStack.push(cmd);
        draft.redoStack = [];
      });
    },

    addRow: (row) => {
      set((draft) => {
        draft.rows.push(row);
      });
    },

    addMediaItem: (item) => {
      set((draft) => {
        draft.mediaItems.push(item);
      });
    },

    removeMediaItem: (id) => {
      set((draft) => {
        const item = draft.mediaItems.find((m) => m.id === id);
        if (item) URL.revokeObjectURL(item.src);
        draft.mediaItems = draft.mediaItems.filter((m) => m.id !== id);
      });
    },

    addClipFromMedia: (mediaId) => {
      const s = get();
      const media = s.mediaItems.find((m) => m.id === mediaId);
      if (!media) return;
      const targetRow = s.rows.find((r) => r.type === media.type);
      if (!targetRow) return;
      const clipsOnRow = s.clips.filter((c) => c.rowId === targetRow.id);
      const startTime = clipsOnRow.reduce(
        (max, c) => Math.max(max, c.start + c.duration),
        0,
      );
      const clip: Clip = {
        id: generateId(),
        rowId: targetRow.id,
        start: startTime,
        duration: media.duration,
        label: media.name,
        type: media.type,
        color: CLIP_COLORS[media.type],
        src: media.src,
        trimStart: 0,
        sourceDuration: media.duration,
      };
      const cmd: Command = { type: "ADD_CLIP", clip };
      set((draft) => {
        draft.clips.push(clip);
        draft.duration = recalcDuration(draft.clips);
        draft.undoStack.push(cmd);
        draft.redoStack = [];
      });
    },

    undo: () => {
      const s = get();
      if (s.undoStack.length === 0) return;
      const cmd = s.undoStack[s.undoStack.length - 1];
      set((draft) => {
        draft.undoStack.pop();
        draft.redoStack.push(cmd);
        applyUndo(draft, cmd);
        draft.duration = recalcDuration(draft.clips);
      });
    },

    redo: () => {
      const s = get();
      if (s.redoStack.length === 0) return;
      const cmd = s.redoStack[s.redoStack.length - 1];
      set((draft) => {
        draft.redoStack.pop();
        draft.undoStack.push(cmd);
        applyRedo(draft, cmd);
        draft.duration = recalcDuration(draft.clips);
      });
    },
  })),
);

function applyUndo(
  draft: { clips: Clip[]; selectedClipId: string | null },
  cmd: Command,
) {
  switch (cmd.type) {
    case "MOVE_CLIP": {
      const c = draft.clips.find((c) => c.id === cmd.clipId)!;
      c.rowId = cmd.fromRowId;
      c.start = cmd.fromStart;
      break;
    }
    case "TRIM_CLIP": {
      const c = draft.clips.find((c) => c.id === cmd.clipId)!;
      c.start = cmd.oldStart;
      c.duration = cmd.oldDuration;
      break;
    }
    case "SPLIT_CLIP": {
      const left = draft.clips.find((c) => c.id === cmd.leftId);
      const right = draft.clips.find((c) => c.id === cmd.rightId);
      if (!left || !right) break;
      const restored: Clip = {
        ...left,
        id: cmd.originalId,
        start: cmd.originalStart,
        duration: cmd.originalDuration,
      };
      draft.clips = draft.clips.filter(
        (c) => c.id !== cmd.leftId && c.id !== cmd.rightId,
      );
      draft.clips.push(restored);
      break;
    }
    case "ADD_CLIP":
      draft.clips = draft.clips.filter((c) => c.id !== cmd.clip.id);
      break;
    case "REMOVE_CLIP":
      draft.clips.push(cmd.clip);
      break;
  }
}

function applyRedo(
  draft: { clips: Clip[]; selectedClipId: string | null },
  cmd: Command,
) {
  switch (cmd.type) {
    case "MOVE_CLIP": {
      const c = draft.clips.find((c) => c.id === cmd.clipId)!;
      c.rowId = cmd.toRowId;
      c.start = cmd.toStart;
      break;
    }
    case "TRIM_CLIP": {
      const c = draft.clips.find((c) => c.id === cmd.clipId)!;
      c.start = cmd.newStart;
      c.duration = cmd.newDuration;
      break;
    }
    case "SPLIT_CLIP": {
      const original = draft.clips.find((c) => c.id === cmd.originalId);
      if (!original) break;
      const leftDuration = cmd.splitPoint - cmd.originalStart;
      const leftClip: Clip = {
        ...original,
        id: cmd.leftId,
        duration: leftDuration,
      };
      const rightClip: Clip = {
        ...original,
        id: cmd.rightId,
        start: cmd.splitPoint,
        duration: cmd.originalDuration - leftDuration,
        trimStart: original.trimStart + leftDuration,
      };
      draft.clips = draft.clips.filter((c) => c.id !== cmd.originalId);
      draft.clips.push(leftClip, rightClip);
      break;
    }
    case "ADD_CLIP":
      draft.clips.push(cmd.clip);
      break;
    case "REMOVE_CLIP":
      draft.clips = draft.clips.filter((c) => c.id !== cmd.clip.id);
      break;
  }
}
