import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "../../../../store/editorStore";
import { Button } from "../../../ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../ui/collapsible";
import { Label } from "../../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../ui/select";
import type { ExportFormat, ExportQuality } from "../../clientExport";
import { exportTimeline } from "../../clientExport";

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0.0";
  return seconds.toFixed(1);
}

const RESOLUTIONS = [
  { label: "480p (854×480)", width: 854, height: 480 },
  { label: "720p (1280×720)", width: 1280, height: 720 },
  { label: "1080p (1920×1080)", width: 1920, height: 1080 },
  { label: "4K (3840×2160)", width: 3840, height: 2160 },
] as const;

const FPS_OPTIONS = [
  { label: "24 fps", value: 24 },
  { label: "30 fps", value: 30 },
  { label: "60 fps", value: 60 },
] as const;

const QUALITY_OPTIONS: { label: string; value: ExportQuality }[] = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Very High", value: "very_high" },
];

const FORMAT_OPTIONS: { label: string; value: ExportFormat }[] = [
  { label: "Auto (best codec)", value: "auto" },
  { label: "MP4 (H.264)", value: "mp4" },
  { label: "WebM (VP9)", value: "webm" },
];

export function VideoExportSection() {
  const rows = useEditorStore((s) => s.rows);
  const clips = useEditorStore((s) => s.clips);

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isOpen, setIsOpen] = useState(true);

  const [resolutionKey, setResolutionKey] = useState("1280x720");
  const [fps, setFps] = useState(30);
  const [quality, setQuality] = useState<ExportQuality>("high");
  const [format, setFormat] = useState<ExportFormat>("auto");

  const resolution = useMemo(
    () =>
      RESOLUTIONS.find((r) => `${r.width}x${r.height}` === resolutionKey) ??
      RESOLUTIONS[1],
    [resolutionKey],
  );

  const exportDuration = useMemo(() => {
    if (clips.length === 0) return 0;
    return clips.reduce(
      (max, clip) => Math.max(max, clip.start + clip.duration),
      0,
    );
  }, [clips]);

  const onExport = async () => {
    if (isExporting) return;
    if (clips.length === 0 || exportDuration <= 0) {
      toast.warning("Nothing to export", {
        description: "Add clips to the timeline before export.",
      });
      return;
    }

    setIsExporting(true);
    setProgress(0);

    try {
      const { blob, extension } = await exportTimeline({
        rows,
        clips,
        duration: exportDuration,
        fps,
        width: resolution.width,
        height: resolution.height,
        quality,
        format,
        onProgress: (value) => setProgress(value),
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `flick-export-${Date.now()}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      toast.success("Export complete", {
        description: `Saved as ${extension.toUpperCase()} · ${resolution.label} · ${fps} fps`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed";
      toast.error("Export error", { description: message });
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border border-border"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-2 text-sm uppercase">
        <span>Export settings</span>
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 p-2 pt-0">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-text-color">Resolution</Label>
          <Select
            value={resolutionKey}
            onValueChange={setResolutionKey}
            disabled={isExporting}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((r) => (
                <SelectItem
                  key={`${r.width}x${r.height}`}
                  value={`${r.width}x${r.height}`}
                  className="text-xs"
                >
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-text-color">Frame rate</Label>
          <Select
            value={String(fps)}
            onValueChange={(v) => setFps(Number(v))}
            disabled={isExporting}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FPS_OPTIONS.map((o) => (
                <SelectItem
                  key={o.value}
                  value={String(o.value)}
                  className="text-xs"
                >
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-text-color">Quality</Label>
          <Select
            value={quality}
            onValueChange={(v) => setQuality(v as ExportQuality)}
            disabled={isExporting}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUALITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-text-color">Format</Label>
          <Select
            value={format}
            onValueChange={(v) => setFormat(v as ExportFormat)}
            disabled={isExporting}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-text-color opacity-60">
          Duration: {formatSeconds(exportDuration)}s
        </p>

        <Button
          onClick={onExport}
          disabled={isExporting || exportDuration <= 0}
        >
          {isExporting
            ? `Exporting… ${Math.round(progress * 100)}%`
            : "Start export"}
        </Button>

        {isExporting && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-white/60 transition-all duration-150"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
