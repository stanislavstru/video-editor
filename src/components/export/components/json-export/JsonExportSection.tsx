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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../ui/dialog";

export function JsonExportSection() {
  const rows = useEditorStore((s) => s.rows);
  const clips = useEditorStore((s) => s.clips);
  const duration = useEditorStore((s) => s.duration);
  const currentTime = useEditorStore((s) => s.currentTime);
  const zoom = useEditorStore((s) => s.zoom);

  const [isSectionOpen, setIsSectionOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const timelineSnapshot = useMemo(
    () => ({
      exportedAt: new Date().toISOString(),
      timeline: {
        duration,
        currentTime,
        zoom,
      },
      rows,
      clips,
    }),
    [duration, currentTime, zoom, rows, clips],
  );

  const timelineJson = useMemo(
    () => JSON.stringify(timelineSnapshot, null, 2),
    [timelineSnapshot],
  );

  const onDownloadTimelineJson = () => {
    const blob = new Blob([timelineJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `flick-timeline-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    toast.success("Timeline JSON exported", {
      description: `Saved ${rows.length} rows and ${clips.length} clips.`,
    });
  };

  return (
    <>
      <Collapsible
        open={isSectionOpen}
        onOpenChange={setIsSectionOpen}
        className="border border-border"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-2 text-sm uppercase">
          <span>Timeline JSON</span>
          <ChevronDown
            size={14}
            className={`transition-transform ${isSectionOpen ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-2 p-2 pt-0">
          <p className="text-xs text-text-color opacity-60">
            Download timeline data: rows, clips, duration, current time, and
            zoom.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => setIsDialogOpen(true)}>
              Open JSON preview
            </Button>
            <Button onClick={onDownloadTimelineJson}>Download JSON</Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Timeline JSON</DialogTitle>
            <DialogDescription>
              Full snapshot of timeline state (rows, clips, duration, current
              time, zoom).
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-auto border border-border bg-muted/30 p-3">
            <pre className="text-xs leading-relaxed whitespace-pre-wrap break-all">
              {timelineJson}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
