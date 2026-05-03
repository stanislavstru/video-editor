import type { ClipType } from "../../store/editorStore";

export type DragState =
  | { kind: "idle" }
  | {
      kind: "moving";
      clipId: string;
      startPointerX: number;
      startPointerY: number;
      startClipStart: number;
      startRowId: string;
      /** px offset of pointer within clip at drag start */
      offsetInsideClip: number;
      /** Current ghost position */
      ghostLeft: number;
      ghostRowId: string | null;
      ghostNewRowPosition: "top" | "middle" | "bottom" | null;
      ghostNewRowInsertIndex: number | null;
      ghostRowType: ClipType;
    }
  | {
      kind: "trimming";
      clipId: string;
      edge: "left" | "right";
      startPointerX: number;
      startClipStart: number;
      startClipDuration: number;
      startTrimStart: number;
      sourceDuration: number;
    };
