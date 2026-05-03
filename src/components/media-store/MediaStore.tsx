import { useRef, type ChangeEvent } from "react";
import { useEditorStore, type MediaItem } from "../../store/editorStore";
import { Button } from "../ui/button";
import { MediaItemCard } from "./components/MediaItemCard";
import { generateId, loadVideoMetadata } from "./utils";

export const MediaStore = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaItems = useEditorStore((s) => s.mediaItems);
  const addMediaItem = useEditorStore((s) => s.addMediaItem);
  const removeMediaItem = useEditorStore((s) => s.removeMediaItem);
  const addClipFromMedia = useEditorStore((s) => s.addClipFromMedia);

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const src = URL.createObjectURL(file);
      try {
        const { duration } = await loadVideoMetadata(src);
        const item: MediaItem = {
          id: generateId(),
          name: file.name,
          src,
          duration,
          type: file.type.startsWith("audio/") ? "audio" : "video",
        };
        addMediaItem(item);
      } catch {
        URL.revokeObjectURL(src);
      }
    }
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      <Button onClick={() => inputRef.current?.click()}>+ Add media</Button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*"
        multiple
        className="hidden"
        onChange={onFiles}
      />

      <div className="flex flex-col gap-1 overflow-y-auto">
        {mediaItems.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">No media yet</p>
        )}
        {mediaItems.map((item) => (
          <MediaItemCard
            key={item.id}
            item={item}
            onAddToTimeline={addClipFromMedia}
            onRemove={removeMediaItem}
          />
        ))}
      </div>
    </div>
  );
};
