import type { MediaItem } from "../../../store/editorStore";

interface MediaPreviewProps {
  item: MediaItem;
}

export function MediaPreview({ item }: MediaPreviewProps) {
  if (item.type === "audio") {
    return (
      <div className="border border-border bg-muted/40 p-2">
        <audio
          controls
          preload="metadata"
          src={item.src}
          className="h-8 w-full"
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-border bg-black">
      <video
        src={item.src}
        preload="metadata"
        muted
        playsInline
        controls
        className="aspect-video w-full bg-black object-cover"
      />
    </div>
  );
}
