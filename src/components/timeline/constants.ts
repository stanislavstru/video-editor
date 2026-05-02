import type { ClipType } from "../../store/editorStore";

export const ROW_HEIGHT = 56; // px
export const TEXT_ROW_HEIGHT = 44; // px
export const ROW_LABEL_WIDTH = 96; // px
export const RULER_HEIGHT = 28; // px
export const SNAP_GRID = 0.5; // seconds
export const TRIM_HANDLE_WIDTH = 8; // px
export const MIN_CLIP_DURATION = 0.2; // seconds

export function getRowHeight(type: ClipType): number {
	return type === "text" ? TEXT_ROW_HEIGHT : ROW_HEIGHT;
}

export function getClipHeight(type: ClipType): number {
	return Math.max(getRowHeight(type) - 8, 20);
}
