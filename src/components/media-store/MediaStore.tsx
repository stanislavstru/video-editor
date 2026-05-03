import { useRef, type ChangeEvent } from "react";
import { toast } from "sonner";
import { useEditorStore, type MediaItem } from "../../store/editorStore";
import { Button } from "../ui/button";
import { MediaItemCard } from "./components/MediaItemCard";
import { generateId, loadVideoMetadata } from "./utils";

function getFileFingerprint(file: File, type: MediaItem["type"]) {
  return [type, file.name, file.size, file.lastModified].join(":");
}

export const MediaStore = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaItems = useEditorStore((s) => s.mediaItems);
  const addMediaItem = useEditorStore((s) => s.addMediaItem);
  const removeMediaItem = useEditorStore((s) => s.removeMediaItem);
  const addClipFromMedia = useEditorStore((s) => s.addClipFromMedia);

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const existingFingerprints = new Set(
      mediaItems.map((item) => item.fingerprint).filter(Boolean),
    );
    let skippedDuplicates = 0;

    for (const file of Array.from(files)) {
      const type = file.type.startsWith("audio/") ? "audio" : "video";
      const fingerprint = getFileFingerprint(file, type);
      if (existingFingerprints.has(fingerprint)) {
        skippedDuplicates += 1;
        continue;
      }

      const src = URL.createObjectURL(file);
      try {
        const { duration } = await loadVideoMetadata(src);
        const item: MediaItem = {
          id: generateId(),
          name: file.name,
          src,
          duration,
          type,
          fingerprint,
        };
        addMediaItem(item);
        existingFingerprints.add(fingerprint);
      } catch {
        URL.revokeObjectURL(src);
      }
    }

    if (skippedDuplicates > 0) {
      toast.warning(
        skippedDuplicates === 1
          ? "This media file is already added"
          : `${skippedDuplicates} media files are already added`,
        {
          description:
            skippedDuplicates === 1
              ? "Duplicate files are skipped automatically."
              : "Duplicate files were skipped automatically.",
        },
      );
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
