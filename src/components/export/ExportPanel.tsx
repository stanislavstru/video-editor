import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useEditorStore } from "../../store/editorStore";
import { Button } from "../ui/button";
import { exportTimelineToWebM } from "./clientExport";

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0.0";
  return seconds.toFixed(1);
}

export const ExportPanel = () => {
  const rows = useEditorStore((s) => s.rows);
  const clips = useEditorStore((s) => s.clips);

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

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
      const blob = await exportTimelineToWebM({
        rows,
        clips,
        duration: exportDuration,
        fps: 30,
        width: 1280,
        height: 720,
        onProgress: (value) => setProgress(value),
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `flick-export-${Date.now()}.webm`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      toast.success("Export complete", {
        description: "Video was exported as WebM.",
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
    <div className="flex flex-col gap-3 p-2">
      <span className="text-xs font-medium text-text-color">EXPORT</span>
      <p className="text-xs text-text-color">
        Duration: {formatSeconds(exportDuration)}s | Resolution: 1280x720 | FPS:
        30 | Output format: WebM.
      </p>
      <Button onClick={onExport} disabled={isExporting || exportDuration <= 0}>
        {isExporting ? "Exporting..." : "Start export"}
      </Button>
      {isExporting && (
        <p className="text-xs text-text-color">
          Progress: {Math.round(progress * 100)}%
        </p>
      )}
    </div>
  );
};
