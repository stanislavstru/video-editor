import type { MediaItem } from "../../../store/editorStore";
import { Button } from "../../ui/button";
import { MediaPreview } from "./MediaPreview";

interface MediaItemCardProps {
  item: MediaItem;
  onAddToTimeline: (id: string) => void;
  onRemove: (id: string) => void;
}

export function MediaItemCard({
  item,
  onAddToTimeline,
  onRemove,
}: MediaItemCardProps) {
  return (
    <div className="group flex flex-col gap-2 border border-border bg-background p-2 transition-colors hover:bg-muted/30 min-w-0 overflow-hidden">
      <MediaPreview item={item} />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{item.name}</div>
          <div className="text-[10px] text-muted-foreground">
            {item.duration.toFixed(1)}s · {item.type}
          </div>
        </div>

        <Button
          onClick={() => onAddToTimeline(item.id)}
          title="Add to timeline"
        >
          Add
        </Button>

        <Button onClick={() => onRemove(item.id)} title="Remove">
          ✕
        </Button>
      </div>
    </div>
  );
}
