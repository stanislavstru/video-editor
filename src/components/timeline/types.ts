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
      ghostRowId: string;
    }
  | {
      kind: "trimming";
      clipId: string;
      edge: "left" | "right";
      startPointerX: number;
      startClipStart: number;
      startClipDuration: number;
    };
