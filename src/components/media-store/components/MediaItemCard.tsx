import type { MediaItem } from "../../../store/editorStore";
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
    <div className="group flex flex-col gap-2 border border-border bg-background p-2 transition-colors hover:bg-muted/30">
      <MediaPreview item={item} />

      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => onAddToTimeline(item.id)}
          className="min-w-0 flex-1 cursor-pointer text-left"
          title="Add to timeline"
        >
          <div className="truncate text-xs font-medium">{item.name}</div>
          <div className="text-[10px] text-muted-foreground">
            {item.duration.toFixed(1)}s · {item.type}
          </div>
        </button>

        <button
          onClick={() => onRemove(item.id)}
          className="cursor-pointer text-xs text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500"
          title="Remove"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
