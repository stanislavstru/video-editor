import { useState } from "react";
import { X } from "lucide-react";
import type { Clip } from "../../../store/editorStore";

const COLOR_PRESETS = [
  "#ffffff",
  "#000000",
  "#ffff00",
  "#ff4444",
  "#44ddff",
  "#44ff88",
  "#ff88dd",
  "#ff8800",
];

interface TextEditPanelProps {
  clip: Clip;
  onClose: () => void;
  onUpdateLabel: (label: string) => void;
  onUpdateStyle: (color: string, size: number) => void;
}

export function TextEditPanel({
  clip,
  onClose,
  onUpdateLabel,
  onUpdateStyle,
}: TextEditPanelProps) {
  const [label, setLabel] = useState(clip.label);
  const [color, setColor] = useState(clip.textColor ?? "#ffffff");
  const [size, setSize] = useState(clip.textSize ?? 18);

  const commitLabel = () => {
    const normalized = label.trim() || clip.label;
    setLabel(normalized);
    onUpdateLabel(normalized);
  };

  const applyColor = (next: string) => {
    setColor(next);
    onUpdateStyle(next, size);
  };

  const applySize = (next: number) => {
    setSize(next);
    onUpdateStyle(color, next);
  };

  return (
    <div className="absolute right-0 top-0 z-2600 flex h-full w-60 flex-col border-l border-border bg-background shadow-2xl transition-transform duration-200">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold">Edit Text</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={15} />
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-5 overflow-y-auto px-4 py-4">
        {/* Text */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Text
          </label>
          <input
            className=" border border-border bg-muted px-3 py-1.5 text-sm text-foreground outline-none focus:border-foreground/40"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </div>

        {/* Color */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            Color
          </label>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                title={preset}
                className={`h-7 w-7 rounded-sm border-2 transition-transform hover:scale-110 ${
                  color === preset
                    ? "border-foreground scale-110"
                    : "border-transparent"
                }`}
                style={{ background: preset }}
                onClick={() => applyColor(preset)}
              />
            ))}
          </div>
          {/* Custom color */}
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-7 w-7 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
              value={color}
              onChange={(e) => applyColor(e.target.value)}
            />
            <span className="font-mono text-xs text-muted-foreground">
              {color}
            </span>
          </div>
        </div>

        {/* Font size */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Size
            </label>
            <span className="font-mono text-xs text-foreground">{size}px</span>
          </div>
          <input
            type="range"
            min={10}
            max={72}
            step={1}
            value={size}
            onChange={(e) => applySize(Number(e.target.value))}
            className="accent-brand w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>10</span>
            <span>72</span>
          </div>
        </div>
      </div>
    </div>
  );
}
